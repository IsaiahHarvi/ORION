from __future__ import annotations

import argparse
import csv
import hashlib
import json
import logging
import os
import shutil
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np

from services.radar.archive import (
    ScanObject,
    create_s3_client,
    download_scan,
    list_scans,
    select_synchronized_scans,
)
from services.radar.mosaic import (
    GateScan,
    GridSpec,
    MosaicGrid,
    add_scan_to_grid,
    create_grid,
    despeckle_grid,
    estimate_motion_cells,
    extract_lowest_reflectivity,
)
from services.radar.tiles import TRANSPARENT_PNG, render_tile_pyramid

LOGGER = logging.getLogger("orion.radar")
ALGORITHM_VERSION = "level2-despeckle-v10"

# Stations this far outside the bounds still cover area inside them (230 km
# radar range is about 2.1 degrees of latitude).
STATION_MARGIN_DEGREES = 2.5


def _load_all_stations(
    bounds: tuple[float, float, float, float],
    path: str = "data/nexrad_stations.csv",
) -> tuple[str, ...]:
    west, south, east, north = bounds
    stations = []
    with open(path, newline="") as handle:
        for row in csv.DictReader(handle):
            latitude = row["Latitude"].strip()
            longitude = row["Longitude"].strip()
            if not latitude or not longitude:
                continue
            if (
                west - STATION_MARGIN_DEGREES
                <= float(longitude)
                <= east + STATION_MARGIN_DEGREES
                and south - STATION_MARGIN_DEGREES
                <= float(latitude)
                <= north + STATION_MARGIN_DEGREES
            ):
                stations.append(row["Radar ID"].strip().upper())
    if not stations:
        raise ValueError(f"No radar stations from {path} fall within {bounds}")
    return tuple(sorted(stations))


