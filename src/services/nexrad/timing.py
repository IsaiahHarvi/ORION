from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from time import perf_counter

LOGGER = logging.getLogger("orion.nexrad.timing")


class CycleTimer:
    """Wall-clock cost of each stage of one frame, logged as one line.

    The producer polls on a fixed interval, so the number that decides whether
    it keeps up is the total against that interval -- and the stage split is
    what says where to spend effort when it does not.
    """

    def __init__(self) -> None:
        self._stages: dict[str, float] = {}
        self._started = perf_counter()

    @contextmanager
    def stage(self, name: str) -> Iterator[None]:
        start = perf_counter()
        try:
            yield
        finally:
            self._stages[name] = self._stages.get(name, 0.0) + perf_counter() - start

    @property
    def total(self) -> float:
        return perf_counter() - self._started

    def log(self, interval_seconds: int, **context: object) -> None:
        total = self.total
        stages = " ".join(
            f"{name}={value:.1f}s" for name, value in self._stages.items()
        )
        extra = " ".join(f"{key}={value}" for key, value in context.items())
        LOGGER.info(
            "cycle total=%.1fs (%.0f%% of the %ss interval) %s %s",
            total,
            100 * total / interval_seconds if interval_seconds else 0,
            interval_seconds,
            stages,
            extra,
        )
        if interval_seconds and total > interval_seconds:
            # Frames are now published less often than they are requested, so
            # the animation falls behind real time and keeps drifting.
            LOGGER.warning(
                "Cycle took %.1fs, longer than the %ss interval: frames are "
                "falling behind. Raise CPU and ORION_RADAR_*_WORKERS, or widen "
                "ORION_RADAR_INTERVAL_SECONDS.",
                total,
                interval_seconds,
            )
