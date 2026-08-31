from datetime import timedelta
from pathlib import Path

import numpy as np

from services.radar.mosaic import GridSpec, create_grid
from services.radar.producer import ProducerSettings, _estimate_frame_motion

RESOLUTION_M = 2000.0
STRIDE = 4  # _estimate_frame_motion downsamples by this before correlating


def settings(tmp_path: Path) -> ProducerSettings:
    return ProducerSettings(
        bucket="unused",
        stations=("KOHX",),
        bounds=(-91.5, 33.0, -81.0, 39.0),
        resolution_m=RESOLUTION_M,
        minimum_zoom=4,
        maximum_zoom=9,
        ingest_lag=timedelta(seconds=600),
        scan_window=timedelta(seconds=1800),
        scan_tolerance=timedelta(seconds=240),
        minimum_stations=2,
        maximum_range_km=230,
        interval_seconds=300,
        retained_frames=13,
        ingest_workers=4,
        compute_workers=2,
        keep_raw_scans=False,
        raw_retention=timedelta(seconds=1800),
        raw_directory=tmp_path / "raw",
        mosaic_directory=tmp_path,
    )


def storm_grid(shift_columns: int = 0, shift_rows: int = 0):
    grid = create_grid(GridSpec(-91.5, 33.0, -81.0, 39.0, RESOLUTION_M))
    rows, columns = grid.dbz.shape
    y, x = np.mgrid[0:rows, 0:columns]
    for centre_row, centre_column in ((60, 80), (140, 200), (200, 120)):
        blob = 45 * np.exp(
            -(((y - centre_row) ** 2 + (x - centre_column) ** 2) / (2 * 15.0**2))
        )
        grid.dbz = np.where(blob > 20, blob.astype(np.float32), grid.dbz)
    grid.dbz = np.roll(np.roll(grid.dbz, shift_rows, axis=0), shift_columns, axis=1)
    return grid


def test_first_frame_reports_no_motion_and_stores_reference(tmp_path: Path) -> None:
    config = settings(tmp_path)
    motion = _estimate_frame_motion(config, storm_grid(), frame_time=1_000_000)
    assert motion == {"x": 0.0, "y": 0.0}
    assert (tmp_path / "motion.npz").is_file()


def test_motion_is_reported_in_metres_per_second(tmp_path: Path) -> None:
    config = settings(tmp_path)
    elapsed = 300
    _estimate_frame_motion(config, storm_grid(), frame_time=1_000_000)

    # Eight full-resolution cells east and eight north over five minutes.
    moved = storm_grid(shift_columns=2 * STRIDE, shift_rows=-2 * STRIDE)
    motion = _estimate_frame_motion(config, moved, frame_time=1_000_000 + elapsed)

    expected = 2 * RESOLUTION_M * STRIDE / elapsed
    assert motion["x"] == expected
    # Grid rows run north to south, so a northward shift must report positive y.
    assert motion["y"] == expected


def test_stale_reference_is_ignored(tmp_path: Path) -> None:
    config = settings(tmp_path)
    _estimate_frame_motion(config, storm_grid(), frame_time=1_000_000)
    motion = _estimate_frame_motion(
        config, storm_grid(shift_columns=8), frame_time=1_000_000 + 100_000
    )
    assert motion == {"x": 0.0, "y": 0.0}
