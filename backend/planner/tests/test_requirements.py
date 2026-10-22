import math
from datetime import datetime
from itertools import pairwise

import pytest

from planner.domain.geometry import simplify
from planner.domain.ranking import RouteScore, RouteSummary, recommend
from planner.domain.risk import Level
from planner.providers.routing import gross_weight_kg

from .conftest import east_of_i35_band, forecast, midnight_utc, post, trip


def uniform_weather(providers, *, wind=5.0, rain=0.0, snow=0.0):
    providers["weather"] = lambda point: forecast(
        wind=lambda i: wind, rain=lambda i: rain, snow=lambda i: snow
    )


def levels_of(plan: dict) -> set[str]:
    return {c["level"] for route in plan["routes"] for c in route["checkpoints"]}


def test_three_route_options_are_returned(providers):
    plan = post("/api/v1/plan", trip()).json()
    assert [route["id"] for route in plan["routes"]] == ["A", "B", "C"]


def test_the_user_enters_origin_destination_departure_and_load(providers):
    body = trip(load_lbs=30_000)
    response = post("/api/v1/plan", body)
    assert response.status_code == 200
    plan = response.json()
    assert plan["origin"]["label"].startswith("Dallas")
    assert plan["destination"]["label"].startswith("Oklahoma City")
    assert plan["departure_utc"].endswith("13:00Z")


@pytest.mark.parametrize("interval", [10, 25, 50])
def test_weather_is_sampled_every_10_25_or_50_miles(providers, interval):
    plan = post("/api/v1/plan", trip(interval_miles=interval)).json()
    for route in plan["routes"]:
        miles = [c["mile"] for c in route["checkpoints"]]
        assert miles[0] == 0
        assert miles[:-1] == pytest.approx([i * interval for i in range(len(miles) - 1)], abs=0.1)
        assert len(miles) == math.ceil(route["distance_mi"] / interval) + 1


def test_other_sampling_intervals_are_rejected(providers):
    assert post("/api/v1/plan", trip(interval_miles=15)).status_code == 400


def test_weather_is_taken_at_the_arrival_time_not_the_departure_time(providers):
    providers["weather"] = lambda point: forecast(wind=lambda i: float(i))
    route = post("/api/v1/plan", trip()).json()["routes"][0]
    first, last = route["checkpoints"][0], route["checkpoints"][-1]

    def eta_hours(checkpoint):
        eta = datetime.fromisoformat(checkpoint["eta_utc"].replace("Z", "+00:00"))
        return (eta - midnight_utc()).total_seconds() / 3600

    assert first["wind_mph"] == pytest.approx(eta_hours(first), abs=0.06)
    assert last["wind_mph"] == pytest.approx(eta_hours(last), abs=0.06)
    assert last["wind_mph"] > first["wind_mph"] + 2


def test_arrival_times_increase_along_the_route_and_show_local_time(providers):
    for route in post("/api/v1/plan", trip()).json()["routes"]:
        etas = [c["eta_utc"] for c in route["checkpoints"]]
        assert etas == sorted(etas)
        assert all(c["eta_local"] and c["tz"] for c in route["checkpoints"])


@pytest.mark.parametrize(
    ("conditions", "load", "level", "driver"),
    [
        ({"wind": 24.99}, 20_000, "LOW", None),
        ({"wind": 25}, 20_000, "MODERATE", "wind"),
        ({"wind": 35}, 20_000, "HIGH", "wind"),
        ({"wind": 45}, 20_000, "SEVERE", "wind"),
        ({"wind": 55}, 0, "NO_TRAVEL", "wind"),
        ({"rain": 0.0999}, 20_000, "LOW", None),
        ({"rain": 0.10}, 20_000, "MODERATE", "rain"),
        ({"rain": 0.25}, 20_000, "HIGH", "rain"),
        ({"rain": 0.50}, 20_000, "SEVERE", "rain"),
        ({"rain": 1.00}, 20_000, "SEVERE", "rain"),
        ({"rain": 1.0001}, 20_000, "NO_TRAVEL", "rain"),
        ({"snow": 0.49}, 20_000, "LOW", None),
        ({"snow": 0.5}, 20_000, "MODERATE", "snow"),
        ({"snow": 1.0}, 20_000, "HIGH", "snow"),
        ({"snow": 2.0}, 20_000, "SEVERE", "snow"),
        ({"snow": 3.0}, 20_000, "SEVERE", "snow"),
        ({"snow": 3.01}, 20_000, "NO_TRAVEL", "snow"),
    ],
)
def test_the_risk_table_classifies_every_checkpoint(providers, conditions, load, level, driver):
    uniform_weather(providers, **conditions)
    plan = post("/api/v1/plan", trip(load_lbs=load or 1_000)).json()
    assert levels_of(plan) == {level}
    assert {c["driver"] for r in plan["routes"] for c in r["checkpoints"]} == {driver}


