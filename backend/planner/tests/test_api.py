import math
from datetime import UTC, datetime, timedelta

import pytest
from django.test import Client

from planner.api.serializers import corridor_payload
from planner.domain.eta import Segment
from planner.domain.geometry import simplify
from planner.exceptions import LocationNotFound, RouteNotFound, UpstreamServiceError
from planner.providers.geocoding import Place
from planner.providers.routing import ProviderRoute
from planner.providers.weather import Forecast, snap
from planner.services import TripPlanner

from .conftest import HOURS, PLACES, east_of_i35_band, forecast, midnight_utc, post, trip


def test_plan_response_shape_and_recommendation(providers):
    providers["weather"] = east_of_i35_band
    response = post("/api/v1/plan", trip())
    assert response.status_code == 200
    plan = response.json()

    assert set(plan) >= {"routes", "recommended_route_id", "reason", "warnings", "departure_utc"}
    assert plan["origin"]["timezone"] == "America/Chicago"
    assert [r["id"] for r in plan["routes"]] == ["A", "B", "C"]
    assert [r["forced"] for r in plan["routes"]] == [False, False, True]

    for route in plan["routes"]:
        assert set(route) == {
            "id", "geometry", "distance_mi", "duration_s", "forced", "checkpoints", "summary",
        }  # fmt: skip
        assert route["geometry"]["type"] == "LineString"
        lon, lat = route["geometry"]["coordinates"][0]
        assert (lat, lon) == pytest.approx((32.78, -96.80), abs=0.01)

        checkpoints = route["checkpoints"]
        assert len(checkpoints) == math.ceil(route["distance_mi"] / 25) + 1
        assert checkpoints[0]["mile"] == 0
        assert checkpoints[0]["eta_utc"] == plan["departure_utc"]
        assert checkpoints[0]["eta_local"].endswith("-05:00")
        assert checkpoints[0]["tz"] == "CDT"
        etas = [c["eta_utc"] for c in checkpoints]
        assert etas == sorted(etas)
        assert sum(c["covered_miles"] for c in checkpoints) == pytest.approx(
            route["distance_mi"], rel=0.01
        )
        assert sum(route["summary"]["miles_by_level"].values()) == pytest.approx(
            route["distance_mi"], rel=0.01
        )
        assert route["summary"]["unknown_miles"] == 0

    blocked = plan["routes"][0]
    assert blocked["summary"]["miles_by_level"]["NO_TRAVEL"] > 0
    worst = next(c for c in blocked["checkpoints"] if c["level"] == "NO_TRAVEL")
    assert worst["driver"] == "wind"
    assert plan["routes"][1]["summary"]["miles_by_level"]["NO_TRAVEL"] == 0

    assert plan["recommended_route_id"] == "B"
    assert "No Travel" in plan["reason"]
    assert "on Route A." in plan["reason"]
    assert any("generated" in w for w in plan["warnings"])


def test_checkpoint_weather_follows_the_eta_not_the_departure(providers):
    providers["weather"] = lambda point: forecast(wind=lambda i: float(i), rain=lambda i: i / 1000)
    plan = post("/api/v1/plan", trip()).json()
    for checkpoint in plan["routes"][0]["checkpoints"]:
        eta = datetime.fromisoformat(checkpoint["eta_utc"].replace("Z", "+00:00"))
        hours = (eta - midnight_utc()) / timedelta(hours=1)
        assert checkpoint["wind_mph"] == pytest.approx(hours, abs=0.06)
        assert checkpoint["rain_in_hr"] == pytest.approx(math.ceil(hours - 1e-9) / 1000, abs=6e-4)


def test_beyond_the_forecast_horizon_is_unknown_not_low(providers):
    providers["weather"] = lambda point: forecast(hours=24)
    plan = post("/api/v1/plan", trip()).json()
    for route in plan["routes"]:
        assert {c["level"] for c in route["checkpoints"]} == {"UNKNOWN"}
        assert route["summary"]["unknown_miles"] == pytest.approx(route["distance_mi"], rel=0.01)
        assert route["summary"]["avg_risk"] is None
    assert any("forecast horizon" in w for w in plan["warnings"])


def test_warns_when_every_route_is_blocked(providers):
    providers["weather"] = lambda point: forecast(wind=lambda i: 60.0)
    plan = post("/api/v1/plan", trip()).json()
    assert any("Every route" in w for w in plan["warnings"])
    assert plan["recommended_route_id"] == "A"


def test_short_route_list_is_reported(providers, routes):
    providers["routes"] = routes[:2]
    plan = post("/api/v1/plan", trip()).json()
    assert len(plan["routes"]) == 2
    assert any("Only 2" in w for w in plan["warnings"])


@pytest.mark.parametrize(
    ("overrides", "fragment"),
    [
        ({"load_lbs": 47_001}, "80,000"),
        ({"load_lbs": 0}, "load_lbs"),
        ({"interval_miles": 30}, "interval_miles"),
        ({"departure_at": "tomorrow"}, "departure_at"),
        ({"departure_at": "2026-10-22T08:00-05:00"}, "offset"),
        ({"departure_at": "2020-01-01T08:00"}, "between now and 14 days"),
        ({"departure_at": "2999-01-01T08:00"}, "between now and 14 days"),
        ({"origin": ""}, "origin"),
    ],
)
def test_invalid_requests_are_rejected_with_a_readable_message(providers, overrides, fragment):
    response = post("/api/v1/plan", trip(**overrides))
    assert response.status_code == 400
    assert fragment in str(response.json())


def failing_planner(monkeypatch, *, geocoder=None, router=None):
    def unavailable(*args, **kwargs):
        raise UpstreamServiceError

    planner = TripPlanner(
        geocoder=geocoder or (lambda text: PLACES[text]),
        router=router or unavailable,
        forecaster=lambda points: {},
    )
    monkeypatch.setattr("planner.api.views.build_trip_planner", lambda: planner)


