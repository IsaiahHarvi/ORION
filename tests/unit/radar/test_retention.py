import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from services.radar import producer as producer_module
from services.radar.archive import ScanObject
from services.radar.producer import (
    ProducerSettings,
    _download_and_extract,
    _prune_raw_scans,
    _prune_superseded_frames,
)


def settings(tmp_path: Path, retention_seconds: int = 1800) -> ProducerSettings:
    return ProducerSettings(
        bucket="unused",
        stations=("KOHX",),
        bounds=(-91.5, 33.0, -81.0, 39.0),
        resolution_m=2000.0,
        minimum_zoom=4,
        maximum_zoom=9,
        ingest_lag=timedelta(seconds=600),
        scan_window=timedelta(seconds=1800),
        scan_tolerance=timedelta(seconds=240),
        minimum_stations=2,
        maximum_range_km=230,
        interval_seconds=300,
        retained_frames=13,
        ingest_workers=8,
        compute_workers=2,
        keep_raw_scans=False,
        raw_retention=timedelta(seconds=retention_seconds),
        raw_directory=tmp_path / "raw",
        mosaic_directory=tmp_path,
    )


def scan(root: Path, station: str, name: str, age_seconds: float) -> Path:
    path = root / station / "20260830" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"volume")
    stamp = time.time() - age_seconds
    import os

    os.utime(path, (stamp, stamp))
    return path


def fake_ingest(tmp_path: Path, monkeypatch, *, decode_fails: bool = False):
    """Stand in for the S3 download and pyart decode around the delete."""
    downloaded = tmp_path / "raw" / "KOHX" / "20260830" / "KOHX20260830_000000_V06"

    def download(_client, _bucket, _scan, _cache):
        downloaded.parent.mkdir(parents=True, exist_ok=True)
        downloaded.write_bytes(b"volume")
        return downloaded

    def extract(_path, _station, _range):
        if decode_fails:
            raise ValueError("corrupt volume")
        return "gate-scan"

    monkeypatch.setattr(producer_module, "download_scan", download)
    monkeypatch.setattr(producer_module, "extract_lowest_reflectivity", extract)
    return downloaded


SCAN = ScanObject("KOHX", datetime(2026, 8, 30, tzinfo=UTC), "key", 6)


def test_volume_is_deleted_once_decoded(tmp_path: Path, monkeypatch) -> None:
    config = settings(tmp_path)
    path = fake_ingest(tmp_path, monkeypatch)
    assert _download_and_extract(None, config, SCAN) == "gate-scan"
    assert not path.exists()


def test_volume_is_deleted_even_when_decoding_fails(tmp_path: Path, monkeypatch) -> None:
    config = settings(tmp_path)
    path = fake_ingest(tmp_path, monkeypatch, decode_fails=True)
    with pytest.raises(ValueError):
        _download_and_extract(None, config, SCAN)
    # A corrupt volume must not be the one file that survives every cycle.
    assert not path.exists()


def test_volume_is_kept_when_configured(tmp_path: Path, monkeypatch) -> None:
    config = settings(tmp_path)
    object.__setattr__(config, "keep_raw_scans", True)
    path = fake_ingest(tmp_path, monkeypatch)
    _download_and_extract(None, config, SCAN)
    assert path.is_file()


def test_prune_removes_only_scans_past_retention(tmp_path: Path) -> None:
    config = settings(tmp_path)
    fresh = scan(config.raw_directory, "KOHX", "fresh_V06", age_seconds=60)
    stale = scan(config.raw_directory, "KHTX", "stale_V06", age_seconds=7200)

    _prune_raw_scans(config)

    assert fresh.is_file()
    assert not stale.exists()
    # The cache root must survive so the next download does not have to recreate it.
    assert config.raw_directory.is_dir()


def test_prune_is_disabled_by_zero_retention(tmp_path: Path) -> None:
    config = settings(tmp_path, retention_seconds=0)
    stale = scan(config.raw_directory, "KOHX", "stale_V06", age_seconds=7200)
    _prune_raw_scans(config)
    assert stale.is_file()


def test_superseded_frames_are_removed_once_aged(tmp_path: Path) -> None:
    frames = tmp_path / "frames"
    frames.mkdir()
    current = frames / "1788000000-aaaaaaaa"
    old = frames / "1788000000-bbbbbbbb"
    recent_other = frames / "1788000001-cccccccc"
    for directory in (current, old, recent_other):
        directory.mkdir()
        (directory / "metadata.json").write_text("{}")

    import os

    stamp = time.time() - 7200
    os.utime(old, (stamp, stamp))

    _prune_superseded_frames(frames, "-aaaaaaaa")

    assert current.is_dir()
    assert not old.exists()
    # A concurrent producer's fresh output is left alone by the age guard.
    assert recent_other.is_dir()
