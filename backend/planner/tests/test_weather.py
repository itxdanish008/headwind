import copy
from datetime import UTC, datetime

import httpx
import pytest
from django.conf import settings

from planner.exceptions import UpstreamServiceError
from planner.providers.weather import fetch_forecasts, parse_location, snap

from .conftest import load_fixture

MULTI = load_fixture("open_meteo_multi.json")
SINGLE = load_fixture("open_meteo_single.json")


def test_parse_recorded_location():
    forecast = parse_location(MULTI[0])
    assert forecast.first_hour == datetime(2026, 10, 21, 0, 0, tzinfo=UTC)
    assert forecast.hours == 48
    assert forecast.wind_mph == MULTI[0]["hourly"]["wind_speed_10m"]
    assert forecast.gust_mph == MULTI[0]["hourly"]["wind_gusts_10m"]


def test_rain_is_rain_plus_showers():
    payload = copy.deepcopy(MULTI[0])
    payload["hourly"]["rain"][5] = 0.06
    payload["hourly"]["showers"][5] = 0.05
    assert parse_location(payload).rain_in[5] == pytest.approx(0.11)


def test_snow_is_reported_in_inches(caplog):
    payload = copy.deepcopy(MULTI[0])
    payload["hourly"]["snowfall"][3] = 1.5
    assert parse_location(payload).snow_in[3] == 1.5

    payload["hourly_units"]["snowfall"] = "cm"
    with pytest.raises(UpstreamServiceError):
        parse_location(payload)
    assert "Unexpected Open-Meteo units" in caplog.text


def test_wind_unit_mismatch_is_rejected(caplog):
    payload = copy.deepcopy(MULTI[0])
    payload["hourly_units"]["wind_speed_10m"] = "km/h"
    with pytest.raises(UpstreamServiceError):
        parse_location(payload)
    assert "km/h" in caplog.text


def test_snap_rounds_to_five_hundredths():
    assert snap((32.7767, -96.7970)) == (32.8, -96.8)
    assert snap((39.7392, -104.9903)) == (39.75, -105.0)


def test_request_parameters_and_ordering(mock_http):
    requests = mock_http(lambda request: httpx.Response(200, json=MULTI))
    points = [(32.78, -96.80), (39.74, -104.99), (45.0, -110.0)]
    result = fetch_forecasts(points)

    assert len(requests) == 1
    query = requests[0].url.params
    assert query["latitude"] == "32.80,39.75,45.00"
    assert query["longitude"] == "-96.80,-105.00,-110.00"
    assert query["wind_speed_unit"] == "mph"
    assert query["precipitation_unit"] == "inch"
    assert query["timezone"] == "GMT"
    assert result[snap(points[1])].wind_mph == MULTI[1]["hourly"]["wind_speed_10m"]


def test_nearby_points_are_deduplicated(mock_http):
    requests = mock_http(lambda request: httpx.Response(200, json=SINGLE))
    result = fetch_forecasts([(32.78, -96.80), (32.79, -96.81), (32.8, -96.8)])
    assert len(result) == 1
    assert requests[0].url.params["latitude"] == "32.80"


def test_single_location_response_is_a_dict(mock_http):
    mock_http(lambda request: httpx.Response(200, json=SINGLE))
    assert len(fetch_forecasts([(32.78, -96.80)])) == 1


def test_large_batches_are_chunked(mock_http):
    def handler(request: httpx.Request) -> httpx.Response:
        count = len(request.url.params["latitude"].split(","))
        return httpx.Response(200, json=[MULTI[0]] * count)

    requests = mock_http(handler)
    points = [(30 + i * 0.05, -100.0) for i in range(250)]
    result = fetch_forecasts(points)
    assert len(result) == 250
    assert sorted(len(r.url.params["latitude"].split(",")) for r in requests) == [50, 100, 100]


def test_cached_points_are_not_fetched_again(mock_http):
    def handler(request: httpx.Request) -> httpx.Response:
        count = len(request.url.params["latitude"].split(","))
        return httpx.Response(200, json=[MULTI[0]] * count)

    requests = mock_http(handler)
    points = [(32.78, -96.80), (39.74, -104.99), (45.0, -110.0)]
    fetch_forecasts(points)
    fetch_forecasts(points)
    assert len(requests) == 1

    fetch_forecasts([*points, (35.0, -100.0)])
    assert len(requests) == 2
    assert len(requests[1].url.params["latitude"].split(",")) == 1


def test_transient_errors_are_retried(mock_http):
    responses = iter([httpx.Response(503), httpx.Response(200, json=SINGLE)])
    requests = mock_http(lambda request: next(responses))
    assert len(fetch_forecasts([(32.78, -96.80)])) == 1
    assert len(requests) == 2


def test_persistent_failure_raises_a_provider_error(mock_http):
    requests = mock_http(lambda request: httpx.Response(500))
    with pytest.raises(UpstreamServiceError):
        fetch_forecasts([(32.78, -96.80)])
    assert len(requests) == settings.HTTP["RETRIES"]


def test_timeouts_are_retried_then_reported(mock_http):
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    requests = mock_http(handler)
    with pytest.raises(UpstreamServiceError):
        fetch_forecasts([(32.78, -96.80)])
    assert len(requests) == settings.HTTP["RETRIES"]


def test_client_errors_are_not_retried(mock_http):
    requests = mock_http(lambda request: httpx.Response(400, json={"reason": "bad"}))
    with pytest.raises(UpstreamServiceError):
        fetch_forecasts([(32.78, -96.80)])
    assert len(requests) == 1


def test_a_failed_chunk_does_not_discard_the_chunks_that_succeeded(mock_http):
    fail = {"on": True}

    def handler(request: httpx.Request) -> httpx.Response:
        lats = request.url.params["latitude"].split(",")
        if fail["on"] and float(lats[0]) >= 31:
            return httpx.Response(429)
        return httpx.Response(200, json=[MULTI[0]] * len(lats))

    requests = mock_http(handler)
    points = [(30 + i * 0.05, -100.0) for i in range(150)]
    with pytest.raises(UpstreamServiceError):
        fetch_forecasts(points)

    fail["on"] = False
    requests.clear()
    assert len(fetch_forecasts(points)) == 150
    assert [len(r.url.params["latitude"].split(",")) for r in requests] == [50]