def test_unknown_place_is_a_404(monkeypatch):
    def missing(text):
        raise LocationNotFound(f"No place found for {text!r}")

    failing_planner(monkeypatch, geocoder=missing)
    response = post("/api/v1/plan", trip())
    assert response.status_code == 404
    assert "No place found" in response.json()["detail"]


def test_no_route_is_a_422(monkeypatch):
    def no_route(**kwargs):
        raise RouteNotFound

    failing_planner(monkeypatch, router=no_route)
    response = post("/api/v1/plan", trip())
    assert response.status_code == 422
    assert "No truck route" in response.json()["detail"]


def test_provider_outage_is_a_502_without_leaking_details(monkeypatch):
    failing_planner(monkeypatch)
    response = post("/api/v1/plan", trip())
    assert response.status_code == 502
    assert response.json()["detail"] == "A weather or routing service is unavailable. Try again."


def corridor_body(routes) -> dict:
    line = [[lon, lat] for lat, lon in simplify(routes[0].geometry, tolerance_mi=0.5)]
    return {"routes": [line], "load_lbs": 42_000}


def test_corridor_payload_shape(providers, routes):
    corridor = post("/api/v1/corridor", corridor_body(routes)).json()
    assert len(corridor["hours"]) == 49
    assert corridor["step"] == 0.25
    assert len(corridor["levels"]) == len(corridor["cells"]) * 49
    assert set(corridor["levels"]) <= set(range(6))
    assert corridor["hours"][0].endswith(":00Z")


def test_corridor_levels_follow_the_forecast_hour(providers, routes):
    now = datetime(2026, 10, 21, 14, 30, tzinfo=UTC)
    spike = 14 + 3  # three hours after the slider's first hour
    line = [(lat, lon) for lat, lon in simplify(routes[0].geometry, tolerance_mi=0.5)]
    providers["weather"] = lambda point: Forecast(
        first_hour=datetime(2026, 10, 21, tzinfo=UTC),
        wind_mph=[50.0 if i == spike else 5.0 for i in range(HOURS)],
        gust_mph=[0.0] * HOURS,
        rain_in=[0.0] * HOURS,
        snow_in=[0.0] * HOURS,
    )
    planner = TripPlanner(
        geocoder=lambda text: PLACES[text],
        router=lambda **kwargs: [],
        forecaster=lambda points: {snap(p): providers["weather"](snap(p)) for p in points},
        clock=lambda: now,
    )
    corridor = corridor_payload(planner.corridor(routes=[line], load_lbs=42_000))
    assert corridor["hours"][0] == "2026-10-21T14:00Z"
    cells = len(corridor["cells"])
    for cell in range(cells):
        row = corridor["levels"][cell * 49 : (cell + 1) * 49]
        assert row[3] == 4
        assert row[2] == row[4] == 0


def test_corridor_rejects_bad_geometry(providers):
    assert post("/api/v1/corridor", {"routes": [[[0, 0]]], "load_lbs": 42_000}).status_code == 400
    assert (
        post("/api/v1/corridor", {"routes": [[[500, 0], [1, 1]]], "load_lbs": 42_000}).status_code
        == 400
    )
    assert post("/api/v1/corridor", {"routes": [], "load_lbs": 42_000}).status_code == 400


def test_geocode_endpoint(monkeypatch):
    monkeypatch.setattr("planner.api.views.suggest", lambda q: [f"{q}, TX"])
    client = Client()
    assert client.get("/api/v1/geocode?q=dal").json() == {"suggestions": ["dal, TX"]}
    assert client.get("/api/v1/geocode?q=d").json() == {"suggestions": []}
    assert client.get("/api/v1/geocode").json() == {"suggestions": []}


def test_unknown_api_paths_return_json():
    response = Client().get("/api/nope")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not found."}


def test_a_trip_shorter_than_the_interval_has_only_origin_and_destination(providers):
    start, end = (32.78, -96.80), (32.80, -96.76)
    providers["routes"] = [
        ProviderRoute(
            geometry=[start, end], distance_mi=3.0, duration_s=420, segments=[Segment(3.0, 420)]
        )
    ]
    plan = post("/api/v1/plan", trip(interval_miles=50)).json()
    checkpoints = plan["routes"][0]["checkpoints"]
    assert [c["mile"] for c in checkpoints] == [0, pytest.approx(3.0, abs=0.5)]
    assert any("Only 1" in warning for warning in plan["warnings"])
    assert any("shorter than the sampling interval" in w for w in plan["warnings"])


def test_the_route_distance_matches_the_checkpoint_miles(providers):
    for route in post("/api/v1/plan", trip()).json()["routes"]:
        assert route["checkpoints"][-1]["mile"] == pytest.approx(route["distance_mi"], abs=0.06)
        covered = sum(c["covered_miles"] for c in route["checkpoints"])
        assert covered == pytest.approx(route["distance_mi"], abs=0.06 * len(route["checkpoints"]))


def test_place_returns_coordinates_and_the_local_timezone(monkeypatch):
    planner = TripPlanner(
        geocoder=lambda text: Place("Denver, CO", (39.74, -104.99)),
        router=lambda **kwargs: [],
        forecaster=lambda points: {},
    )
    monkeypatch.setattr("planner.api.views.build_trip_planner", lambda: planner)
    body = Client().get("/api/v1/place?q=Denver").json()
    assert body == {
        "label": "Denver, CO",
        "lat": 39.74,
        "lon": -104.99,
        "timezone": "America/Denver",
    }
    assert Client().get("/api/v1/place?q=").status_code == 400
