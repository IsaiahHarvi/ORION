import pytest

from services.radar.settings import load_all_stations

CONUS = (-125.0, 24.0, -66.5, 49.5)


def test_all_station_mode_covers_conus() -> None:
    stations = load_all_stations(CONUS)
    assert len(stations) > 130
    assert {"KOKX", "KSOX", "KOHX", "KTYX", "KGRK"} <= set(stations)
    # Alaska, Hawaii, Puerto Rico, and overseas sites are outside the bounds.
    assert not {"PAPD", "PHKI", "TJUA", "RODN"} & set(stations)


def test_all_station_mode_includes_in_range_sites_just_outside_bounds() -> None:
    stations = load_all_stations((-87.0, 35.0, -85.0, 37.0))
    assert "KOHX" in stations  # inside the box
    assert "KHTX" in stations  # south of the box but within radar range
    assert "KJAX" not in stations


def test_all_station_mode_rejects_uncovered_bounds() -> None:
    with pytest.raises(ValueError):
        load_all_stations((-40.0, 10.0, -35.0, 15.0))