@dataclass(frozen=True)
class ProducerSettings:
    bucket: str
    stations: tuple[str, ...]
    bounds: tuple[float, float, float, float]
    resolution_m: float
    minimum_zoom: int
    maximum_zoom: int
    ingest_lag: timedelta
    scan_window: timedelta
    scan_tolerance: timedelta
    minimum_stations: int
    maximum_range_km: float
    interval_seconds: int
    retained_frames: int
    ingest_workers: int
    compute_workers: int
    keep_raw_scans: bool
    raw_retention: timedelta
    raw_directory: Path
    mosaic_directory: Path

    @classmethod
    def from_environment(cls) -> ProducerSettings:
        scan_root = Path(os.environ.get("SCAN_DIR", "./data/dev-scans"))
        bounds = tuple(
            float(value)
            for value in os.environ.get(
                "ORION_RADAR_BOUNDS", "-125.0,24.0,-66.5,49.5"
            ).split(",")
        )
        if len(bounds) != 4:
            raise ValueError("ORION_RADAR_BOUNDS must contain west,south,east,north")
        stations_setting = os.environ.get("ORION_RADAR_STATIONS", "ALL")
        if stations_setting.strip().upper() == "ALL":
            stations = _load_all_stations(
                bounds,  # type: ignore[arg-type]
                os.environ.get("ORION_STATIONS_FILE", "data/nexrad_stations.csv"),
            )
        else:
            stations = tuple(
                station.strip().upper()
                for station in stations_setting.split(",")
                if station.strip()
            )
        return cls(
            bucket=os.environ.get("ORION_NEXRAD_BUCKET", "unidata-nexrad-level2"),
            stations=stations,
            bounds=bounds,  # type: ignore[arg-type]
            resolution_m=float(os.environ.get("ORION_RADAR_RESOLUTION_M", "2000")),
            minimum_zoom=int(os.environ.get("ORION_RADAR_MIN_ZOOM", "4")),
            maximum_zoom=int(os.environ.get("ORION_RADAR_MAX_ZOOM", "9")),
            ingest_lag=timedelta(
                seconds=int(os.environ.get("ORION_RADAR_INGEST_LAG_SECONDS", "600"))
            ),
            scan_window=timedelta(
                seconds=int(os.environ.get("ORION_RADAR_SCAN_WINDOW_SECONDS", "1800"))
            ),
            scan_tolerance=timedelta(
                seconds=int(os.environ.get("ORION_RADAR_SCAN_TOLERANCE_SECONDS", "240"))
            ),
            minimum_stations=int(os.environ.get("ORION_RADAR_MIN_STATIONS", "2")),
            maximum_range_km=float(os.environ.get("ORION_RADAR_RANGE_KM", "230")),
            interval_seconds=int(os.environ.get("ORION_RADAR_INTERVAL_SECONDS", "300")),
            retained_frames=int(os.environ.get("ORION_RADAR_RETAINED_FRAMES", "13")),
            # Deliberately leave the machine usable: this runs alongside a dev
            # server on a developer's laptop, not on a dedicated box.
            ingest_workers=int(os.environ.get("ORION_RADAR_INGEST_WORKERS", "8")),
            compute_workers=int(
                os.environ.get(
                    "ORION_RADAR_COMPUTE_WORKERS",
                    str(max(1, (os.cpu_count() or 4) // 2)),
                )
            ),
            # Volumes are discarded as soon as they are decoded. Set this to
            # keep them for backfills or offline debugging, at the cost of
            # several gigabytes of cache.
            keep_raw_scans=os.environ.get("ORION_RADAR_KEEP_RAW", "").strip().lower()
            in {"1", "true", "yes"},
            # Backstop for volumes left behind by a failed decode, and the real
            # bound when raw scans are being kept.
            raw_retention=timedelta(
                seconds=int(
                    os.environ.get(
                        "ORION_RADAR_RAW_RETENTION_SECONDS",
                        os.environ.get("ORION_RADAR_SCAN_WINDOW_SECONDS", "1800"),
                    )
                )
            ),
            raw_directory=Path(
                os.environ.get("ORION_RADAR_RAW_DIR", str(scan_root / "raw"))
            ),
            mosaic_directory=Path(
                os.environ.get("ORION_MOSAIC_DIR", str(scan_root / "mosaic"))
            ),
        )


def _atomic_json(path: Path, data: object) -> None:
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_text(json.dumps(data, indent=2, sort_keys=True))
    os.replace(temporary, path)


def _list_station_scans(
    client: object, settings: ProducerSettings, start: datetime, cutoff: datetime
) -> dict[str, list[ScanObject]]:
    result: dict[str, list[ScanObject]] = {}
    with ThreadPoolExecutor(max_workers=min(12, len(settings.stations))) as executor:
        futures = {
            executor.submit(
                list_scans, client, settings.bucket, station, start, cutoff
            ): station
            for station in settings.stations
        }
        for future in as_completed(futures):
            station = futures[future]
            try:
                result[station] = future.result()
            except Exception:
                LOGGER.exception("Could not list scans for %s", station)
                result[station] = []
    return result


def _download_and_extract(
    client: object,
    settings: ProducerSettings,
    scan: ScanObject,
) -> GateScan:
    path = download_scan(client, settings.bucket, scan, settings.raw_directory)
    try:
        return extract_lowest_reflectivity(
            path, scan.station, settings.maximum_range_km
        )
    finally:
        # A volume is only ever read once, right here, so releasing it now caps
        # the cache at the scans currently in flight rather than a full cycle's
        # worth per station. Consecutive frames do share about a fifth of their
        # scans, so this trades a modest amount of re-downloading for roughly
        # two orders of magnitude less disk.
        if not settings.keep_raw_scans:
            path.unlink(missing_ok=True)


def _prune_raw_scans(settings: ProducerSettings) -> None:
    """Delete cached Level II volumes older than the retention window.

    Each cycle downloads one volume per station, so an unpruned cache grows by
    roughly a gigabyte an hour at full station coverage.
    """
    if settings.raw_retention <= timedelta(0):
        return
    cutoff = time.time() - settings.raw_retention.total_seconds()
    removed = 0
    freed = 0
    for path in settings.raw_directory.rglob("*"):
        if not path.is_file():
            continue
        try:
            info = path.stat()
            if info.st_mtime < cutoff:
                path.unlink()
                removed += 1
                freed += info.st_size
        except OSError:
            LOGGER.debug("Could not prune %s", path, exc_info=True)
    for directory in sorted(
        (p for p in settings.raw_directory.rglob("*") if p.is_dir()),
        key=lambda p: len(p.parts),
        reverse=True,
    ):
        try:
            directory.rmdir()
        except OSError:
            pass
    if removed:
        LOGGER.info("Pruned %s cached scans (%.1f GB)", removed, freed / 1e9)


def _estimate_frame_motion(
    settings: ProducerSettings, grid: MosaicGrid, frame_time: int
) -> dict[str, float]:
    """Bulk echo motion since the previous frame, in metres per second.

    The reduced grid is kept beside the frame so the next cycle can correlate
    against it without re-ingesting the volumes. Downsampling keeps that file
    small and costs no accuracy the client can see: the vector is only used to
    slide the display a few kilometres between frames.
    """
    stride = 4
    reduced = np.nan_to_num(grid.dbz[::stride, ::stride], nan=0.0).astype(np.float32)
    motion_path = settings.mosaic_directory / "motion.npz"
    motion = {"x": 0.0, "y": 0.0}

    try:
        if motion_path.is_file():
            stored = np.load(motion_path)
            elapsed = frame_time - float(stored["time"])
            previous = stored["grid"]
            if 0 < elapsed <= settings.scan_window.total_seconds() * 2 and (
                previous.shape == reduced.shape
            ):
                cells_x, cells_y = estimate_motion_cells(previous, reduced)
                metres = settings.resolution_m * stride
                motion = {
                    "x": cells_x * metres / elapsed,
                    # Grid rows run north to south, so a positive row shift is
                    # southward; report the vector in map terms (north positive).
                    "y": -cells_y * metres / elapsed,
                }
    except Exception:
        LOGGER.exception("Could not estimate radar motion")

    try:
        np.savez_compressed(motion_path, grid=reduced, time=np.float64(frame_time))
    except OSError:
        LOGGER.exception("Could not store motion reference grid")
    return motion


def _prune_superseded_frames(
    frames_directory: Path, configuration_suffix: str, minimum_age_seconds: float = 3600
) -> None:
    """Delete frames rendered by a superseded algorithm or configuration.

    Retention only covers frames of the current configuration, so without this
    every algorithm change strands its frames on disk forever. The age guard
    leaves a concurrently running producer's fresh output alone.
    """
    cutoff = time.time() - minimum_age_seconds
    for directory in frames_directory.iterdir():
        if not directory.is_dir() or directory.name.startswith("."):
            continue
        if directory.name.endswith(configuration_suffix):
            continue
        try:
            if directory.stat().st_mtime < cutoff:
                shutil.rmtree(directory, ignore_errors=True)
        except OSError:
            LOGGER.debug("Could not prune %s", directory, exc_info=True)


def _publish_manifest(settings: ProducerSettings) -> None:
    frames_directory = settings.mosaic_directory / "frames"
    metadata: list[dict[str, object]] = []
    configuration_suffix = f"-{_configuration_hash(settings)}"
    for directory in frames_directory.iterdir():
        path = directory / "metadata.json"
        if directory.is_dir() and not directory.name.startswith(".") and path.is_file():
            frame = json.loads(path.read_text())
            if isinstance(frame.get("id"), str) and frame["id"].endswith(
                configuration_suffix
            ):
                metadata.append(frame)
    metadata.sort(key=lambda frame: int(frame["time"]))

    while len(metadata) > settings.retained_frames:
        expired = metadata.pop(0)
        shutil.rmtree(frames_directory / str(expired["id"]), ignore_errors=True)

    _prune_superseded_frames(frames_directory, configuration_suffix)

    frames = [
        {
            "id": frame["id"],
            "time": frame["time"],
            "kind": "observed",
            "tiles": f"radar/tiles/{frame['id']}/{{z}}/{{x}}/{{y}}.png",
            "stations": frame["stations"],
            "max_skew_seconds": frame["max_skew_seconds"],
            "motion_mps": frame.get("motion_mps", {"x": 0.0, "y": 0.0}),
        }
        for frame in metadata
    ]
    latest_id = str(frames[-1]["id"]) if frames else ""
    manifest = {
        "version": 1,
        "generated_at": datetime.now(UTC).isoformat(),
        "default_frame_id": latest_id,
        "latest_observed_frame_id": latest_id,
        "tile_size": 256,
        "min_zoom": settings.minimum_zoom,
        "max_zoom": settings.maximum_zoom,
        "bounds": settings.bounds,
        "configured_stations": settings.stations,
        "attribution": {
            "text": "Weather radar: NOAA/NWS NEXRAD processed by ORION",
            "url": "https://www.weather.gov/",
        },
        "frames": frames,
    }
    manifests_directory = settings.mosaic_directory / "manifests"
    manifests_directory.mkdir(exist_ok=True)
    _atomic_json(
        manifests_directory / f"{_configuration_hash(settings)}.json", manifest
    )
    _atomic_json(settings.mosaic_directory / "manifest.json", manifest)


def _configuration_hash(settings: ProducerSettings) -> str:
    value = json.dumps(
        {
            "algorithm": ALGORITHM_VERSION,
            "stations": settings.stations,
            "bounds": settings.bounds,
            "resolution_m": settings.resolution_m,
            "minimum_zoom": settings.minimum_zoom,
            "maximum_zoom": settings.maximum_zoom,
            "maximum_range_km": settings.maximum_range_km,
            "scan_window_seconds": settings.scan_window.total_seconds(),
            "scan_tolerance_seconds": settings.scan_tolerance.total_seconds(),
            "minimum_stations": settings.minimum_stations,
            "bucket": settings.bucket,
        },
        sort_keys=True,
    )
    return hashlib.sha256(value.encode()).hexdigest()[:8]


def produce_frame(
    settings: ProducerSettings,
    analysis_time: datetime | None = None,
) -> str:
    settings.raw_directory.mkdir(parents=True, exist_ok=True)
    frames_directory = settings.mosaic_directory / "frames"
    frames_directory.mkdir(parents=True, exist_ok=True)
    (settings.mosaic_directory / "transparent.png").write_bytes(TRANSPARENT_PNG)

    cutoff = analysis_time or datetime.now(UTC) - settings.ingest_lag
    if cutoff.tzinfo is None:
        cutoff = cutoff.replace(tzinfo=UTC)
    # Size the connection pool for the listing and download pools that share
    # this client, with headroom; a pool smaller than the workers using it makes
    # boto discard and reopen connections on nearly every request.
    client = create_s3_client(max_pool_connections=settings.ingest_workers + 16)
    scans = _list_station_scans(client, settings, cutoff - settings.scan_window, cutoff)
    anchor, selected = select_synchronized_scans(
        scans, cutoff, settings.scan_tolerance, settings.minimum_stations
    )
    frame_time = int(anchor.timestamp())
    frame_id = f"{frame_time}-{_configuration_hash(settings)}"
    final_directory = frames_directory / frame_id
    if final_directory.is_dir():
        _publish_manifest(settings)
        LOGGER.info("Frame %s already exists", frame_id)
        return frame_id

    # Stream download -> decode -> composite so only a handful of decoded
    # volumes are in memory at once; a full-CONUS run ingests 140+ stations.
    grid = create_grid(GridSpec(*settings.bounds, resolution_m=settings.resolution_m))
    contributing: list[str] = []
    with ThreadPoolExecutor(
        max_workers=min(settings.ingest_workers, len(selected))
    ) as executor:
        futures = {
            executor.submit(_download_and_extract, client, settings, scan): station
            for station, scan in selected.items()
        }
        for future in as_completed(futures):
            station = futures[future]
            try:
                gate_scan = future.result()
            except Exception:
                LOGGER.exception("Could not ingest scan for %s", station)
                continue
            add_scan_to_grid(grid, gate_scan, workers=settings.compute_workers)
            contributing.append(station)
            del gate_scan
    if len(contributing) < settings.minimum_stations:
        raise RuntimeError(
            f"Only {len(contributing)} stations decoded; "
            f"need {settings.minimum_stations}"
        )
    despeckle_grid(grid)

    motion = _estimate_frame_motion(settings, grid, frame_time)

    successful_sources = [
        scan for station, scan in selected.items() if station in contributing
    ]
    temporary = frames_directory / f".{frame_id}.{os.getpid()}.tmp"
    shutil.rmtree(temporary, ignore_errors=True)
    temporary.mkdir(parents=True)
    tile_count = render_tile_pyramid(
        grid, temporary, settings.minimum_zoom, settings.maximum_zoom
    )
    max_skew = max(
        abs((scan.observed_at - anchor).total_seconds()) for scan in successful_sources
    )
    metadata = {
        "id": frame_id,
        "time": frame_time,
        "analysis_time": anchor.isoformat(),
        "stations": sorted(contributing),
        "source_keys": sorted(scan.key for scan in successful_sources),
        "max_skew_seconds": max_skew,
        "motion_mps": motion,
        "tile_count": tile_count,
        "bounds": settings.bounds,
        "resolution_m": settings.resolution_m,
        "algorithm_version": ALGORITHM_VERSION,
    }
    _atomic_json(temporary / "metadata.json", metadata)
    os.replace(temporary, final_directory)
    _publish_manifest(settings)
    LOGGER.info(
        "Published frame %s from %s stations with %s non-empty tiles",
        frame_id,
        len(contributing),
        tile_count,
    )
    return frame_id


def _parse_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def main() -> None:
    parser = argparse.ArgumentParser(description="Produce ORION NEXRAD mosaic frames")
    parser.add_argument(
        "--once", action="store_true", help="Produce one frame and exit"
    )
    parser.add_argument("--analysis-time", type=_parse_time)
    args = parser.parse_args()
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    settings = ProducerSettings.from_environment()

    while True:
        try:
            produce_frame(settings, args.analysis_time)
        except Exception:
            LOGGER.exception("Radar frame production failed")
            if args.once:
                raise
        finally:
            # Reclaim on every cycle, not just successful ones. A producer that
            # keeps failing, or that keeps finding the frame already built, still
            # downloads a volume per station and would otherwise fill the disk.
            try:
                _prune_raw_scans(settings)
            except Exception:
                LOGGER.exception("Could not prune cached scans")
        if args.once or args.analysis_time:
            return
        time.sleep(settings.interval_seconds)


if __name__ == "__main__":
    main()
