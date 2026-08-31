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


def test_missing_manifest_reports_starting(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("ORION_MOSAIC_DIR", str(tmp_path))
    app = FastAPI()
    app.include_router(router)
    response = TestClient(app).get("/nexrad/frames")
    assert response.status_code == 200
    assert response.json()["frames"] == []
    assert response.headers["cache-control"] == "no-cache, max-age=0"
