from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
from pyproj import Transformer
from scipy.spatial import cKDTree

DECODED_FIELDS = (
    "reflectivity",
    "cross_correlation_ratio",
    "differential_reflectivity",
)


@dataclass(frozen=True)
class GateScan:
    station: str
    observed_at: datetime
    dbz: np.ndarray
    longitude: np.ndarray
    latitude: np.ndarray
    altitude_m: np.ndarray
    range_m: np.ndarray


@dataclass(frozen=True)
class GridSpec:
    west: float
    south: float
    east: float
    north: float
    resolution_m: float

    def __post_init__(self) -> None:
        if not (-180 <= self.west < self.east <= 180):
            raise ValueError("Invalid longitude bounds")
        if not (-85.0511 <= self.south < self.north <= 85.0511):
            raise ValueError("Invalid Web Mercator latitude bounds")
        if self.resolution_m <= 0:
            raise ValueError("resolution_m must be positive")


@dataclass
class MosaicGrid:
    dbz: np.ndarray
    west: float
    south: float
    east: float
    north: float
    min_x: float
    min_y: float
    max_x: float
    max_y: float
    resolution_m: float


def dual_pol_gate_mask(
    values: np.ndarray,
    correlation: np.ndarray,
    correlation_valid: np.ndarray,
    differential: np.ndarray,
    differential_valid: np.ndarray,
) -> np.ndarray:
    """Gates whose dual-pol signature is consistent with precipitation.

    RhoHV (correlation) measures how uniformly shaped the scatterers in a gate
    are, and ZDR (differential) how oblate; rain is uniform and near-spherical,
    while clutter, insects, and birds are neither.
    """
    return correlation_valid & (
        # Weak echo is where insects, birds, chaff, and ground clutter live, so
        # it has to look unambiguously like precipitation: near-unity RhoHV and
        # a raindrop's modest ZDR. Biological scatterers are irregular (lower
        # RhoHV) and highly oblate (ZDR > 3).
        (
            (values < 30)
            & (correlation >= 0.98)
            & differential_valid
            & (differential >= -1)
            & (differential <= 3)
        )
        | (
            (values >= 30)
            & (values < 45)
            & (correlation >= 0.95)
            & differential_valid
            & (differential >= -1.5)
            & (differential <= 4)
        )
        # Hail and melting mixtures genuinely depolarize, so intense echo gets a
        # relaxed RhoHV floor and no ZDR gate -- but never a free pass: ground
        # clutter and anomalous propagation are often the strongest returns in a
        # volume, and RhoHV is what separates them from a storm core.
        | ((values >= 45) & (correlation >= 0.85))
    )


def _lowest_reflectivity_sweep(volume: object, field_name: str) -> int | None:
    """Index of the lowest elevation sweep that actually carries reflectivity.

    Split cuts repeat an elevation for the Doppler moments and leave the
    reflectivity moment of the duplicate empty.
    """
    elevations = sorted(
        range(volume.nsweeps),  # type: ignore[attr-defined]
        key=lambda index: float(volume.fixed_angle["data"][index]),  # type: ignore[attr-defined]
    )
    return next(
        (
            index
            for index in elevations
            if np.ma.count(volume.get_field(index, field_name, copy=False))  # type: ignore[attr-defined]
        ),
        None,
    )


