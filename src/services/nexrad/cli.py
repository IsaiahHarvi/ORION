"""Command line entrypoint for the ORION NEXRAD mosaic service.

Installed as ``orion-nexrad``. Run with no arguments it publishes a frame every
``ORION_RADAR_INTERVAL_SECONDS``; ``--once`` produces a single frame, and
``--analysis-time`` rebuilds a frame for a past moment.
"""

from __future__ import annotations

import argparse
import logging
import os
import time
from datetime import UTC, datetime

from services.radar.frames import produce_frame
from services.radar.retention import prune_raw_scans
from services.radar.settings import ProducerSettings

LOGGER = logging.getLogger("orion.radar")


def _parse_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="orion-nexrad", description="Publish ORION NEXRAD mosaic frames"
    )
    parser.add_argument(
        "--once", action="store_true", help="Produce one frame and exit"
    )
    parser.add_argument("--analysis-time", type=_parse_time)
    args = parser.parse_args()
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    settings = ProducerSettings.from_environment()

    while True:
        try:
            produce_frame(settings, args.analysis_time)
        except Exception:
            LOGGER.exception("Radar frame production failed")
            if args.once:
                raise
        finally:
            # Reclaim on every cycle, not just successful ones. A producer that
            # keeps failing, or that keeps finding the frame already built, still
            # downloads a volume per station and would otherwise fill the disk.
            try:
                prune_raw_scans(settings)
            except Exception:
                LOGGER.exception("Could not prune cached scans")
        if args.once or args.analysis_time:
            return
        time.sleep(settings.interval_seconds)


if __name__ == "__main__":
    main()
