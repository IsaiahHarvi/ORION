import json
from io import BytesIO

from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

from services.nexrad.api import router


def test_manifest_and_transparent_tile(tmp_path, monkeypatch) -> None:
    frame = "1788004800-a1b2c3d4"
    frame_directory = tmp_path / "frames" / str(frame)
    frame_directory.mkdir(parents=True)
    (tmp_path / "manifest.json").write_text(
        json.dumps(
            {
                "version": 1,
                "generated_at": "2026-08-29T12:01:00Z",
                "frames": [{"id": frame, "time": 1788004800}],
            }
        )
    )
    monkeypatch.setenv("ORION_MOSAIC_DIR", str(tmp_path))
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    manifest = client.get("/nexrad/frames")
    assert manifest.status_code == 200
    assert manifest.headers["cache-control"] == "no-cache, max-age=0"

    tile = client.get(f"/nexrad/tiles/{frame}/5/8/12.png")
    assert tile.status_code == 200
    assert tile.headers["content-type"] == "image/png"
    assert tile.headers["cache-control"] == "public, max-age=31536000, immutable"
    image = Image.open(BytesIO(tile.content)).convert("RGBA")
    assert image.size == (256, 256)
    assert image.getpixel((0, 0)) == (0, 0, 0, 0)


def test_missing_manifest_is_unavailable_not_an_empty_manifest(
    tmp_path, monkeypatch
) -> None:
    """503 is the contract the client already implements for "not ready yet".

    Serving a synthesised empty manifest instead meant the API had to be told
    the producer's stations, bounds and zoom range so it could fill one in.
    """
    monkeypatch.setenv("ORION_MOSAIC_DIR", str(tmp_path))
    app = FastAPI()
    app.include_router(router)
    response = TestClient(app).get("/nexrad/frames")
    assert response.status_code == 503


def test_frames_needs_no_producer_settings(tmp_path, monkeypatch) -> None:
    """The API reads the manifest, never the settings that produced it."""
    monkeypatch.setenv("ORION_MOSAIC_DIR", str(tmp_path))
    for name in (
        "ORION_NEXRAD_STATIONS",
        "ORION_NEXRAD_BOUNDS",
        "ORION_NEXRAD_MIN_ZOOM",
        "ORION_NEXRAD_MAX_ZOOM",
    ):
        monkeypatch.delenv(name, raising=False)
    (tmp_path / "manifest.json").write_text(
        json.dumps({"version": 1, "configured_stations": ["KOHX"], "frames": []})
    )
    app = FastAPI()
    app.include_router(router)
    response = TestClient(app).get("/nexrad/frames")
    assert response.status_code == 200
    assert response.json()["configured_stations"] == ["KOHX"]
