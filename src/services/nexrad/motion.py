from __future__ import annotations

import logging

import numpy as np

from services.nexrad.mosaic import MosaicGrid, estimate_motion_cells
from services.nexrad.settings import ProducerSettings

LOGGER = logging.getLogger("orion.nexrad.motion")

# The reference grid is downsampled by this factor before correlating.
STRIDE = 4


def estimate_frame_motion(
    settings: ProducerSettings, grid: MosaicGrid, frame_time: int
) -> dict[str, float]:
    """Bulk echo motion since the previous frame, in metres per second.

    The reduced grid is kept beside the frame so the next cycle can correlate
    against it without re-ingesting the volumes. Downsampling keeps that file
    small and costs no accuracy the client can see: the vector is only used to
    slide the display a few kilometres between frames.
    """
    reduced = np.nan_to_num(grid.dbz[::STRIDE, ::STRIDE], nan=0.0).astype(np.float32)
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
                metres = settings.resolution_m * STRIDE
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
