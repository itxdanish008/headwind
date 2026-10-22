import logging
from collections.abc import Callable, Iterable, Sequence
from datetime import UTC, datetime, timedelta

from django.conf import settings

from .domain.eta import (
    ForecastPosition,
    departure_to_utc,
    elapsed_seconds,
    forecast_position,
    timezone_name,
    to_local,
)
from .domain.geometry import Point, corridor_cells, cumulative_miles, simplify
from .domain.ranking import RouteScore, recommend, summarize
from .domain.risk import Level, classify_checkpoint
from .domain.sampling import Checkpoint, sample_checkpoints
from .exceptions import InvalidDeparture
from .providers.geocoding import Place, geocode
from .providers.routing import ProviderRoute, fetch_routes
from .providers.weather import Forecast, fetch_forecasts, snap
from .types import (
    CorridorGrid,
    PlannedCheckpoint,
    PlannedPlace,
    PlannedRoute,
    TripPlan,
    Weather,
)

logger = logging.getLogger(__name__)

UNKNOWN_CELL_LEVEL = len(Level)

Geocoder = Callable[[str], Place]
Router = Callable[..., list[ProviderRoute]]
Forecaster = Callable[[Iterable[Point]], dict[Point, Forecast]]
Clock = Callable[[], datetime]


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _interpolate(values: Sequence[float], position: ForecastPosition) -> float:
    low = values[position.wind_index]
    return low + (values[position.precip_index] - low) * position.wind_fraction


def _planned_place(place: Place) -> PlannedPlace:
    return PlannedPlace(place.label, place.point, timezone_name(place.point))


def _plan_checkpoint(
    checkpoint: Checkpoint, *, eta_utc: datetime, forecast: Forecast, load_lbs: float
) -> PlannedCheckpoint:
    eta_local = to_local(eta_utc, checkpoint.point)
    position = forecast_position(eta_utc, first_hour=forecast.first_hour, hours=forecast.hours)
    if position is None:
        return PlannedCheckpoint(checkpoint, eta_utc, eta_local, None, None, None)

    weather = Weather(
        wind_mph=_interpolate(forecast.wind_mph, position),
        gust_mph=_interpolate(forecast.gust_mph, position),
        rain_in_hr=forecast.rain_in[position.precip_index],
        snow_in_hr=forecast.snow_in[position.precip_index],
    )
    result = classify_checkpoint(
        wind_mph=weather.wind_mph,
        rain_in_hr=weather.rain_in_hr,
        snow_in_hr=weather.snow_in_hr,
        load_lbs=load_lbs,
    )
    return PlannedCheckpoint(checkpoint, eta_utc, eta_local, weather, result.level, result.driver)


def _sample_route(
    route: ProviderRoute, *, departure: datetime, interval_miles: float
) -> tuple[list[Checkpoint], list[datetime], float]:
    checkpoints = sample_checkpoints(route.geometry, interval_mi=interval_miles)
    length_mi = cumulative_miles(route.geometry)[-1]
    elapsed = elapsed_seconds(
        [c.mile for c in checkpoints], route_miles=length_mi, segments=route.segments
    )
    return checkpoints, [departure + timedelta(seconds=s) for s in elapsed], length_mi


def _warnings(
    routes: Sequence[ProviderRoute],
    scores: Sequence[RouteScore],
    risk: list[str],
    *,
    interval_miles: float,
) -> list[str]:
    warnings = list(risk)
    if any(route.distance_mi < interval_miles for route in routes):
        warnings.append(
            "The trip is shorter than the sampling interval, so only its start and end are checked."
        )
    if len(routes) < settings.ROUTING["ROUTES_WANTED"]:
        warnings.append(f"Only {len(routes)} distinct routes were available for this trip.")
    if any(route.forced for route in routes):
        warnings.append("Routes marked as generated were forced through a detour point.")
    unknown = max(score.summary.unknown_miles for score in scores)
    if unknown:
        warnings.append(
            f"Up to {unknown:.0f} mi of a route is beyond the forecast horizon and is not rated."
        )
    return warnings


