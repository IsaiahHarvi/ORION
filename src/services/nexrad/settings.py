from __future__ import annotations

import csv
import hashlib
import json
import os
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path

ALGORITHM_VERSION = "level2-despeckle-v10"

# Stations this far outside the bounds still cover area inside them (230 km
# radar range is about 2.1 degrees of latitude).
STATION_MARGIN_DEGREES = 2.5


def load_all_stations(
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
            stations = load_all_stations(
                bounds,  # type: ignore[arg-type]
                os.environ.get("ORION_STATIONS_FILE", "data/nexrad_stations.csv"),
            )
        else:
            stations = tuple(
                station.strip().upper()
                for station in stations_setting.split(",")
                if station.strip()
            )
        interval_seconds = int(os.environ.get("ORION_RADAR_INTERVAL_SECONDS", "300"))
        # History is configured as a duration, not a frame count, so it stays
        # six hours if the cycle interval changes. Retention still works in
        # frames, which is what the manifest and the pruning loop deal in.
        history_hours = float(os.environ.get("ORION_RADAR_HISTORY_HOURS", "6"))
        retained_frames = int(
            os.environ.get(
                "ORION_RADAR_RETAINED_FRAMES",
                str(max(1, round(history_hours * 3600 / interval_seconds))),
            )
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
            interval_seconds=interval_seconds,
            retained_frames=retained_frames,
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


def configuration_hash(settings: ProducerSettings) -> str:
    """Identity of the output a given configuration produces.

    Frames carry this in their id so that a change to the algorithm or to any
    setting that alters pixels starts a fresh series instead of silently mixing
    incompatible frames into one animation.
    """
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
