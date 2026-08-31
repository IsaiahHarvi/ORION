import numpy as np

from services.radar.mosaic import GridSpec, create_grid
from services.radar.motion import STRIDE, estimate_frame_motion

RESOLUTION_M = 2000.0


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


def test_first_frame_reports_no_motion_and_stores_reference(make_settings) -> None:
    config = make_settings()
    motion = estimate_frame_motion(config, storm_grid(), frame_time=1_000_000)
    assert motion == {"x": 0.0, "y": 0.0}
    assert (config.mosaic_directory / "motion.npz").is_file()


def test_motion_is_reported_in_metres_per_second(make_settings) -> None:
    config = make_settings()
    elapsed = 300
    estimate_frame_motion(config, storm_grid(), frame_time=1_000_000)

    # Eight full-resolution cells east and eight north over five minutes.
    moved = storm_grid(shift_columns=2 * STRIDE, shift_rows=-2 * STRIDE)
    motion = estimate_frame_motion(config, moved, frame_time=1_000_000 + elapsed)

    expected = 2 * RESOLUTION_M * STRIDE / elapsed
    assert motion["x"] == expected
    # Grid rows run north to south, so a northward shift must report positive y.
    assert motion["y"] == expected


def test_stale_reference_is_ignored(make_settings) -> None:
    config = make_settings()
    estimate_frame_motion(config, storm_grid(), frame_time=1_000_000)
    motion = estimate_frame_motion(
        config, storm_grid(shift_columns=8), frame_time=1_000_000 + 100_000
    )
    assert motion == {"x": 0.0, "y": 0.0}
