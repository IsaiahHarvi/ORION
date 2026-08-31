from __future__ import annotations

import os
import re
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

# The share of the best-available station coverage a frame must still reach to
# be preferred for being newer. At 0.9 a frame gives up at most a tenth of the
# stations to stop trailing the late ones.
COVERAGE_TOLERANCE = 0.9

_SCAN_NAME = re.compile(
    r"^(?P<station>[A-Z0-9]{4})(?P<day>\d{8})_(?P<time>\d{6})_V\d{2}(?:\..+)?$"
)


@dataclass(frozen=True)
class ScanObject:
    station: str
    observed_at: datetime
    key: str
    size: int


# Byte-range streams boto opens per scan. Volumes are 10-25 MB and a single
# stream tops out well below the link, so a few parallel ranges roughly triples
# per-file throughput; more than this stops paying and multiplies the sockets
# every ingest worker needs at once.
DOWNLOAD_STREAMS = 4


def create_s3_client(max_pool_connections: int = 32) -> Any:
    import boto3
    from botocore import UNSIGNED
    from botocore.config import Config

    return boto3.client(
        "s3",
        config=Config(
            signature_version=UNSIGNED,
            retries={"mode": "adaptive", "max_attempts": 8},
            # The default pool of 10 is smaller than the listing and download
            # pools that share this client, and every connection past it is
            # discarded and re-established -- which dominated ingest time.
            max_pool_connections=max_pool_connections,
        ),
    )


def parse_scan_object(key: str, size: int = 0) -> ScanObject | None:
    name = key.rsplit("/", 1)[-1]
    if name.endswith("_MDM") or "_MDM." in name:
        return None

    match = _SCAN_NAME.match(name)
    if not match:
        return None

    observed_at = datetime.strptime(
        f"{match.group('day')}{match.group('time')}", "%Y%m%d%H%M%S"
    ).replace(tzinfo=UTC)
    return ScanObject(match.group("station"), observed_at, key, size)


def _dates_between(start: datetime, end: datetime) -> list[date]:
    current = start.date()
    result: list[date] = []
    while current <= end.date():
        result.append(current)
        current += timedelta(days=1)
    return result


def list_scans(
    client: Any,
    bucket: str,
    station: str,
    start: datetime,
    end: datetime,
) -> list[ScanObject]:
    scans: list[ScanObject] = []
    paginator = client.get_paginator("list_objects_v2")

    for day in _dates_between(start, end):
        prefix = f"{day:%Y/%m/%d}/{station}/"
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for item in page.get("Contents", []):
                scan = parse_scan_object(item["Key"], int(item.get("Size", 0)))
                if scan and start <= scan.observed_at <= end:
                    scans.append(scan)

    return sorted(scans, key=lambda scan: scan.observed_at)


def select_synchronized_scans(
    scans_by_station: dict[str, list[ScanObject]],
    cutoff: datetime,
    tolerance: timedelta,
    minimum_stations: int,
) -> tuple[datetime, dict[str, ScanObject]]:
    candidates: set[datetime] = set()
    for scans in scans_by_station.values():
        for scan in scans:
            if scan.observed_at <= cutoff:
                candidates.add(scan.observed_at)

    options: list[tuple[datetime, dict[str, ScanObject], float]] = []
    for anchor in candidates:
        selected: dict[str, ScanObject] = {}
        for station, scans in scans_by_station.items():
            if not scans:
                continue
            nearest = min(scans, key=lambda scan: abs(scan.observed_at - anchor))
            if abs(nearest.observed_at - anchor) <= tolerance:
                selected[station] = nearest

        if not selected:
            continue
        max_skew = max(
            abs((scan.observed_at - anchor).total_seconds())
            for scan in selected.values()
        )
        options.append((anchor, selected, max_skew))

    usable = [option for option in options if len(option[1]) >= minimum_stations]
    if not usable:
        widest = max((len(option[1]) for option in options), default=0)
        raise RuntimeError(
            f"Only {widest} synchronized stations available; need {minimum_stations}"
        )

    # Stations do not scan in step: a volume takes about five minutes and each
    # site starts when it starts, so the newest instant every station has
    # already reported is always well behind the newest instant most of them
    # have. Maximising coverage outright therefore buys the last few percent of
    # stations with ten minutes of staleness across the whole mosaic. Accept any
    # anchor within COVERAGE_TOLERANCE of the best coverage and take the newest
    # of those instead, so the map is current and a handful of late sites are
    # simply absent from this frame.
    widest = max(len(option[1]) for option in usable)
    threshold = max(minimum_stations, int(widest * COVERAGE_TOLERANCE))
    fresh = [option for option in usable if len(option[1]) >= threshold]
    anchor, selected, _ = max(fresh, key=lambda option: (option[0], -option[2]))
    return anchor, selected


def _transfer_config() -> Any:
    """Bound the streams per download so the shared connection pool can cover
    every worker. Left to its own defaults boto opens ten per file, which for a
    two-dozen-worker ingest is ten times the connections the pool holds -- and
    every request past the pool is a connection discarded and reopened."""
    from boto3.s3.transfer import TransferConfig

    return TransferConfig(
        multipart_threshold=4 * 1024 * 1024,
        multipart_chunksize=4 * 1024 * 1024,
        max_concurrency=DOWNLOAD_STREAMS,
    )


def download_scan(client: Any, bucket: str, scan: ScanObject, cache_dir: Path) -> Path:
    destination = (
        cache_dir
        / scan.station
        / f"{scan.observed_at:%Y%m%d}"
        / scan.key.rsplit("/", 1)[-1]
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.is_file() and (
        scan.size == 0 or destination.stat().st_size == scan.size
    ):
        return destination

    temporary = destination.with_name(f".{destination.name}.{os.getpid()}.part")
    client.download_file(bucket, scan.key, str(temporary), Config=_transfer_config())
    os.replace(temporary, destination)
    return destination
