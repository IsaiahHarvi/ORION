from __future__ import annotations

import json
import logging
import math
import os
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

LOGGER = logging.getLogger("orion.adsb")

# adsb.lol aggregates a volunteer receiver network and serves it without an API
# key or account, which is what makes it usable from a self-hosted ORION that
# has no credentials to hand out. Overridable because the same route shape is
# served by airplanes.live and by a private readsb instance.
BASE_URL = os.environ.get("ORION_ADSB_BASE_URL", "https://api.adsb.lol/v2")
USER_AGENT = "ORION/1.0 (+https://orion.harville.dev)"

# The upstream caps a query at 250 nautical miles, so asking for more is an
# error rather than a wider answer.
MAX_RADIUS_NM = 250
DEFAULT_RADIUS_NM = 150

# Aircraft positions are quantised before they become a cache key. Two browsers
# panned a few hundred metres apart are looking at the same sky, and without
# this every pixel of map movement would be a fresh upstream request.
GRID_DEGREES = 0.25


@dataclass(frozen=True)
class FeedKey:
    lat: float
    lon: float
    radius_nm: int


class FeedError(RuntimeError):
    """The upstream feed could not be read and nothing cached can stand in."""


class _Entry:
    __slots__ = ("fetched_at", "payload")

    def __init__(self, payload: dict[str, Any], fetched_at: float) -> None:
        self.payload = payload
        self.fetched_at = fetched_at


_CACHE: dict[FeedKey, _Entry] = {}
_LOCK = threading.Lock()


def cache_ttl_seconds() -> float:
    """How long one upstream answer is reused.

    Shorter than the earthquake feed because a jet at 500 knots moves about two
    nautical miles in fifteen seconds -- roughly a marker's width on a regional
    view, so a longer TTL would show visibly lagging traffic.
    """
    return float(os.environ.get("ORION_ADSB_CACHE_SECONDS", "15"))


def cache_key(lat: float, lon: float, radius_nm: int) -> FeedKey:
    """Snap a viewport to the shared grid so nearby clients share one fetch."""
    return FeedKey(
        lat=round(lat / GRID_DEGREES) * GRID_DEGREES,
        lon=round(lon / GRID_DEGREES) * GRID_DEGREES,
        radius_nm=radius_nm,
    )


def _request(url: str, timeout: float) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read())


def _number(value: Any) -> float | None:
    """Coerce a numeric field, tolerating the feed's string sentinels.

    Barometric altitude in particular arrives as the string "ground" for an
    aircraft that is not flying.
    """
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _normalise(document: dict[str, Any]) -> list[dict[str, Any]]:
    """Flatten to the fields the map draws.

    The raw records carry forty-odd signal-integrity fields per aircraft; a busy
    250 nm query is megabytes of them and kilobytes of what is actually shown.
    """
    aircraft: list[dict[str, Any]] = []
    for entry in document.get("ac") or []:
        lat = _number(entry.get("lat"))
        lon = _number(entry.get("lon"))
        if lat is None or lon is None:
            continue
        # The ICAO 24-bit address is the only identifier every aircraft has;
        # callsign and registration are both frequently absent.
        icao = (entry.get("hex") or "").strip()
        if not icao:
            continue
        callsign = (entry.get("flight") or "").strip() or None
        altitude = entry.get("alt_baro")
        aircraft.append(
            {
                "id": icao,
                "callsign": callsign,
                "registration": (entry.get("r") or "").strip() or None,
                "aircraft_type": (entry.get("t") or "").strip() or None,
                "latitude": lat,
                "longitude": lon,
                # "ground" rather than a number means the aircraft is on the
                # surface; the map draws that differently from an unknown level.
                "altitude_ft": _number(altitude),
                "on_ground": altitude == "ground",
                "ground_speed_kt": _number(entry.get("gs")),
                "track_deg": _number(entry.get("track")),
                "vertical_rate_fpm": _number(
                    entry.get("baro_rate") or entry.get("geom_rate")
                ),
                "squawk": entry.get("squawk"),
                "emergency": (
                    entry.get("emergency")
                    if entry.get("emergency") not in (None, "none")
                    else None
                ),
                # Seconds since this position was last heard, so the client can
                # fade contacts that have gone quiet.
                "seen_pos_s": _number(entry.get("seen_pos")),
                "distance_nm": _number(entry.get("dst")),
            }
        )
    aircraft.sort(key=lambda item: item["distance_nm"] or math.inf)
    return aircraft


def fetch_aircraft(key: FeedKey, timeout: float = 10.0) -> dict[str, Any]:
    """Aircraft near a point, cached for the TTL.

    A stale entry is served if the upstream fetch fails: a feed blip should
    leave slightly old traffic on the map rather than clearing it.
    """
    now = time.monotonic()
    with _LOCK:
        entry = _CACHE.get(key)
        if entry and now - entry.fetched_at < cache_ttl_seconds():
            return entry.payload

    url = f"{BASE_URL}/lat/{key.lat}/lon/{key.lon}/dist/{key.radius_nm}"
    try:
        document = _request(url, timeout)
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        with _LOCK:
            stale = _CACHE.get(key)
        if stale is not None:
            LOGGER.warning("ADS-B fetch failed (%s); serving cached feed", error)
            return stale.payload
        raise FeedError(str(error)) from error

    payload = {
        "latitude": key.lat,
        "longitude": key.lon,
        "radius_nm": key.radius_nm,
        # The feed timestamps itself in milliseconds since the epoch.
        "generated_at": document.get("now"),
        "attribution": {
            "text": "Flight data: adsb.lol community receiver network",
            "url": "https://adsb.lol/",
        },
        "aircraft": _normalise(document),
    }
    payload["count"] = len(payload["aircraft"])

    with _LOCK:
        _CACHE[key] = _Entry(payload, time.monotonic())
    return payload


def reset_cache() -> None:
    with _LOCK:
        _CACHE.clear()
