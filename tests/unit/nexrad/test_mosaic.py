from datetime import UTC, datetime

import numpy as np

from services.nexrad.mosaic import (
    GateScan,
    GridSpec,
    add_scan_to_grid,
    create_grid,
    despeckle_grid,
    dual_pol_gate_mask,
)
from services.nexrad.tiles import colorize_dbz

ANCHOR = datetime(2026, 8, 29, 12, tzinfo=UTC)


def gate_scan(station: str, dbz: float, altitude_m: float) -> GateScan:
    return GateScan(
        station=station,
        observed_at=ANCHOR,
        dbz=np.asarray([dbz], dtype=np.float32),
        longitude=np.asarray([0.0]),
        latitude=np.asarray([0.0]),
        altitude_m=np.asarray([altitude_m], dtype=np.float32),
        range_m=np.asarray([10_000], dtype=np.float32),
    )


def test_overlapping_radars_composite_maximum_reflectivity() -> None:
    grid = create_grid(GridSpec(-0.02, -0.02, 0.02, 0.02, 1_000))
    add_scan_to_grid(grid, gate_scan("HIGH", 70, 2_000))
    add_scan_to_grid(grid, gate_scan("LOW", 25, 500))
    assert np.nanmax(grid.dbz) == 70


def test_clear_air_gate_does_not_erase_observed_precipitation() -> None:
    grid = create_grid(GridSpec(-0.02, -0.02, 0.02, 0.02, 1_000))
    add_scan_to_grid(grid, gate_scan("RAIN", 40, 2_000))
    add_scan_to_grid(grid, gate_scan("CLEAR", 2, 500))
    assert np.nanmax(grid.dbz) == 40


def test_despeckle_removes_small_clusters_at_any_intensity() -> None:
    grid = create_grid(GridSpec(-0.2, -0.2, 0.2, 0.2, 1_000))
    grid.dbz[5, 5] = 25  # lone weak speckle
    grid.dbz[15, 15] = 60  # lone intense speckle: clutter, not a storm core
    grid.dbz[25, 25] = 25  # two-cell cluster
    grid.dbz[25, 26] = 22
    grid.dbz[35, 35:44] = 25  # coherent light shower: kept
    despeckle_grid(grid)
    assert np.isnan(grid.dbz[5, 5])
    assert np.isnan(grid.dbz[15, 15])
    assert np.isnan(grid.dbz[25, 25])
    assert np.isnan(grid.dbz[25, 26])
    assert np.all(grid.dbz[35, 35:44] == 25)


def test_despeckle_keeps_a_compact_storm_core() -> None:
    grid = create_grid(GridSpec(-0.2, -0.2, 0.2, 0.2, 1_000))
    grid.dbz[40:44, 40:44] = 55  # 16 cells of intense echo
    despeckle_grid(grid)
    assert np.all(grid.dbz[40:44, 40:44] == 55)


def gate_mask(dbz: float, rhohv: float, zdr: float) -> bool:
    ones = np.asarray([True])
    return bool(
        dual_pol_gate_mask(
            np.asarray([dbz], dtype=np.float32),
            np.asarray([rhohv], dtype=np.float32),
            ones,
            np.asarray([zdr], dtype=np.float32),
            ones,
        )[0]
    )


def test_light_rain_passes_quality_control() -> None:
    assert gate_mask(dbz=22, rhohv=0.995, zdr=0.4)


def test_biological_scatter_is_rejected() -> None:
    # Insects and birds: irregular shapes depress RhoHV and raise ZDR.
    assert not gate_mask(dbz=22, rhohv=0.93, zdr=0.5)
    assert not gate_mask(dbz=22, rhohv=0.99, zdr=4.5)
    assert not gate_mask(dbz=35, rhohv=0.92, zdr=0.5)


def test_hail_core_passes_despite_depolarisation() -> None:
    assert gate_mask(dbz=58, rhohv=0.88, zdr=0.2)


def test_intense_ground_clutter_is_rejected() -> None:
    # The pre-v8 rule passed any gate >= 45 dBZ regardless of RhoHV, which let
    # clutter and anomalous propagation render as fake storm cores.
    assert not gate_mask(dbz=58, rhohv=0.56, zdr=2.0)


def test_colorize_dbz_masks_noise_and_assigns_palette() -> None:
    rgba = colorize_dbz(np.asarray([[np.nan, 19.9, 20.0, 70.0]], dtype=np.float32))
    assert rgba[0, 0, 3] == 0
    assert rgba[0, 1, 3] == 0
    assert rgba[0, 2, 3] > 0
    assert rgba[0, 3, 3] == 255