class TripPlanner:
    def __init__(
        self, *, geocoder: Geocoder, router: Router, forecaster: Forecaster, clock: Clock = _utc_now
    ) -> None:
        self._geocoder = geocoder
        self._router = router
        self._forecaster = forecaster
        self._clock = clock

    def place(self, text: str) -> PlannedPlace:
        return _planned_place(self._geocoder(text))

    def plan(
        self,
        *,
        origin_text: str,
        destination_text: str,
        departure_local: datetime,
        load_lbs: float,
        interval_miles: float,
    ) -> TripPlan:
        origin, destination = self.place(origin_text), self.place(destination_text)
        departure = self._departure_utc(departure_local, origin)
        routes = self._router(
            origin=origin.point,
            destination=destination.point,
            departure_utc=departure,
            cargo_lbs=load_lbs,
        )

        sampled = [
            _sample_route(route, departure=departure, interval_miles=interval_miles)
            for route in routes
        ]
        forecasts = self._forecaster(c.point for checkpoints, _, _ in sampled for c in checkpoints)

        planned, scores = [], []
        for index, (route, (checkpoints, etas, length_mi)) in enumerate(
            zip(routes, sampled, strict=True)
        ):
            route_id = chr(ord("A") + index)
            stops = [
                _plan_checkpoint(
                    checkpoint,
                    eta_utc=eta,
                    forecast=forecasts[snap(checkpoint.point)],
                    load_lbs=load_lbs,
                )
                for checkpoint, eta in zip(checkpoints, etas, strict=True)
            ]
            summary = summarize((stop.level, stop.checkpoint.covered_miles) for stop in stops)
            scores.append(RouteScore(route_id, summary, route.duration_s))
            planned.append(
                PlannedRoute(
                    id=route_id,
                    geometry=simplify(
                        route.geometry, tolerance_mi=settings.PLANNER["DISPLAY_TOLERANCE_MI"]
                    ),
                    distance_mi=length_mi,
                    duration_s=route.duration_s,
                    forced=route.forced,
                    checkpoints=stops,
                    summary=summary,
                )
            )

        recommendation = recommend(scores)
        logger.info(
            "Planned %s to %s: %d routes, recommended %s",
            origin.label,
            destination.label,
            len(routes),
            recommendation.route_id,
        )
        return TripPlan(
            origin=origin,
            destination=destination,
            departure_utc=departure,
            routes=planned,
            recommended_route_id=recommendation.route_id,
            reason=recommendation.reason,
            warnings=_warnings(
                routes, scores, recommendation.warnings, interval_miles=interval_miles
            ),
        )

    def corridor(self, *, routes: Sequence[Sequence[Point]], load_lbs: float) -> CorridorGrid:
        hours = settings.PLANNER["CORRIDOR_HOURS"]
        first_hour = self._clock().replace(minute=0, second=0, microsecond=0)
        cells, step = corridor_cells(routes)
        forecasts = self._forecaster(cells)

        levels: list[int] = []
        for cell in cells:
            forecast = forecasts[snap(cell)]
            start = round((first_hour - forecast.first_hour) / timedelta(hours=1))
            for hour in range(hours):
                i = start + hour
                if 0 <= i < forecast.hours:
                    result = classify_checkpoint(
                        wind_mph=forecast.wind_mph[i],
                        rain_in_hr=forecast.rain_in[i],
                        snow_in_hr=forecast.snow_in[i],
                        load_lbs=load_lbs,
                    )
                    levels.append(int(result.level))
                else:
                    levels.append(UNKNOWN_CELL_LEVEL)
        return CorridorGrid(
            hours=[first_hour + timedelta(hours=h) for h in range(hours)],
            cells=cells,
            step=step,
            levels=levels,
        )

    def _departure_utc(self, local: datetime, origin: PlannedPlace) -> datetime:
        departure = departure_to_utc(local, origin.point)
        now = self._clock()
        grace = timedelta(minutes=settings.PLANNER["DEPARTURE_GRACE_MIN"])
        days = settings.PLANNER["MAX_DEPARTURE_DAYS"]
        if not now - grace <= departure <= now + timedelta(days=days):
            raise InvalidDeparture(f"Departure must be between now and {days} days from now.")
        return departure


def build_trip_planner() -> TripPlanner:
    return TripPlanner(geocoder=geocode, router=fetch_routes, forecaster=fetch_forecasts)
