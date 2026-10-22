import httpx
import pytest

from planner.exceptions import LocationNotFound, UpstreamServiceError
from planner.providers.geocoding import geocode, parse_place, parse_suggestions, suggest

from .conftest import load_fixture

GEOCODE = load_fixture("here_geocode.json")
AUTOCOMPLETE = load_fixture("here_autocomplete.json")


def test_parse_place_reads_label_and_position():
    place = parse_place(GEOCODE, "Dallas, TX")
    assert place.label == "Dallas, TX, United States"
    assert place.point == (32.77823, -96.7951)


def test_parse_place_without_results_is_not_found():
    with pytest.raises(LocationNotFound, match="nowhere"):
        parse_place({"items": []}, "nowhere")


def test_a_weak_fuzzy_match_is_not_a_place():
    weak = {
        "items": [
            {
                "address": {"label": "Nowhere, Fort Cobb, OK, United States"},
                "position": {"lat": 35.15, "lng": -98.44},
                "scoring": {"queryScore": 0.5},
            }
        ]
    }
    with pytest.raises(LocationNotFound, match="zzzqqxx"):
        parse_place(weak, "zzzqqxx nowhere")


def test_a_slightly_misspelled_place_still_resolves():
    close = {
        "items": [
            {
                "address": {"label": "Dallas, TX, United States"},
                "position": {"lat": 32.78, "lng": -96.80},
                "scoring": {"queryScore": 0.99},
            }
        ]
    }
    assert parse_place(close, "Dalas, TX").label == "Dallas, TX, United States"


def test_parse_suggestions_returns_unique_labels():
    labels = parse_suggestions(AUTOCOMPLETE)
    assert labels[0] == "Dallas, TX, United States"
    assert len(labels) == len(set(labels))


def test_geocode_sends_the_query_and_caches(mock_http):
    requests = mock_http(lambda request: httpx.Response(200, json=GEOCODE))
    assert geocode("Dallas, TX").point == (32.77823, -96.7951)
    geocode("  dallas, tx ")
    assert len(requests) == 1
    assert requests[0].url.params["q"] == "Dallas, TX"
    assert requests[0].url.params["apiKey"] == "test-key"


def test_suggest_sends_the_query_and_caches(mock_http):
    requests = mock_http(lambda request: httpx.Response(200, json=AUTOCOMPLETE))
    assert suggest("dallas, t")[0] == "Dallas, TX, United States"
    suggest("dallas, t")
    assert len(requests) == 1
    assert requests[0].url.params["limit"] == "5"


def test_missing_key_is_a_provider_error(settings):
    settings.HERE_API_KEY = ""
    with pytest.raises(UpstreamServiceError, match="HERE_API_KEY"):
        geocode("Dallas")
