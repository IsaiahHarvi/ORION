from __future__ import annotations

import logging
import os
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from services.nexrad.archive import (
    ScanObject,
    create_s3_client,
    select_synchronized_scans,
)
from services.nexrad.ingest import download_and_extract, list_station_scans
from services.nexrad.manifest import publish_manifest
from services.nexrad.mosaic import (
    GridSpec,
    MosaicGrid,
    add_scan_to_grid,
    create_grid,
    despeckle_grid,
)
from services.nexrad.motion import estimate_frame_motion
from services.nexrad.placeholder import TRANSPARENT_PNG
from services.nexrad.settings import (
    ALGORITHM_VERSION,
    ProducerSettings,
    configuration_hash,
)
from services.nexrad.storage import atomic_json
from services.nexrad.tiles import render_tile_pyramid

LOGGER = logging.getLogger("orion.radar.frames")


def produce_frame(
    settings: ProducerSettings,
    analysis_time: datetime | None = None,
) -> str:
    """Build and publish one mosaic frame, returning its id."""
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
    scans = list_station_scans(client, settings, cutoff - settings.scan_window, cutoff)
    anchor, selected = select_synchronized_scans(
        scans, cutoff, settings.scan_tolerance, settings.minimum_stations
    )

    frame_time = int(anchor.timestamp())
    frame_id = f"{frame_time}-{configuration_hash(settings)}"
    final_directory = frames_directory / frame_id
    if final_directory.is_dir():
        publish_manifest(settings)
        LOGGER.info("Frame %s already exists", frame_id)
        return frame_id

    grid, contributing = _composite_scans(client, settings, selected)
    if len(contributing) < settings.minimum_stations:
        raise RuntimeError(
            f"Only {len(contributing)} stations decoded; "
            f"need {settings.minimum_stations}"
        )
    despeckle_grid(grid)
    motion = estimate_frame_motion(settings, grid, frame_time)

    sources = [scan for station, scan in selected.items() if station in contributing]
    metadata = {
        "id": frame_id,
        "time": frame_time,
        "analysis_time": anchor.isoformat(),
        "stations": sorted(contributing),
        "source_keys": sorted(scan.key for scan in sources),
        "max_skew_seconds": max(
            abs((scan.observed_at - anchor).total_seconds()) for scan in sources
        ),
        "motion_mps": motion,
        "bounds": settings.bounds,
        "resolution_m": settings.resolution_m,
        "algorithm_version": ALGORITHM_VERSION,
    }
    _render_frame(settings, frames_directory, frame_id, grid, metadata)

    publish_manifest(settings)
    LOGGER.info(
        "Published frame %s from %s stations with %s non-empty tiles",
        frame_id,
        len(contributing),
        metadata["tile_count"],
    )
    return frame_id


def _composite_scans(
    client: Any, settings: ProducerSettings, selected: dict[str, ScanObject]
) -> tuple[MosaicGrid, list[str]]:
    """Download, decode, and composite the selected scans onto one grid.

    Download -> decode -> composite is streamed rather than staged so only a
    handful of decoded volumes are in memory at once; a full-CONUS run ingests
    140+ stations. A station that fails to decode is dropped from the frame.
    """
    grid = create_grid(GridSpec(*settings.bounds, resolution_m=settings.resolution_m))
    contributing: list[str] = []
    workers = min(settings.ingest_workers, len(selected))
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(download_and_extract, client, settings, scan): station
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
    return grid, contributing


def _render_frame(
    settings: ProducerSettings,
    frames_directory: Path,
    frame_id: str,
    grid: MosaicGrid,
    metadata: dict[str, Any],
) -> None:
    """Render the tile pyramid into a scratch directory and swap it into place.

    The rename is what makes a frame visible, so a reader never sees a frame
    directory that is missing tiles or its metadata.
    """
    temporary = frames_directory / f".{frame_id}.{os.getpid()}.tmp"
    shutil.rmtree(temporary, ignore_errors=True)
    temporary.mkdir(parents=True)
    metadata["tile_count"] = render_tile_pyramid(
        grid, temporary, settings.minimum_zoom, settings.maximum_zoom
    )
    atomic_json(temporary / "metadata.json", metadata)
    os.replace(temporary, frames_directory / frame_id)
