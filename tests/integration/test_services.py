import json
import subprocess
import time

import pytest


def compose(*args: str, **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(["docker", "compose", *args], **kwargs)


@pytest.fixture(scope="session")
def docker_services():
    compose("up", "--build", "-d", check=True)
    yield
    compose("down", "-v", check=True)


def running_services() -> set[str]:
    result = compose(
        "ps", "--format", "json", capture_output=True, text=True, check=True
    )
    # One JSON object per line, and no lines at all when nothing is up.
    return {
        json.loads(line)["Service"]
        for line in result.stdout.splitlines()
        if line.strip()
    }


def test_containers_running(docker_services):
    # Ask compose what it defines rather than inferring services from the layout
    # of deploy/, which also holds the Helm chart and per-image build context.
    result = compose(
        "config", "--services", capture_output=True, text=True, check=True
    )
    expected = {service for service in result.stdout.split() if service}
    assert expected, "compose defines no services"

    deadline = time.time() + 120
    backoff = 1
    while True:
        running = running_services()
        if expected <= running:
            return
        if time.time() > deadline:
            pytest.fail(f"Not running after 2 minutes: {sorted(expected - running)}")
        time.sleep(backoff)
        backoff = min(backoff * 2, 5)
