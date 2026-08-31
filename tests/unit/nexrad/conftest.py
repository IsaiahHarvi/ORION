from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest

from services.radar.settings import ProducerSettings

DEFAULTS: dict[str, Any] = {
    "bucket": "unused",
    "stations": ("KOHX",),
    "bounds": (-91.5, 33.0, -81.0, 39.0),
    "resolution_m": 2000.0,
    "minimum_zoom": 4,
    "maximum_zoom": 9,
    "ingest_lag": timedelta(seconds=600),
    "scan_window": timedelta(seconds=1800),
    "scan_tolerance": timedelta(seconds=240),
    "minimum_stations": 2,
    "maximum_range_km": 230,
    "interval_seconds": 300,
    "retained_frames": 13,
    "ingest_workers": 8,
    "compute_workers": 2,
    "keep_raw_scans": False,
    "raw_retention": timedelta(seconds=1800),
}


@pytest.fixture
def make_settings(tmp_path: Path):
    """Build ProducerSettings rooted at tmp_path, overriding any field by name."""

    def build(**overrides: Any) -> ProducerSettings:
        fields = {
            **DEFAULTS,
            "raw_directory": tmp_path / "raw",
            "mosaic_directory": tmp_path,
            **overrides,
        }
        return ProducerSettings(**fields)

    return build
