import os
import re
import subprocess
import time

import pytest


@pytest.fixture(scope="session")
def docker_services():
    subprocess.run("docker compose --profile gui up --build -d".split(" "), check=True)
    yield
    subprocess.run("docker compose --profile gui down -v".split(" "), check=True)


def test_containers_running(docker_services):
    max_timeout = 120  # max timeout of 2 minutes
    backoff = 1
    max_backoff = 5
    start_time = time.time()
    pattern = re.compile(r"^orion-(?!cpu|gpu)")

    time.sleep(1)
    while True:
        result = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}"],
            capture_output=True,
            text=True,
            check=True,
        )
        containers = result.stdout.strip().splitlines()

        expected_containers = [
            container
            for container in os.listdir("deploy")
            if container != "postgres" and os.path.isdir(f"deploy/{container}")
        ]
        running_containers = [c for c in containers if pattern.match(c)]

        print("Running containers:", running_containers)
        print("Expected containers:", expected_containers)
        if len(running_containers) == len(expected_containers):
            break

        if (time.time() - start_time) > max_timeout:
            pytest.fail(
                "Timeout: not all 'orion-' containers are running within 2 minutes."
            )

        print(f"Backoff: {backoff}s")
        time.sleep(backoff)
        backoff = min(backoff * 2, max_backoff)
