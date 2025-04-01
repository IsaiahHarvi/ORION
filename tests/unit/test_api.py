import os
import subprocess
import time

import pytest
import requests

BASE_URL = "http://127.0.0.1:5171/api"


@pytest.fixture(scope="session")
def api_service():
    env = os.environ.copy()
    env["VITE_API_URL"] = BASE_URL
    env["RESTART_POLICY"] = "no"
    subprocess.run(
        "docker compose up api --build -d".split(" "),
        check=True,
    )
    timeout = 30  # seconds
    start_time = time.time()
    while True:
        try:
            response = requests.get(f"{BASE_URL}/health")
            if response.status_code == 200:
                break
        except requests.exceptions.RequestException:
            pass
        if time.time() - start_time > timeout:
            raise Exception("API container did not start in time or health endpoint is not reachable.")
        time.sleep(2)
    yield
    subprocess.run("docker compose down api -v".split(" "), check=True)


def get_endpoint_response(endpoint_url, assert_200=True):
    response = requests.get(f"{BASE_URL}{endpoint_url}")
    if assert_200:
        assert (
            response.status_code == 200
        ), f"{endpoint_url} endpoint did not return 200 OK."
    return response


def test_root_endpoint(api_service):
    get_endpoint_response("/")


def test_health_endpoint(api_service):
    assert get_endpoint_response("/health").json() == {
        "status": "healthy"
    }, "Health endpoint did not return expected status."


def test_radars_nearby_endpoint(api_service):
    response = get_endpoint_response(
        "/radars_near/34.0522/-118.2437/50", assert_200=False
    )

    if response.status_code == 200:
        response_json = response.json()
        assert isinstance(response_json, list), "Expected a list of radars."
        assert len(response_json) > 0, "Expected at least one radar in the response."
    else:
        json_data = response.json()
        assert (
            "Error" in json_data
        ), "Expected an error message when no radars are found."


def test_radars_endpoint(api_service):
    response = get_endpoint_response("/radars/34.0522/-118.2437", assert_200=False)
    if response.status_code == 200:
        json_data = response.json()
        assert isinstance(json_data, list), "Expected a list of radars."
        assert len(json_data) > 0, f"Should return all radars, got ${len(json_data)}"
    else:
        raise AssertionError("Expected a 200 OK response, but got an error.")
