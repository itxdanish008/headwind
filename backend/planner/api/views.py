from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..providers.geocoding import suggest
from ..services import build_trip_planner
from .serializers import (
    CorridorRequest,
    PlanRequest,
    corridor_payload,
    place_payload,
    plan_payload,
)

MIN_QUERY_CHARS = 2


@api_view(["GET", "POST", "PUT", "PATCH", "DELETE"])
def not_found(request, *args, **kwargs):
    return Response({"detail": "Not found."}, status=404)


@api_view(["GET"])
def health(request):
    return Response({"status": "ok"})


@api_view(["GET"])
def geocode(request):
    query = request.query_params.get("q", "").strip()
    return Response({"suggestions": suggest(query) if len(query) >= MIN_QUERY_CHARS else []})


@api_view(["GET"])
def place(request):
    query = request.query_params.get("q", "").strip()
    if len(query) < MIN_QUERY_CHARS:
        return Response({"detail": "Enter a place name."}, status=400)
    return Response(place_payload(build_trip_planner().place(query)))


@api_view(["POST"])
def plan(request):
    body = PlanRequest(data=request.data)
    body.is_valid(raise_exception=True)
    data = body.validated_data
    trip = build_trip_planner().plan(
        origin_text=data["origin"],
        destination_text=data["destination"],
        departure_local=data["departure_at"],
        load_lbs=data["load_lbs"],
        interval_miles=data["interval_miles"],
    )
    return Response(plan_payload(trip))


@api_view(["POST"])
def corridor(request):
    body = CorridorRequest(data=request.data)
    body.is_valid(raise_exception=True)
    grid = build_trip_planner().corridor(
        routes=body.validated_data["routes"], load_lbs=body.validated_data["load_lbs"]
    )
    return Response(corridor_payload(grid))