@pytest.mark.parametrize(
    ("wind", "load", "level"),
    [
        (55, 1_000, "NO_TRAVEL"),
        (50, 30_000, "SEVERE"),
        (50, 30_001, "NO_TRAVEL"),
        (40, 40_000, "HIGH"),
        (40, 40_001, "SEVERE"),
        (44.99, 40_001, "SEVERE"),
        (34.99, 47_000, "MODERATE"),
    ],
)
def test_the_load_rules_raise_the_level_for_heavy_loads(providers, wind, load, level):
    uniform_weather(providers, wind=wind)
    assert levels_of(post("/api/v1/plan", trip(load_lbs=load)).json()) == {level}


def score(route_id, *, severe=0.0, high=0.0, avg=0.0, duration=36_000):
    miles = {level: 0.0 for level in Level}
    miles[Level.SEVERE], miles[Level.HIGH] = severe, high
    return RouteScore(route_id, RouteSummary(miles, avg, 0.0), duration)


def test_the_recommendation_prefers_severe_then_high_then_average_risk_then_time():
    assert recommend([score("a", severe=5, duration=1), score("b", severe=0)]).route_id == "b"
    assert recommend([score("a", high=5, duration=1), score("b", high=0)]).route_id == "b"
    assert recommend([score("a", avg=1.2, duration=1), score("b", avg=0.4)]).route_id == "b"
    assert recommend([score("a", duration=2), score("b", duration=1)]).route_id == "b"


def test_a_slower_clear_route_beats_a_faster_stormy_one(providers):
    providers["weather"] = east_of_i35_band
    plan = post("/api/v1/plan", trip()).json()
    fastest = min(plan["routes"], key=lambda r: r["duration_s"])
    assert fastest["summary"]["miles_by_level"]["NO_TRAVEL"] > 0
    assert plan["recommended_route_id"] != fastest["id"]
    assert plan["reason"]


def test_every_route_carries_what_the_map_needs(providers):
    plan = post("/api/v1/plan", trip()).json()
    for route in plan["routes"]:
        assert route["geometry"]["type"] == "LineString"
        assert route["distance_mi"] > 0 and route["duration_s"] > 0
        assert set(route["summary"]) == {"miles_by_level", "avg_risk", "unknown_miles"}
        assert set(route["summary"]["miles_by_level"]) == {
            "LOW", "MODERATE", "HIGH", "SEVERE", "NO_TRAVEL"
        }  # fmt: skip
        for checkpoint in route["checkpoints"]:
            assert {"lat", "lon", "mile", "level", "eta_utc", "eta_local", "covered_miles"} <= set(
                checkpoint
            )


def test_the_heatmap_covers_the_next_48_hours_one_hour_apart(providers, routes):
    line = [[lon, lat] for lat, lon in simplify(routes[0].geometry, tolerance_mi=0.5)]
    corridor = post("/api/v1/corridor", {"routes": [line], "load_lbs": 42_000}).json()
    stamps = [datetime.fromisoformat(h.replace("Z", "+00:00")) for h in corridor["hours"]]
    assert len(stamps) == 49
    assert {(b - a).total_seconds() for a, b in pairwise(stamps)} == {3600}
    assert len(corridor["levels"]) == len(corridor["cells"]) * 49
    assert set(corridor["levels"]) <= set(range(6))


def test_the_heatmap_applies_the_same_load_rules(providers, routes):
    line = [[lon, lat] for lat, lon in simplify(routes[0].geometry, tolerance_mi=0.5)]
    uniform_weather(providers, wind=40)
    light = post("/api/v1/corridor", {"routes": [line], "load_lbs": 20_000}).json()
    heavy = post("/api/v1/corridor", {"routes": [line], "load_lbs": 42_000}).json()
    assert set(light["levels"]) == {2}
    assert set(heavy["levels"]) == {3}


def test_load_weight_is_sent_to_the_truck_router_as_gross_kilograms():
    assert gross_weight_kg(42_000) == round((42_000 + 33_000) * 0.45359237)


@pytest.mark.parametrize("load", [0, -1, 47_001, 90_000])
def test_loads_outside_the_legal_truck_weight_are_rejected(providers, load):
    assert post("/api/v1/plan", trip(load_lbs=load)).status_code == 400
