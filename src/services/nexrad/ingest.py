from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Any

from services.nexrad.archive import ScanObject, download_scan, list_scans
from services.nexrad.mosaic import GateScan, extract_lowest_reflectivity
from services.nexrad.settings import ProducerSettings

LOGGER = logging.getLogger("orion.nexrad.ingest")

# Listing is latency-bound rather than CPU-bound, but a pool much wider than
# this stops paying for itself against a single S3 endpoint.
MAXIMUM_LISTING_WORKERS = 12


def list_station_scans(
    client: Any, settings: ProducerSettings, start: datetime, cutoff: datetime
) -> dict[str, list[ScanObject]]:
    """Available scans per station in the window, empty for stations that fail.

    One unreachable station must not cost the whole frame, so listing errors are
    logged and left as no scans; the synchronized-scan selection then works with
    whatever stations did answer.
    """
    result: dict[str, list[ScanObject]] = {}
    workers = min(MAXIMUM_LISTING_WORKERS, len(settings.stations))
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(
                list_scans, client, settings.bucket, station, start, cutoff
            ): station
            for station in settings.stations
        }
        for future in as_completed(futures):
            station = futures[future]
            try:
                result[station] = future.result()
            except Exception:
                LOGGER.exception("Could not list scans for %s", station)
                result[station] = []
    return result


def download_and_extract(
    client: Any, settings: ProducerSettings, scan: ScanObject
) -> GateScan:
    path = download_scan(client, settings.bucket, scan, settings.raw_directory)
    try:
        return extract_lowest_reflectivity(
            path, scan.station, settings.maximum_range_km
        )
    finally:
        # A volume is only ever read once, right here, so releasing it now caps
        # the cache at the scans currently in flight rather than a full cycle's
        # worth per station. Consecutive frames do share about a fifth of their
        # scans, so this trades a modest amount of re-downloading for roughly
        # two orders of magnitude less disk.
        if not settings.keep_raw_scans:
            path.unlink(missing_ok=True)
