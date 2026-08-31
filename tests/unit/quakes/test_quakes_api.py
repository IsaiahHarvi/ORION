import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from services.quakes import usgs
from services.quakes.api import router

FEATURE = {
    "id": "us1000",
    "properties": {
        "mag": 5.2,
        "place": "80 km SW of Somewhere",
        "time": 1788150000000,
        "url": "https://earthquake.usgs.gov/x",
        "felt": 12,
        "tsunami": 0,
        "sig": 416,
        "alert": None,
    },
    "geometry": {"coordinates": [-120.5, 36.25, 11.4]},
}


@pytest.fixture
def client(monkeypatch):
    usgs.reset_cache()
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def stub_feed(monkeypatch, features, counter=None):
    def request(url, timeout):
        if counter is not None:
            counter.append(url)
        return {"metadata": {"generated": 1788150001000}, "features": features}

    monkeypatch.setattr(usgs, "_request", request)


def test_returns_normalised_quakes(client, monkeypatch) -> None:
    stub_feed(monkeypatch, [FEATURE])
    response = client.get("/quakes")
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 1
    quake = body["quakes"][0]
    # Coordinates arrive as [lon, lat, depth] and must not be transposed.
    assert (quake["longitude"], quake["latitude"], quake["depth_km"]) == (
        -120.5,
        36.25,
        11.4,
    )
    assert quake["magnitude"] == 5.2
    assert quake["tsunami"] is False


def test_features_without_a_magnitude_are_dropped(client, monkeypatch) -> None:
    # USGS publishes events whose magnitude is still null right after detection;
    # they cannot be sized or coloured, so they are not drawn.
    stub_feed(
        monkeypatch, [{**FEATURE, "properties": {**FEATURE["properties"], "mag": None}}]
    )
    assert client.get("/quakes").json()["count"] == 0


def test_quakes_are_newest_first(client, monkeypatch) -> None:
    older = {**FEATURE, "id": "old", "properties": {**FEATURE["properties"], "time": 1}}
    stub_feed(monkeypatch, [older, FEATURE])
    ids = [quake["id"] for quake in client.get("/quakes").json()["quakes"]]
    assert ids == ["us1000", "old"]


def test_upstream_is_fetched_once_per_ttl(client, monkeypatch) -> None:
    calls: list[str] = []
    stub_feed(monkeypatch, [FEATURE], calls)
    for _ in range(5):
        client.get("/quakes")
    # Five clients, one upstream request: this is what keeps USGS unbothered.
    assert len(calls) == 1


def test_a_stale_feed_is_served_when_usgs_fails(client, monkeypatch) -> None:
    stub_feed(monkeypatch, [FEATURE])
    assert client.get("/quakes").status_code == 200

    monkeypatch.setattr(usgs, "cache_ttl_seconds", lambda: 0.0)

    def boom(url, timeout):
        raise TimeoutError("usgs is down")

    monkeypatch.setattr(usgs, "_request", boom)
    response = client.get("/quakes")
    assert response.status_code == 200
    assert response.json()["count"] == 1


def test_unavailable_when_nothing_cached(client, monkeypatch) -> None:
    def boom(url, timeout):
        raise TimeoutError("usgs is down")

    monkeypatch.setattr(usgs, "_request", boom)
    assert client.get("/quakes").status_code == 503


@pytest.mark.parametrize(
    "query", ["window=decade", "min_magnitude=9.9", "window=day&min_magnitude=3"]
)
def test_only_feeds_usgs_actually_publishes_are_accepted(client, query) -> None:
    assert client.get(f"/quakes?{query}").status_code == 422


def test_requested_feed_is_the_one_fetched(client, monkeypatch) -> None:
    calls: list[str] = []
    stub_feed(monkeypatch, [FEATURE], calls)
    client.get("/quakes?window=week&min_magnitude=4.5")
    assert calls == [
        "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson"
    ]