def extract_lowest_reflectivity(
    path: Path,
    station: str,
    maximum_range_km: float = 230,
) -> GateScan:
    import pyart

    # A NEXRAD volume carries seven moments; decoding only the three this
    # mosaic reads cuts peak memory per scan from roughly 460 MB to 70 MB,
    # which is what makes ingesting the full station list affordable.
    volume = pyart.io.read_nexrad_archive(str(path), include_fields=DECODED_FIELDS)
    field_name = next(
        (
            name
            for name in ("corrected_reflectivity", "reflectivity", "DBZ", "REF")
            if name in volume.fields
        ),
        None,
    )
    if field_name is None:
        raise ValueError(f"{path} contains no reflectivity field")

    sweep = _lowest_reflectivity_sweep(volume, field_name)
    if sweep is None:
        raise ValueError(f"{path} contains no usable reflectivity sweep")

    # Narrow to that one sweep before touching gate geometry. Deriving gate
    # positions from the full volume allocates well over a gigabyte per scan,
    # and every moment below is read from the lowest sweep only.
    radar = volume.extract_sweeps([sweep])
    del volume
    sweep = 0

    dbz = np.ma.asarray(radar.get_field(sweep, field_name, copy=False))
    latitude, longitude, altitude = radar.get_gate_lat_lon_alt(sweep)
    ranges = np.broadcast_to(
        np.asarray(radar.range["data"], dtype=np.float32), dbz.shape
    )
    values = np.asarray(dbz, dtype=np.float32)
    valid = (
        ~np.ma.getmaskarray(dbz)
        & np.isfinite(values)
        & (values >= -10)
        & (values <= 90)
        & (ranges <= maximum_range_km * 1_000)
    )
    if "cross_correlation_ratio" in radar.fields:
        correlation = np.ma.asarray(
            radar.get_field(sweep, "cross_correlation_ratio", copy=False)
        )
        correlation_values = np.asarray(correlation, dtype=np.float32)
        correlation_valid = ~np.ma.getmaskarray(correlation)
        differential_valid = np.ones_like(valid)
        if "differential_reflectivity" in radar.fields:
            differential = np.ma.asarray(
                radar.get_field(sweep, "differential_reflectivity", copy=False)
            )
            differential_values = np.asarray(differential, dtype=np.float32)
            differential_valid = ~np.ma.getmaskarray(differential)
        else:
            differential_values = np.zeros_like(values)
        valid &= dual_pol_gate_mask(
            values,
            correlation_values,
            correlation_valid,
            differential_values,
            differential_valid,
        )

    radar_time = pyart.util.datetime_from_radar(radar)
    observed_at = datetime(
        radar_time.year,
        radar_time.month,
        radar_time.day,
        radar_time.hour,
        radar_time.minute,
        radar_time.second,
        radar_time.microsecond,
        tzinfo=UTC,
    )

    return GateScan(
        station=station,
        observed_at=observed_at,
        dbz=values[valid],
        longitude=np.asarray(longitude, dtype=np.float64)[valid],
        latitude=np.asarray(latitude, dtype=np.float64)[valid],
        altitude_m=np.asarray(altitude, dtype=np.float32)[valid],
        range_m=ranges[valid],
    )


def create_grid(spec: GridSpec) -> MosaicGrid:
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    min_x, min_y = transformer.transform(spec.west, spec.south)
    max_x, max_y = transformer.transform(spec.east, spec.north)
    width = int(np.ceil((max_x - min_x) / spec.resolution_m))
    height = int(np.ceil((max_y - min_y) / spec.resolution_m))
    return MosaicGrid(
        dbz=np.full((height, width), np.nan, dtype=np.float32),
        west=spec.west,
        south=spec.south,
        east=spec.east,
        north=spec.north,
        min_x=min_x,
        min_y=min_y,
        max_x=max_x,
        max_y=max_y,
        resolution_m=spec.resolution_m,
    )


def add_scan_to_grid(grid: MosaicGrid, scan: GateScan, workers: int = 1) -> None:
    if scan.dbz.size == 0:
        return

    transformer = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    gate_x, gate_y = transformer.transform(scan.longitude, scan.latitude)
    inside = (
        (gate_x >= grid.min_x)
        & (gate_x <= grid.max_x)
        & (gate_y >= grid.min_y)
        & (gate_y <= grid.max_y)
    )
    if not np.any(inside):
        return

    gate_x = np.asarray(gate_x)[inside]
    gate_y = np.asarray(gate_y)[inside]
    dbz = scan.dbz[inside]
    ranges = scan.range_m[inside]
    # A cell center is at most resolution_m/sqrt(2) from a gate inside it, so a
    # 0.75 floor fills coverage without inflating isolated gates into blobs; the
    # range term bridges the widening azimuthal gate spacing far from the radar.
    support = np.maximum.reduce(
        (
            np.full_like(ranges, 0.75 * grid.resolution_m),
            0.6 * ranges * np.deg2rad(1.0),
            np.full_like(ranges, 750.0),
        )
    )

    col_start = max(
        0, int(np.floor((gate_x.min() - grid.min_x) / grid.resolution_m)) - 2
    )
    col_end = min(
        grid.dbz.shape[1],
        int(np.ceil((gate_x.max() - grid.min_x) / grid.resolution_m)) + 2,
    )
    row_start = max(
        0, int(np.floor((grid.max_y - gate_y.max()) / grid.resolution_m)) - 2
    )
    row_end = min(
        grid.dbz.shape[0],
        int(np.ceil((grid.max_y - gate_y.min()) / grid.resolution_m)) + 2,
    )
    if row_start >= row_end or col_start >= col_end:
        return

    columns = np.arange(col_start, col_end)
    rows = np.arange(row_start, row_end)
    target_x = grid.min_x + (columns + 0.5) * grid.resolution_m
    target_y = grid.max_y - (rows + 0.5) * grid.resolution_m
    mesh_x, mesh_y = np.meshgrid(target_x, target_y)

    tree = cKDTree(np.column_stack((gate_x, gate_y)))
    distance, indexes = tree.query(
        np.column_stack((mesh_x.ravel(), mesh_y.ravel())), workers=workers
    )
    shape = mesh_x.shape
    accepted = (distance <= support[indexes]).reshape(shape)
    candidate_dbz = dbz[indexes].reshape(shape)

    # Composite by maximum reflectivity, the convention for multi-radar mosaics:
    # a radar whose beam overshoots or undershoots a shower reports clear air at
    # the same cell, and selecting between radars by any per-gate score lets that
    # clear-air gate erase precipitation another radar genuinely observed.
    data_window = grid.dbz[row_start:row_end, col_start:col_end]
    replace = (
        accepted
        & np.isfinite(candidate_dbz)
        & (np.isnan(data_window) | (candidate_dbz > data_window))
    )
    data_window[replace] = candidate_dbz[replace]


