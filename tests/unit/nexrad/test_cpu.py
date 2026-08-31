import pytest

from services.nexrad import cpu as cpu_module
from services.nexrad.cpu import available_cpus

CPU_ENV = ("ORION_CPU_LIMIT", "ORION_CPU_REQUEST")


@pytest.fixture(autouse=True)
def clear_cpu_env(monkeypatch):
    for name in CPU_ENV:
        monkeypatch.delenv(name, raising=False)
    # Never let the host's real cgroup files decide a test's outcome.
    monkeypatch.setattr(cpu_module, "_quota_cpus", lambda: None)
    monkeypatch.setattr(cpu_module.os, "cpu_count", lambda: 64)


def test_falls_back_to_host_count_outside_a_container() -> None:
    assert available_cpus() == 64


def test_downward_api_request_is_used(monkeypatch) -> None:
    monkeypatch.setenv("ORION_CPU_REQUEST", "2")
    assert available_cpus() == 2


def test_limit_wins_over_request(monkeypatch) -> None:
    monkeypatch.setenv("ORION_CPU_REQUEST", "2")
    monkeypatch.setenv("ORION_CPU_LIMIT", "4")
    assert available_cpus() == 4


def test_millicores_are_understood_and_never_round_to_zero(monkeypatch) -> None:
    monkeypatch.setenv("ORION_CPU_REQUEST", "100m")
    assert available_cpus() == 1


def test_unparseable_value_falls_through_to_the_next_source(monkeypatch) -> None:
    monkeypatch.setenv("ORION_CPU_LIMIT", "not-a-number")
    monkeypatch.setenv("ORION_CPU_REQUEST", "3")
    assert available_cpus() == 3


def test_cgroup_quota_is_used_when_no_env_is_injected(monkeypatch) -> None:
    # A pod limited to 2 CPUs on a 64-core node must not size pools to 64.
    monkeypatch.setattr(cpu_module, "_quota_cpus", lambda: 2.0)
    assert available_cpus() == 2
