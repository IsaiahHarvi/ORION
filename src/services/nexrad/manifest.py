from __future__ import annotations

import json
import logging
import shutil
from datetime import UTC, datetime

from services.nexrad.retention import prune_superseded_frames
from services.nexrad.settings import ProducerSettings, configuration_hash
from services.nexrad.storage import atomic_json

LOGGER = logging.getLogger("orion.radar.manifest")


def publish_manifest(settings: ProducerSettings) -> None:
    """Rewrite the manifest the client animates from, and enforce retention.

    Only frames of the current configuration are listed; the oldest beyond the
    retention count are deleted, along with any frames left by a configuration
    that is no longer current.
    """
    frames_directory = settings.mosaic_directory / "frames"
    suffix = f"-{configuration_hash(settings)}"

    metadata: list[dict[str, object]] = []
    for directory in frames_directory.iterdir():
        path = directory / "metadata.json"
        if directory.is_dir() and not directory.name.startswith(".") and path.is_file():
            frame = json.loads(path.read_text())
            if isinstance(frame.get("id"), str) and frame["id"].endswith(suffix):
                metadata.append(frame)
    metadata.sort(key=lambda frame: int(frame["time"]))

    while len(metadata) > settings.retained_frames:
        expired = metadata.pop(0)
        shutil.rmtree(frames_directory / str(expired["id"]), ignore_errors=True)

    prune_superseded_frames(frames_directory, suffix)

    frames = [
        {
            "id": frame["id"],
            "time": frame["time"],
            "kind": "observed",
            "tiles": f"radar/tiles/{frame['id']}/{{z}}/{{x}}/{{y}}.png",
            "stations": frame["stations"],
            "max_skew_seconds": frame["max_skew_seconds"],
            "motion_mps": frame.get("motion_mps", {"x": 0.0, "y": 0.0}),
        }
        for frame in metadata
    ]
    latest_id = str(frames[-1]["id"]) if frames else ""
    manifest = {
        "version": 1,
        "generated_at": datetime.now(UTC).isoformat(),
        "default_frame_id": latest_id,
        "latest_observed_frame_id": latest_id,
        "tile_size": 256,
        "min_zoom": settings.minimum_zoom,
        "max_zoom": settings.maximum_zoom,
        "bounds": settings.bounds,
        "configured_stations": settings.stations,
        "attribution": {
            "text": "Weather radar: NOAA/NWS NEXRAD processed by ORION",
            "url": "https://www.weather.gov/",
        },
        "frames": frames,
    }

    manifests_directory = settings.mosaic_directory / "manifests"
    manifests_directory.mkdir(parents=True, exist_ok=True)
    atomic_json(manifests_directory / f"{configuration_hash(settings)}.json", manifest)
    atomic_json(settings.mosaic_directory / "manifest.json", manifest)
