from __future__ import annotations

import json
import os
from pathlib import Path


def atomic_json(path: Path, data: object) -> None:
    """Write JSON via a temporary file so readers never see a partial document.

    The API serves these files straight off the shared volume while the producer
    is rewriting them.
    """
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_text(json.dumps(data, indent=2, sort_keys=True))
    os.replace(temporary, path)
