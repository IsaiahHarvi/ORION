from __future__ import annotations

import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

LOGGER = logging.getLogger("orion.quakes")

# USGS publishes these as pre-generated, CDN-cached files rather than running a
# query per request, so they are the cheap thing to ask for -- and the only
# combinations that exist.
WINDOWS = ("hour", "day", "week", "month")
MAGNITUDES = ("all", "1.0", "2.5", "4.5", "significant")

FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{magnitude}_{window}.geojson"
USER_AGENT = "ORION/1.0 (+https://orion.harville.dev)"


@dataclass(frozen=True)
class FeedKey:
    window: str
    magnitude: str


class FeedError(RuntimeError):
    """The upstream feed could not be read and nothing cached can stand in."""


class _Entry:
    __slots__ = ("fetched_at", "payload")

    def __init__(self, payload: dict[str, Any], fetched_at: float) -> None:
        self.payload = payload
        self.fetched_at = fetched_at


# One cache for the whole process. USGS regenerates the summary feeds about once
# a minute, so polling faster returns identical bytes; caching here means a
# thousand browsers cost the same upstream traffic as one.
_CACHE: dict[FeedKey, _Entry] = {}
_LOCK = threading.Lock()


def cache_ttl_seconds() -> float:
    return float(os.environ.get("ORION_QUAKES_CACHE_SECONDS", "60"))


def _request(url: str, timeout: float) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read())


def _normalise(document: dict[str, Any]) -> list[dict[str, Any]]:
    """Flatten the GeoJSON into the fields the map actually draws.

    The raw feed carries roughly thirty properties per event; sending only these
    keeps a busy month-long feed to a few hundred kilobytes.
    """
    quakes: list[dict[str, Any]] = []
    for feature in document.get("features", []):
        properties = feature.get("properties") or {}
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates") or []
        if len(coordinates) < 2:
            continue
        magnitude = properties.get("mag")
        if magnitude is None:
            continue
        quakes.append(
            {
                "id": feature.get("id"),
                # USGS reports milliseconds since the epoch.
                "time": properties.get("time"),
                "magnitude": magnitude,
                "place": properties.get("place"),
                "longitude": coordinates[0],
                "latitude": coordinates[1],
                "depth_km": coordinates[2] if len(coordinates) > 2 else None,
                "url": properties.get("url"),
                "felt": properties.get("felt"),
                "tsunami": bool(properties.get("tsunami")),
                "significance": properties.get("sig"),
                "alert": properties.get("alert"),
            }
        )
    quakes.sort(key=lambda quake: quake["time"] or 0, reverse=True)
    return quakes


def fetch_quakes(key: FeedKey, timeout: float = 10.0) -> dict[str, Any]:
    """The normalised feed for one window/magnitude, cached for the TTL.

    A stale entry is served if the upstream fetch fails: a USGS blip should
    leave the map showing slightly old earthquakes rather than nothing.
    """
    now = time.monotonic()
    with _LOCK:
        entry = _CACHE.get(key)
        if entry and now - entry.fetched_at < cache_ttl_seconds():
            return entry.payload

    url = FEED_URL.format(magnitude=key.magnitude, window=key.window)
    try:
        document = _request(url, timeout)
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        with _LOCK:
            stale = _CACHE.get(key)
        if stale is not None:
            LOGGER.warning("USGS fetch failed (%s); serving cached feed", error)
            return stale.payload
        raise FeedError(str(error)) from error

    payload = {
        "window": key.window,
        "min_magnitude": key.magnitude,
        "generated_at": (document.get("metadata") or {}).get("generated"),
        "attribution": {
            "text": "Earthquake data: USGS Earthquake Hazards Program",
            "url": "https://earthquake.usgs.gov/",
        },
        "quakes": _normalise(document),
    }
    payload["count"] = len(payload["quakes"])

    with _LOCK:
        _CACHE[FeedKey(key.window, key.magnitude)] = _Entry(payload, time.monotonic())
    return payload


def reset_cache() -> None:
    with _LOCK:
        _CACHE.clear()
