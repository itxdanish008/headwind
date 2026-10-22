import logging
from collections.abc import Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime

import flexpolyline
from django.conf import settings
from django.core.cache import cache

from ..domain.eta import Segment
from ..domain.geometry import Point, offset_via_points, shared_fraction
from ..exceptions import RouteNotFound, UpstreamServiceError
from . import http
from .here import here_get

logger = logging.getLogger(__name__)

KG_PER_LB = 0.45359237
MILES_PER_METER = 1 / 1609.344


@dataclass(frozen=True)
class ProviderRoute:
    geometry: list[Point]
    distance_mi: float
    duration_s: float
    segments: list[Segment]
    forced: bool = False


def gross_weight_kg(cargo_lbs: float) -> int:
    return round((cargo_lbs + settings.VEHICLE["TARE_LB"]) * KG_PER_LB)


def parse_route(route: dict, *, forced: bool = False) -> ProviderRoute:
    geometry: list[Point] = []
    segments: list[Segment] = []
    distance_m = duration_s = 0.0
    for section in route["sections"]:
        points = [(lat, lon) for lat, lon, *_ in flexpolyline.decode(section["polyline"])]
        geometry.extend(points[1:] if geometry else points)
        segments.extend(
            Segment(span["length"] * MILES_PER_METER, span["duration"]) for span in section["spans"]
        )
        distance_m += section["summary"]["length"]
        duration_s += section["summary"]["duration"]
    return ProviderRoute(geometry, distance_m * MILES_PER_METER, duration_s, segments, forced)


@dataclass(frozen=True)
class _Trip:
    origin: Point
    destination: Point
    departure: datetime
    gross_kg: int


def _request(trip: _Trip, **extra: str | int) -> list[dict]:
    params: dict[str, str | int] = {
        "transportMode": "truck",
        "origin": f"{trip.origin[0]},{trip.origin[1]}",
        "destination": f"{trip.destination[0]},{trip.destination[1]}",
        "departureTime": trip.departure.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "vehicle[grossWeight]": trip.gross_kg,
        "return": "polyline,summary",
        # Spans only split where an attribute changes; names makes them follow the road.
        "spans": "length,duration,names",
        **extra,
    }
    routes = here_get(settings.ROUTING["ROUTING_URL"], **params)["routes"]
    if not routes:
        raise RouteNotFound
    return routes


def _distinct(candidate: ProviderRoute, kept: Sequence[ProviderRoute]) -> bool:
    return all(
        shared_fraction(candidate.geometry, other.geometry)
        <= settings.ROUTING["MAX_SHARED_FRACTION"]
        for other in kept
    )


def _forced_candidate(trip: _Trip, via: Point) -> ProviderRoute | None:
    try:
        route = _request(trip, via=f"{via[0]},{via[1]}")[0]
    except UpstreamServiceError as exc:
        logger.warning("Via-point route at %s failed: %s", via, exc)
        return None
    return parse_route(route, forced=True)


def _select_distinct(provider_routes: list[ProviderRoute]) -> list[ProviderRoute]:
    kept: list[ProviderRoute] = []
    for route in provider_routes:
        if _distinct(route, kept):
            kept.append(route)
    return kept


def _add_forced_routes(kept: list[ProviderRoute], trip: _Trip) -> None:
    base = kept[0]
    for fraction in settings.ROUTING["VIA_FRACTIONS"]:
        if len(kept) >= settings.ROUTING["ROUTES_WANTED"]:
            return
        vias = offset_via_points(base.geometry, fraction=fraction)
        with ThreadPoolExecutor(max_workers=len(vias)) as pool:
            candidates = list(pool.map(lambda via: _forced_candidate(trip, via), vias))
        for candidate in candidates:
            if (
                candidate
                and len(kept) < settings.ROUTING["ROUTES_WANTED"]
                and candidate.distance_mi <= base.distance_mi * settings.ROUTING["MAX_DETOUR_RATIO"]
                and _distinct(candidate, kept)
            ):
                kept.append(candidate)


def fetch_routes(
    *, origin: Point, destination: Point, departure_utc: datetime, cargo_lbs: float
) -> list[ProviderRoute]:
    trip = _Trip(origin, destination, departure_utc, gross_weight_kg(cargo_lbs))
    key = http.cache_key("route", origin, destination, f"{departure_utc:%Y%m%d%H%M}", trip.gross_kg)
    if (cached := cache.get(key)) is not None:
        return cached

    raw = _request(trip, alternatives=settings.ROUTING["ROUTES_WANTED"] - 1)
    kept = _select_distinct([parse_route(route) for route in raw])
    if len(kept) < settings.ROUTING["ROUTES_WANTED"]:
        _add_forced_routes(kept, trip)
    cache.set(key, kept, settings.ROUTING["ROUTE_TTL_S"])
    return kept