def despeckle_grid(
    grid: MosaicGrid,
    display_floor: float = 20.0,
    minimum_cells: int = 8,
) -> None:
    """Drop echo clusters too small to be precipitation.

    Rain spans many cells at mosaic resolution, so an isolated speck is residual
    clutter, anomalous propagation, or biology that the gate filters missed.
    Intensity is deliberately not a reprieve: ground clutter is often the
    *strongest* return in a volume, so a lone cell claiming 50 dBZ is more
    suspect than a lone cell claiming 25, not less. Compositing by maximum over
    140-odd overlapping radars makes this essential, since one bad gate from any
    single station wins the cell outright.
    """
    from scipy import ndimage

    visible = np.isfinite(grid.dbz) & (grid.dbz >= display_floor)
    labels, count = ndimage.label(visible, structure=np.ones((3, 3), dtype=bool))
    if not count:
        return

    component_ids = np.arange(1, count + 1)
    sizes = ndimage.sum(visible, labels, component_ids)
    remove = component_ids[sizes < minimum_cells]
    if remove.size:
        grid.dbz[np.isin(labels, remove)] = np.nan


def estimate_motion_cells(
    previous: np.ndarray,
    current: np.ndarray,
    maximum_shift_cells: float = 40.0,
) -> tuple[float, float]:
    """Estimate bulk echo motion between two grids, in cells (east, south).

    Phase correlation over the whole scene: the peak of the inverse transform of
    the normalised cross-power spectrum sits at the translation that best aligns
    the two frames. This captures the prevailing drift, which is what advecting
    the display between frames needs; it does not model rotation or growth.
    """
    before = np.nan_to_num(previous, nan=0.0)
    after = np.nan_to_num(current, nan=0.0)
    if not before.any() or not after.any():
        return (0.0, 0.0)

    # Hann window in both axes so the scene edges do not ring in the transform.
    rows, columns = before.shape
    window = np.outer(np.hanning(rows), np.hanning(columns))
    first = np.fft.rfft2(before * window)
    second = np.fft.rfft2(after * window)
    # second * conj(first) puts the peak at the previous -> current shift; the
    # opposite order measures the motion backwards in time.
    cross = second * np.conj(first)
    magnitude = np.abs(cross)
    magnitude[magnitude == 0] = 1.0
    correlation = np.fft.irfft2(cross / magnitude, s=before.shape)

    peak = np.unravel_index(int(np.argmax(correlation)), correlation.shape)
    shift_rows = peak[0] if peak[0] <= rows // 2 else peak[0] - rows
    shift_columns = peak[1] if peak[1] <= columns // 2 else peak[1] - columns
    if (
        abs(shift_rows) > maximum_shift_cells
        or abs(shift_columns) > maximum_shift_cells
    ):
        return (0.0, 0.0)
    return (float(shift_columns), float(shift_rows))


def composite_scans(scans: list[GateScan], spec: GridSpec) -> MosaicGrid:
    grid = create_grid(spec)
    for scan in scans:
        add_scan_to_grid(grid, scan)
    despeckle_grid(grid)
    return grid
