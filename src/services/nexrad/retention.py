from __future__ import annotations

import logging
import shutil
import time
from datetime import timedelta
from pathlib import Path

from services.radar.settings import ProducerSettings

LOGGER = logging.getLogger("orion.radar.retention")


def prune_raw_scans(settings: ProducerSettings) -> None:
    """Delete cached Level II volumes older than the retention window.

    Each cycle downloads one volume per station, so an unpruned cache grows by
    roughly a gigabyte an hour at full station coverage.
    """
    if settings.raw_retention <= timedelta(0):
        return
    cutoff = time.time() - settings.raw_retention.total_seconds()
    directories: list[Path] = []
    removed = 0
    freed = 0
    for path in settings.raw_directory.rglob("*"):
        if path.is_dir():
            directories.append(path)
            continue
        try:
            info = path.stat()
            if info.st_mtime < cutoff:
                path.unlink()
                removed += 1
                freed += info.st_size
        except OSError:
            LOGGER.debug("Could not prune %s", path, exc_info=True)
    # Deepest first, so a station directory empties before we try to remove it.
    # The cache root itself is left in place for the next download.
    for directory in sorted(directories, key=lambda p: len(p.parts), reverse=True):
        try:
            directory.rmdir()
        except OSError:
            pass
    if removed:
        LOGGER.info("Pruned %s cached scans (%.1f GB)", removed, freed / 1e9)


def prune_superseded_frames(
    frames_directory: Path, configuration_suffix: str, minimum_age_seconds: float = 3600
) -> None:
    """Delete frames rendered by a superseded algorithm or configuration.

    Retention only covers frames of the current configuration, so without this
    every algorithm change strands its frames on disk forever. The age guard
    leaves a concurrently running producer's fresh output alone.
    """
    cutoff = time.time() - minimum_age_seconds
    for directory in frames_directory.iterdir():
        if not directory.is_dir() or directory.name.startswith("."):
            continue
        if directory.name.endswith(configuration_suffix):
            continue
        try:
            if directory.stat().st_mtime < cutoff:
                shutil.rmtree(directory, ignore_errors=True)
        except OSError:
            LOGGER.debug("Could not prune %s", directory, exc_info=True)
