from __future__ import annotations

import os
from pathlib import Path

# cgroup v2, then v1. Kubernetes CPU limits are enforced as a CFS quota, which
# os.cpu_count() does not see: on a 64-core node a pod limited to 2 CPUs still
# reports 64, so pools sized from it oversubscribe by 30x and spend the cycle
# context-switching against its own throttle.
_CGROUP_V2 = Path("/sys/fs/cgroup/cpu.max")
_CGROUP_V1_QUOTA = Path("/sys/fs/cgroup/cpu/cpu.cfs_quota_us")
_CGROUP_V1_PERIOD = Path("/sys/fs/cgroup/cpu/cpu.cfs_period_us")


def _quota_cpus() -> float | None:
    try:
        if _CGROUP_V2.is_file():
            quota, period = _CGROUP_V2.read_text().split()
            if quota == "max":
                return None
            return int(quota) / int(period)
        if _CGROUP_V1_QUOTA.is_file() and _CGROUP_V1_PERIOD.is_file():
            quota = int(_CGROUP_V1_QUOTA.read_text())
            if quota <= 0:
                return None
            return quota / int(_CGROUP_V1_PERIOD.read_text())
    except (OSError, ValueError, ZeroDivisionError):
        return None
    return None


def available_cpus() -> int:
    """CPUs this process may actually use, honouring a container quota."""
    quota = _quota_cpus()
    detected = os.cpu_count() or 4
    if quota is None:
        return detected
    return max(1, min(detected, round(quota)))
