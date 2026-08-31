import pytest

from services.nexrad.settings import ProducerSettings, load_all_stations

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


def _minimal_env(monkeypatch) -> None:
    monkeypatch.setenv("ORION_RADAR_STATIONS", "KOHX,KHTX")
    for name in (
        "ORION_RADAR_INTERVAL_SECONDS",
        "ORION_RADAR_HISTORY_HOURS",
        "ORION_RADAR_RETAINED_FRAMES",
        "ORION_CPU_LIMIT",
        "ORION_CPU_REQUEST",
    ):
        monkeypatch.delenv(name, raising=False)


def test_history_defaults_to_six_hours_of_frames(monkeypatch) -> None:
    _minimal_env(monkeypatch)
    settings = ProducerSettings.from_environment()
    assert settings.retained_frames * settings.interval_seconds == 6 * 3600


def test_history_holds_when_the_interval_changes(monkeypatch) -> None:
    _minimal_env(monkeypatch)
    monkeypatch.setenv("ORION_RADAR_INTERVAL_SECONDS", "600")
    settings = ProducerSettings.from_environment()
    assert settings.retained_frames == 36


def test_explicit_frame_count_still_wins(monkeypatch) -> None:
    _minimal_env(monkeypatch)
    monkeypatch.setenv("ORION_RADAR_RETAINED_FRAMES", "13")
    assert ProducerSettings.from_environment().retained_frames == 13


def test_worker_pools_size_from_the_injected_cpu_allocation(monkeypatch) -> None:
    _minimal_env(monkeypatch)
    monkeypatch.setenv("ORION_CPU_LIMIT", "4")
    settings = ProducerSettings.from_environment()
    assert settings.compute_workers == 4
    # Ingest is S3-bound, so it oversubscribes the allocation on purpose.
    assert settings.ingest_workers == 12
