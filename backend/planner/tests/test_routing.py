from datetime import UTC, datetime

import flexpolyline
import httpx
import pytest

from planner.domain.geometry import cumulative_miles
from planner.exceptions import RouteNotFound, UpstreamServiceError
from planner.providers import routing
from planner.providers.routing import fetch_routes, gross_weight_kg, parse_route

from .conftest import load_fixture

ALTERNATIVES = load_fixture("here_routes_dfw_okc.json")
VIA = load_fixture("here_route_via.json")
ORIGIN = (32.7767, -96.7970)
DESTINATION = (35.4676, -97.5164)
DEPARTURE = datetime(2026, 10, 22, 13, 0, tzinfo=UTC)


def fetch():
    return fetch_routes(
        origin=ORIGIN, destination=DESTINATION, departure_utc=DEPARTURE, cargo_lbs=42_000
    )


def answer(request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, json=VIA if "via" in request.url.params else ALTERNATIVES)


@pytest.fixture(autouse=True)
def generous_detour_limit(settings):
    # The recorded via route is a deliberately far detour; the cap has its own test.
    settings.ROUTING = {**settings.ROUTING, "MAX_DETOUR_RATIO": 3.0}


def test_gross_weight_adds_tare_and_converts_to_kg(settings):
    assert gross_weight_kg(42_000) == 34_019
    assert gross_weight_kg(0) == round(settings.VEHICLE["TARE_LB"] * routing.KG_PER_LB)


def test_parse_route_reads_geometry_distance_and_spans():
    route = parse_route(ALTERNATIVES["routes"][0])
    summary = ALTERNATIVES["routes"][0]["sections"][0]["summary"]
    assert route.geometry[0] == pytest.approx(ORIGIN, abs=0.01)
    assert route.geometry[-1] == pytest.approx(DESTINATION, abs=0.01)
    assert route.duration_s == summary["duration"]
    assert route.distance_mi == pytest.approx(summary["length"] / 1609.344)
    assert sum(s.duration_s for s in route.segments) == pytest.approx(route.duration_s)
    assert sum(s.length_mi for s in route.segments) == pytest.approx(route.distance_mi)
    assert len(route.segments) > 10
    assert cumulative_miles(route.geometry)[-1] == pytest.approx(route.distance_mi, rel=0.02)


def test_parse_route_stitches_sections_at_a_via_point():
    raw = VIA["routes"][0]
    first, second = (len(flexpolyline.decode(s["polyline"])) for s in raw["sections"])
    route = parse_route(raw, forced=True)
    assert len(route.geometry) == first + second - 1
    assert route.forced
    assert route.duration_s == sum(s["summary"]["duration"] for s in raw["sections"])
    assert sum(s.duration_s for s in route.segments) == pytest.approx(route.duration_s)


def test_request_asks_for_truck_routing_with_spans(mock_http):
    requests = mock_http(answer)
    fetch()
    query = requests[0].url.params
    assert query["transportMode"] == "truck"
    assert query["vehicle[grossWeight]"] == "34019"
    assert query["alternatives"] == "2"
    assert query["spans"] == "length,duration,names"
    assert query["departureTime"] == "2026-10-22T13:00:00Z"
    assert query["origin"] == "32.7767,-96.797"


def test_short_trips_are_filled_up_with_forced_routes(mock_http):
    requests = mock_http(answer)
    routes = fetch()
    assert [r.forced for r in routes] == [False, False, True]
    assert any("via" in r.url.params for r in requests)


def test_provider_routes_are_not_repeated_by_forced_candidates(mock_http):
    # Both via sides return the same route; only one of them may be kept.
    mock_http(answer)
    routes = fetch()
    assert len(routes) == 3


def test_nearly_identical_provider_alternatives_are_dropped(mock_http):
    first = ALTERNATIVES["routes"][0]
    mock_http(
        lambda request: httpx.Response(
            200, json=VIA if "via" in request.url.params else {"routes": [first, first]}
        )
    )
    routes = fetch()
    assert sum(not r.forced for r in routes) == 1


def test_three_distinct_provider_routes_need_no_forced_route(mock_http):
    three = {"routes": [*ALTERNATIVES["routes"], VIA["routes"][0]]}
    requests = mock_http(lambda request: httpx.Response(200, json=three))
    routes = fetch()
    assert len(routes) == 3
    assert not any(r.forced for r in routes)
    assert len(requests) == 1


def test_failed_via_requests_are_skipped(mock_http):
    def handler(request: httpx.Request) -> httpx.Response:
        if "via" in request.url.params:
            return httpx.Response(400, json={"error": "unroutable"})
        return httpx.Response(200, json=ALTERNATIVES)

    mock_http(handler)
    assert len(fetch()) == 2


def test_forced_routes_that_detour_too_far_are_discarded(mock_http, settings):
    settings.ROUTING = {**settings.ROUTING, "MAX_DETOUR_RATIO": 1.2}
    mock_http(answer)
    assert len(fetch()) == 2


def test_routes_are_cached_by_trip_and_load(mock_http):
    requests = mock_http(answer)
    fetch()
    count = len(requests)
    fetch()
    assert len(requests) == count
    fetch_routes(origin=ORIGIN, destination=DESTINATION, departure_utc=DEPARTURE, cargo_lbs=20_000)
    assert len(requests) > count


def test_no_route_is_reported_as_not_found(mock_http):
    mock_http(lambda request: httpx.Response(200, json={"routes": []}))
    with pytest.raises(RouteNotFound):
        fetch()


def test_missing_key_is_a_provider_error(settings):
    settings.HERE_API_KEY = ""
    with pytest.raises(UpstreamServiceError, match="HERE_API_KEY"):
        fetch()
