from dataclasses import dataclass

from django.conf import settings
from django.core.cache import cache

from ..domain.geometry import Point
from ..exceptions import LocationNotFound
from . import http
from .here import here_get


@dataclass(frozen=True)
class Place:
    label: str
    point: Point


def parse_place(payload: dict, query: str) -> Place:
    if not payload["items"]:
        raise LocationNotFound(f"No place found for {query!r}")
    item = payload["items"][0]
    if item.get("scoring", {}).get("queryScore", 1.0) < settings.ROUTING["MIN_QUERY_SCORE"]:
        raise LocationNotFound(f"No place found for {query!r}")
    return Place(item["address"]["label"], (item["position"]["lat"], item["position"]["lng"]))


def geocode(query: str) -> Place:
    key = http.cache_key("geocode", query.strip().lower())
    if (cached := cache.get(key)) is not None:
        return cached
    place = parse_place(here_get(settings.ROUTING["GEOCODE_URL"], q=query, limit=1), query)
    cache.set(key, place, settings.ROUTING["GEOCODE_TTL_S"])
    return place


def parse_suggestions(payload: dict) -> list[str]:
    return list(dict.fromkeys(item["address"]["label"] for item in payload["items"]))


def suggest(query: str) -> list[str]:
    key = http.cache_key("suggest", query.strip().lower())
    if (cached := cache.get(key)) is not None:
        return cached
    payload = here_get(
        settings.ROUTING["AUTOCOMPLETE_URL"], q=query, limit=settings.ROUTING["SUGGESTIONS"]
    )
    labels = parse_suggestions(payload)
    cache.set(key, labels, settings.ROUTING["SUGGEST_TTL_S"])
    return labels
