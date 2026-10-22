import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import pytest
from django.core.cache import cache
from django.test import Client

from planner.domain.geometry import Point
from planner.providers import http
from planner.providers.geocoding import Place
from planner.providers.routing import parse_route
from planner.providers.weather import Forecast, snap
from planner.services import TripPlanner


def meridian(
    lat_from: float, lat_to: float, vertices: int = 200, lon: float = -100.0
) -> list[Point]:
    step = (lat_to - lat_from) / (vertices - 1)
    return [(lat_from + i * step, lon) for i in range(vertices)]


FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str):
    return json.loads((FIXTURES / name).read_text())


@pytest.fixture(autouse=True)
def clean_cache():
    cache.clear()


@pytest.fixture
def mock_http(monkeypatch):
    """Route provider HTTP through a handler and return the list of requests it saw."""

    def install(handler):
        requests: list[httpx.Request] = []

        def recording(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            return handler(request)

        monkeypatch.setattr(http, "client", httpx.Client(transport=httpx.MockTransport(recording)))
        monkeypatch.setattr(http.time, "sleep", lambda _: None)
        return requests

    return install


@pytest.fixture(autouse=True)
def here_key(settings):
    settings.HERE_API_KEY = "test-key"


DALLAS = Place("Dallas, TX, United States", (32.78, -96.80))
OKC = Place("Oklahoma City, OK, United States", (35.47, -97.52))
PLACES = {"Dallas, TX": DALLAS, "Oklahoma City, OK": OKC}
HOURS = 240


def midnight_utc() -> datetime:
    return datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)


def forecast(wind=lambda i: 5.0, rain=lambda i: 0.0, snow=lambda i: 0.0, hours=HOURS) -> Forecast:
    indices = range(hours)
    return Forecast(
        first_hour=midnight_utc(),
        wind_mph=[wind(i) for i in indices],
        gust_mph=[wind(i) + 10 for i in indices],
        rain_in=[rain(i) for i in indices],
        snow_in=[snow(i) for i in indices],
    )


@pytest.fixture
def routes():
    alternatives = load_fixture("here_routes_dfw_okc.json")["routes"]
    forced = load_fixture("here_route_via.json")["routes"][0]
    return [*(parse_route(r) for r in alternatives), parse_route(forced, forced=True)]


@pytest.fixture
def providers(monkeypatch, routes):
    """A planner wired to fakes; `weather` and `routes` can be changed per test."""
    state = {"weather": lambda point: forecast(), "routes": routes}
    planner = TripPlanner(
        geocoder=lambda text: PLACES[text],
        router=lambda **kwargs: state["routes"],
        forecaster=lambda points: {snap(p): state["weather"](snap(p)) for p in points},
    )
    monkeypatch.setattr("planner.api.views.build_trip_planner", lambda: planner)
    return state


def trip(**overrides) -> dict:
    departure = datetime.now(UTC) + timedelta(days=1)
    body = {
        "origin": "Dallas, TX",
        "destination": "Oklahoma City, OK",
        "departure_at": departure.strftime("%Y-%m-%dT08:00"),
        "load_lbs": 42_000,
        "interval_miles": 25,
    }
    return body | overrides


def post(path: str, body: dict):
    return Client().post(path, body, content_type="application/json")


def east_of_i35_band(point) -> Forecast:
    lat, lon = point
    stormy = 33.9 < lat < 34.6 and lon > -97.5
    return forecast(wind=lambda i: 50.0 if stormy else 5.0)
