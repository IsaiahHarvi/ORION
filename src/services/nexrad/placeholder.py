from __future__ import annotations

from io import BytesIO

from PIL import Image

TILE_SIZE = 256


def _transparent_png() -> bytes:
    buffer = BytesIO()
    Image.new("RGBA", (TILE_SIZE, TILE_SIZE), (0, 0, 0, 0)).save(
        buffer, format="PNG", optimize=True
    )
    return buffer.getvalue()


# Served for tiles that hold no echo, and written once per frame directory. It
# lives apart from `tiles` so the API can serve it without pulling in the
# ingest-side stack (pyart, rasterio, scipy) that it otherwise never touches.
TRANSPARENT_PNG = _transparent_png()
