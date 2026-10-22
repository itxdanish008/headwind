from datetime import datetime

from django.conf import settings
from rest_framework import serializers

from ..domain.geometry import Point
from ..types import CorridorGrid, PlannedCheckpoint, PlannedPlace, PlannedRoute, TripPlan

INTERVALS = (10, 25, 50)
MAX_GROSS_LB = settings.VEHICLE["MAX_GROSS_LB"]
TARE_LB = settings.VEHICLE["TARE_LB"]
MAX_CARGO_LB = MAX_GROSS_LB - TARE_LB
MAX_ROUTES = 3
MAX_POINTS = 10_000


def _load_field() -> serializers.IntegerField:
    return serializers.IntegerField(
        min_value=1,
        max_value=MAX_CARGO_LB,
        error_messages={
            "max_value": f"Cargo plus the {TARE_LB:,} lb tractor-trailer must not "
            f"exceed {MAX_GROSS_LB:,} lb."
        },
    )


class PlanRequest(serializers.Serializer):
    origin = serializers.CharField(max_length=200)
    destination = serializers.CharField(max_length=200)
    departure_at = serializers.CharField()
    load_lbs = _load_field()
    interval_miles = serializers.ChoiceField(choices=INTERVALS)

    def validate_departure_at(self, value: str) -> datetime:
        try:
            departure = datetime.fromisoformat(value)
        except ValueError as exc:
            raise serializers.ValidationError(
                "Use a local date and time like 2026-10-22T08:00."
            ) from exc
        if departure.tzinfo is not None:
            raise serializers.ValidationError("Send the origin's local time without an offset.")
        return departure

    def validate_interval_miles(self, value: str) -> int:
        return int(value)


class CorridorRequest(serializers.Serializer):
    routes = serializers.ListField(
        child=serializers.ListField(
            child=serializers.ListField(child=serializers.FloatField(), min_length=2, max_length=2),
            min_length=2,
            max_length=MAX_POINTS,
        ),
        min_length=1,
        max_length=MAX_ROUTES,
    )
    load_lbs = _load_field()

    def validate_routes(self, routes: list) -> list[list[tuple[float, float]]]:
        converted = []
        for route in routes:
            if any(not (-90 <= lat <= 90 and -180 <= lon <= 180) for lon, lat in route):
                raise serializers.ValidationError("Coordinates must be [lon, lat] within range.")
            converted.append([(lat, lon) for lon, lat in route])
        return converted


UNKNOWN = "UNKNOWN"


def _iso(moment: datetime) -> str:
    return moment.isoformat(timespec="minutes").replace("+00:00", "Z")


def place_payload(place: PlannedPlace) -> dict:
    return {
        "label": place.label,
        "lat": place.point[0],
        "lon": place.point[1],
        "timezone": place.timezone,
    }


def _checkpoint_payload(stop: PlannedCheckpoint) -> dict:
    point = stop.checkpoint
    payload = {
        "mile": round(point.mile, 1),
        "lat": round(point.lat, 5),
        "lon": round(point.lon, 5),
        "eta_utc": _iso(stop.eta_utc),
        "eta_local": stop.eta_local.isoformat(timespec="minutes"),
        "tz": stop.eta_local.tzname(),
        "covered_miles": round(point.covered_miles, 2),
    }
    if stop.weather is None or stop.level is None:
        return payload | {
            "wind_mph": None,
            "gust_mph": None,
            "rain_in_hr": None,
            "snow_in_hr": None,
            "level": UNKNOWN,
            "driver": None,
        }
    return payload | {
        "wind_mph": round(stop.weather.wind_mph, 1),
        "gust_mph": round(stop.weather.gust_mph, 1),
        "rain_in_hr": round(stop.weather.rain_in_hr, 3),
        "snow_in_hr": round(stop.weather.snow_in_hr, 3),
        "level": stop.level.name,
        "driver": stop.driver,
    }


def _line_string(points: list[Point]) -> dict:
    return {
        "type": "LineString",
        "coordinates": [[round(lon, 5), round(lat, 5)] for lat, lon in points],
    }


def _route_payload(route: PlannedRoute) -> dict:
    summary = route.summary
    return {
        "id": route.id,
        "geometry": _line_string(route.geometry),
        "distance_mi": round(route.distance_mi, 1),
        "duration_s": round(route.duration_s),
        "forced": route.forced,
        "checkpoints": [_checkpoint_payload(stop) for stop in route.checkpoints],
        "summary": {
            "miles_by_level": {
                level.name: round(miles, 1) for level, miles in summary.miles_by_level.items()
            },
            "avg_risk": None if summary.avg_risk is None else round(summary.avg_risk, 2),
            "unknown_miles": round(summary.unknown_miles, 1),
        },
    }


def plan_payload(plan: TripPlan) -> dict:
    return {
        "origin": place_payload(plan.origin),
        "destination": place_payload(plan.destination),
        "departure_utc": _iso(plan.departure_utc),
        "routes": [_route_payload(route) for route in plan.routes],
        "recommended_route_id": plan.recommended_route_id,
        "reason": plan.reason,
        "warnings": plan.warnings,
    }


def corridor_payload(grid: CorridorGrid) -> dict:
    return {
        "hours": [_iso(hour) for hour in grid.hours],
        "cells": [list(cell) for cell in grid.cells],
        "step": grid.step,
        "levels": grid.levels,
    }
