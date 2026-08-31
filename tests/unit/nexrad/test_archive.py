from datetime import UTC, datetime, timedelta

from services.nexrad.archive import (
    ScanObject,
    parse_scan_object,
    select_synchronized_scans,
)


def scan(station: str, minute: int) -> ScanObject:
    observed_at = datetime(2026, 8, 29, 12, minute, tzinfo=UTC)
    return ScanObject(
        station=station,
        observed_at=observed_at,
        key=f"2026/08/29/{station}/{station}20260829_12{minute:02d}00_V06",
        size=100,
    )


def test_parse_scan_object_rejects_metadata() -> None:
    parsed = parse_scan_object("2026/08/29/KOHX/KOHX20260829_120045_V06", 123)
    assert parsed == ScanObject(
        station="KOHX",
        observed_at=datetime(2026, 8, 29, 12, 0, 45, tzinfo=UTC),
        key="2026/08/29/KOHX/KOHX20260829_120045_V06",
        size=123,
    )
    assert parse_scan_object("2026/08/29/KOHX/KOHX20260829_120045_V06_MDM") is None


def test_select_synchronized_scans_finds_overlapping_window() -> None:
    anchor, selected = select_synchronized_scans(
        {"KOHX": [scan("KOHX", 0)], "KHTX": [scan("KHTX", 4)]},
        cutoff=datetime(2026, 8, 29, 12, 5, tzinfo=UTC),
        tolerance=timedelta(minutes=4),
        minimum_stations=2,
    )
    assert anchor == datetime(2026, 8, 29, 12, 4, tzinfo=UTC)
    assert set(selected) == {"KOHX", "KHTX"}


def test_select_synchronized_scans_enforces_minimum() -> None:
    try:
        select_synchronized_scans(
            {"KOHX": [scan("KOHX", 0)]},
            cutoff=datetime(2026, 8, 29, 12, 0, tzinfo=UTC),
            tolerance=timedelta(minutes=2),
            minimum_stations=2,
        )
    except RuntimeError as error:
        assert "need 2" in str(error)
    else:
        raise AssertionError("Expected insufficient synchronized stations to fail")


def test_select_prefers_a_newer_anchor_over_the_last_few_stations() -> None:
    # Nine stations have reported at :10, all ten at :00. Waiting for the tenth
    # would make the whole mosaic ten minutes old.
    scans_by_station = {f"K{i:02d}": [scan(f"K{i:02d}", 0)] for i in range(10)}
    for i in range(9):
        scans_by_station[f"K{i:02d}"].append(scan(f"K{i:02d}", 10))

    anchor, selected = select_synchronized_scans(
        scans_by_station,
        cutoff=datetime(2026, 8, 29, 12, 20, tzinfo=UTC),
        tolerance=timedelta(minutes=2),
        minimum_stations=2,
    )
    assert anchor.minute == 10
    assert len(selected) == 9


def test_select_will_not_trade_away_most_of_the_coverage() -> None:
    # One lone station five minutes ahead is not a mosaic; the fuller, older
    # anchor still wins.
    scans_by_station = {f"K{i:02d}": [scan(f"K{i:02d}", 0)] for i in range(10)}
    scans_by_station["K00"].append(scan("K00", 5))

    anchor, selected = select_synchronized_scans(
        scans_by_station,
        cutoff=datetime(2026, 8, 29, 12, 20, tzinfo=UTC),
        tolerance=timedelta(minutes=2),
        minimum_stations=2,
    )
    assert anchor.minute == 0
    assert len(selected) == 10
