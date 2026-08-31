from __future__ import annotations

from pathlib import Path

import mercantile
import numpy as np
from PIL import Image
from rasterio.transform import from_bounds, from_origin
from rasterio.warp import Resampling, reproject

from services.radar.mosaic import MosaicGrid

DBZ_STOPS = np.asarray([20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70])
# Alpha climbs with intensity so the map reads by weight as well as hue. The
# lowest band is deliberately faint: it is the noisiest part of the scale, and a
# neon 20 dBZ speck otherwise draws the eye harder than a 30 dBZ shower.
DBZ_COLORS = np.asarray(
    [
        [2, 253, 2, 105],
        [1, 197, 1, 140],
        [0, 142, 0, 170],
        [253, 248, 2, 195],
        [229, 188, 0, 210],
        [253, 149, 0, 225],
        [253, 0, 0, 235],
        [212, 0, 0, 240],
        [188, 0, 0, 245],
        [248, 0, 253, 250],
        [152, 84, 198, 255],
    ],
    dtype=np.uint8,
)


def colorize_dbz(dbz: np.ndarray) -> np.ndarray:
    rgba = np.zeros((*dbz.shape, 4), dtype=np.uint8)
    valid = np.isfinite(dbz) & (dbz >= DBZ_STOPS[0])
    indexes = np.searchsorted(DBZ_STOPS, dbz[valid], side="right") - 1
    indexes = np.clip(indexes, 0, len(DBZ_COLORS) - 1)
    rgba[valid] = DBZ_COLORS[indexes]
    return rgba


def render_tile(grid: MosaicGrid, tile: mercantile.Tile) -> np.ndarray:
    bounds = mercantile.xy_bounds(tile)
    destination = np.full((256, 256), np.nan, dtype=np.float32)
    reproject(
        source=grid.dbz,
        destination=destination,
        src_transform=from_origin(
            grid.min_x, grid.max_y, grid.resolution_m, grid.resolution_m
        ),
        src_crs="EPSG:3857",
        src_nodata=np.nan,
        dst_transform=from_bounds(
            bounds.left, bounds.bottom, bounds.right, bounds.top, 256, 256
        ),
        dst_crs="EPSG:3857",
        dst_nodata=np.nan,
        resampling=Resampling.bilinear,
    )
    return colorize_dbz(destination)


def _tile_has_visible_echo(grid: MosaicGrid, tile: mercantile.Tile) -> bool:
    bounds = mercantile.xy_bounds(tile)
    col_start = max(0, int((bounds.left - grid.min_x) / grid.resolution_m) - 1)
    col_end = min(
        grid.dbz.shape[1],
        int(np.ceil((bounds.right - grid.min_x) / grid.resolution_m)) + 1,
    )
    row_start = max(0, int((grid.max_y - bounds.top) / grid.resolution_m) - 1)
    row_end = min(
        grid.dbz.shape[0],
        int(np.ceil((grid.max_y - bounds.bottom) / grid.resolution_m)) + 1,
    )
    if row_start >= row_end or col_start >= col_end:
        return False
    window = grid.dbz[row_start:row_end, col_start:col_end]
    return bool(np.any(window >= DBZ_STOPS[0]))


def render_tile_pyramid(
    grid: MosaicGrid,
    frame_directory: Path,
    minimum_zoom: int,
    maximum_zoom: int,
) -> int:
    written = 0
    for tile in mercantile.tiles(
        grid.west,
        grid.south,
        grid.east,
        grid.north,
        zooms=range(minimum_zoom, maximum_zoom + 1),
    ):
        # A continental pyramid is mostly empty tiles; checking the source
        # window is far cheaper than reprojecting each one.
        if not _tile_has_visible_echo(grid, tile):
            continue
        rgba = render_tile(grid, tile)
        if not np.any(rgba[:, :, 3]):
            continue
        path = frame_directory / str(tile.z) / str(tile.x) / f"{tile.y}.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(rgba, mode="RGBA").save(path, format="PNG", optimize=True)
        written += 1
    return written
