from __future__ import annotations

import json
import os
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse, JSONResponse

from services.nexrad.placeholder import TRANSPARENT_PNG

router = APIRouter(prefix="/radar", tags=["radar"])
FRAME_ID = re.compile(r"^\d{10}-[0-9a-f]{8}$")


def mosaic_directory() -> Path:
    return Path(
        os.environ.get(
            "ORION_MOSAIC_DIR",
            str(Path(os.environ.get("SCAN_DIR", "./data/dev-scans")) / "mosaic"),
        )
    )


def manifest_path() -> Path:
    root = mosaic_directory()
    manifests = root / "manifests"
    if manifests.is_dir():
        candidates = list(manifests.glob("*.json"))
        if candidates:
            return max(candidates, key=lambda path: path.stat().st_mtime_ns)
    return root / "manifest.json"


@router.get("/frames")
async def radar_frames() -> Response:
    path = manifest_path()
    if not path.is_file():
        bounds = [
            float(value)
            for value in os.environ.get(
                "ORION_RADAR_BOUNDS", "-125.0,24.0,-66.5,49.5"
            ).split(",")
        ]
        return JSONResponse(
            {
                "version": 1,
                "generated_at": None,
                "default_frame_id": "",
                "latest_observed_frame_id": "",
                "tile_size": 256,
                "min_zoom": int(os.environ.get("ORION_RADAR_MIN_ZOOM", "4")),
                "max_zoom": int(os.environ.get("ORION_RADAR_MAX_ZOOM", "9")),
                "bounds": bounds,
                "configured_stations": [
                    station.strip()
                    for station in os.environ.get("ORION_RADAR_STATIONS", "").split(",")
                    if station.strip()
                ],
                "attribution": {
                    "text": "Weather radar: NOAA/NWS NEXRAD processed by ORION",
                    "url": "https://www.weather.gov/",
                },
                "frames": [],
            },
            headers={"Cache-Control": "no-cache, max-age=0"},
        )
    return FileResponse(
        path,
        media_type="application/json",
        headers={"Cache-Control": "no-cache, max-age=0"},
    )


@router.get("/tiles/{frame}/{z:int}/{x:int}/{y:int}.png")
async def radar_tile(frame: str, z: int, x: int, y: int) -> Response:
    if not FRAME_ID.fullmatch(frame) or not (
        0 <= z <= 14 and 0 <= x < 2**z and 0 <= y < 2**z
    ):
        raise HTTPException(status_code=404, detail="Invalid tile coordinate")

    root = mosaic_directory()
    frame_directory = root / "frames" / str(frame)
    if not frame_directory.is_dir():
        raise HTTPException(status_code=404, detail="Radar frame not found")

    path = frame_directory / str(z) / str(x) / f"{y}.png"
    if not path.is_file():
        return Response(
            content=TRANSPARENT_PNG,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )
    return FileResponse(
        path,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.get("/status")
async def radar_status() -> dict[str, object]:
    path = manifest_path()
    if not path.is_file():
        return {"status": "starting", "frames": 0}
    manifest = json.loads(path.read_text())
    frames = manifest.get("frames", [])
    latest = frames[-1] if frames else {}
    return {
        "status": "healthy" if frames else "starting",
        "generated_at": manifest.get("generated_at"),
        "frames": len(frames),
        "contributing_stations": len(latest.get("stations", [])),
        "configured_stations": len(manifest.get("configured_stations", [])),
    }
