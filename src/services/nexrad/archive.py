from __future__ import annotations

import os
import re
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

_SCAN_NAME = re.compile(
    r"^(?P<station>[A-Z0-9]{4})(?P<day>\d{8})_(?P<time>\d{6})_V\d{2}(?:\..+)?$"
)


@dataclass(frozen=True)
class ScanObject:
    station: str
    observed_at: datetime
    key: str
    size: int


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

    best: tuple[tuple[int, float, float], datetime, dict[str, ScanObject]] | None = None
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
        score = (len(selected), anchor.timestamp(), -max_skew)
        if best is None or score > best[0]:
            best = (score, anchor, selected)

    if best is None or len(best[2]) < minimum_stations:
        raise RuntimeError(
            f"Only {0 if best is None else len(best[2])} synchronized stations available; "
            f"need {minimum_stations}"
        )
    return best[1], best[2]


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
    client.download_file(bucket, scan.key, str(temporary))
    os.replace(temporary, destination)
    return destination
