import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from services.adsb import feed
from services.adsb.api import router

AIRCRAFT = {
    "hex": "a78d6b",
    "flight": "JIA5024 ",
    "r": "N586NN",
    "t": "CRJ9",
    "alt_baro": 32000,
    "gs": 478.1,
    "track": 243.01,
    "baro_rate": 64,
    "squawk": "1677",
    "emergency": "none",
    "lat": 36.67424,
    "lon": -88.362579,
    "seen_pos": 0.409,
    "dst": 89.886,
}


@pytest.fixture
def client():
    feed.reset_cache()
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def stub_feed(monkeypatch, aircraft, calls=None):
    def request(url, timeout):
        if calls is not None:
            calls.append(url)
        return {"now": 1788150001000, "ac": aircraft}

    monkeypatch.setattr(feed, "_request", request)


def test_returns_normalised_aircraft(client, monkeypatch) -> None:
    stub_feed(monkeypatch, [AIRCRAFT])
    response = client.get("/adsb?lat=36.0&lon=-86.7")
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 1
    contact = body["aircraft"][0]
    assert contact["id"] == "a78d6b"
    # The feed pads the callsign to eight characters.
    assert contact["callsign"] == "JIA5024"
    assert (contact["latitude"], contact["longitude"]) == (36.67424, -88.362579)
    assert contact["altitude_ft"] == 32000
    assert contact["on_ground"] is False
    # "none" is the feed's way of saying there is no emergency.
    assert contact["emergency"] is None


def test_ground_altitude_is_not_a_number(client, monkeypatch) -> None:
    stub_feed(monkeypatch, [{**AIRCRAFT, "alt_baro": "ground"}])
    contact = client.get("/adsb?lat=36.0&lon=-86.7").json()["aircraft"][0]
    assert contact["altitude_ft"] is None
    assert contact["on_ground"] is True


def test_positionless_contacts_are_dropped(client, monkeypatch) -> None:
    # A contact heard on the radio but not yet located cannot be drawn.
    stub_feed(monkeypatch, [{**AIRCRAFT, "lat": None, "lon": None}])
    assert client.get("/adsb?lat=36.0&lon=-86.7").json()["count"] == 0


def test_aircraft_are_nearest_first(client, monkeypatch) -> None:
    far = {**AIRCRAFT, "hex": "beef01", "dst": 200.0}
    stub_feed(monkeypatch, [far, AIRCRAFT])
    ids = [c["id"] for c in client.get("/adsb?lat=36.0&lon=-86.7").json()["aircraft"]]
    assert ids == ["a78d6b", "beef01"]


def test_nearby_viewports_share_one_upstream_fetch(client, monkeypatch) -> None:
    calls: list[str] = []
    stub_feed(monkeypatch, [AIRCRAFT], calls)
    # A pan of a few hundredths of a degree is the same sky.
    for lat in (36.0, 36.02, 35.99, 36.04):
        client.get(f"/adsb?lat={lat}&lon=-86.7")
    assert len(calls) == 1


def test_distant_viewports_do_not_share_a_fetch(client, monkeypatch) -> None:
    calls: list[str] = []
    stub_feed(monkeypatch, [AIRCRAFT], calls)
    client.get("/adsb?lat=36.0&lon=-86.7")
    client.get("/adsb?lat=47.6&lon=-122.3")
    assert len(calls) == 2


def test_a_stale_feed_is_served_when_upstream_fails(client, monkeypatch) -> None:
    stub_feed(monkeypatch, [AIRCRAFT])
    assert client.get("/adsb?lat=36.0&lon=-86.7").status_code == 200

    monkeypatch.setattr(feed, "cache_ttl_seconds", lambda: 0.0)

    def boom(url, timeout):
        raise TimeoutError("adsb is down")

    monkeypatch.setattr(feed, "_request", boom)
    response = client.get("/adsb?lat=36.0&lon=-86.7")
    assert response.status_code == 200
    assert response.json()["count"] == 1


def test_unavailable_when_nothing_cached(client, monkeypatch) -> None:
    def boom(url, timeout):
        raise TimeoutError("adsb is down")

    monkeypatch.setattr(feed, "_request", boom)
    assert client.get("/adsb?lat=36.0&lon=-86.7").status_code == 503


@pytest.mark.parametrize(
    "query",
    ["lat=91&lon=0", "lat=0&lon=181", "lat=0&lon=0&radius_nm=400", "lon=0"],
)
def test_unusable_queries_are_rejected(client, query) -> None:
    assert client.get(f"/adsb?{query}").status_code == 422


def test_requested_area_is_the_one_fetched(client, monkeypatch) -> None:
    calls: list[str] = []
    stub_feed(monkeypatch, [AIRCRAFT], calls)
    client.get("/adsb?lat=36.01&lon=-86.76&radius_nm=100")
    # Snapped to the shared grid, not passed through verbatim.
    assert calls == ["https://api.adsb.lol/v2/lat/36.0/lon/-86.75/dist/100"]


def test_a_cached_answer_says_how_old_it_is(client, monkeypatch) -> None:
    stub_feed(monkeypatch, [AIRCRAFT])
    fresh = client.get("/adsb?lat=36.0&lon=-86.7").json()
    # A fetch just made is current; the client needs this to be told, not
    # assumed, or every cached position it draws is silently a TTL behind.
    assert fresh["feed_age_seconds"] < 1

    clock = {"t": 100.0}
    monkeypatch.setattr(feed.time, "monotonic", lambda: clock["t"])
    feed.reset_cache()
    client.get("/adsb?lat=36.0&lon=-86.7")
    clock["t"] = 105.0
    assert client.get("/adsb?lat=36.0&lon=-86.7").json()["feed_age_seconds"] == 5.0
