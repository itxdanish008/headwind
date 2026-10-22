import logging
from collections.abc import Iterable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime
from itertools import batched

from django.conf import settings
from django.core.cache import cache

from ..domain.geometry import Point
from ..exceptions import UpstreamServiceError
from . import http

logger = logging.getLogger(__name__)

HOURLY = "wind_speed_10m,wind_gusts_10m,rain,showers,snowfall"
EXPECTED_UNITS = {
    "wind_speed_10m": "mp/h",
    "wind_gusts_10m": "mp/h",
    "rain": "inch",
    "showers": "inch",
    "snowfall": "inch",
}


@dataclass(frozen=True)
class Forecast:
    first_hour: datetime
    wind_mph: list[float]
    gust_mph: list[float]
    rain_in: list[float]
    snow_in: list[float]

    @property
    def hours(self) -> int:
        return len(self.wind_mph)


def snap(point: Point) -> Point:
    lat, lon = point
    step = settings.WEATHER["SNAP_DEG"]
    return round(round(lat / step) * step, 2), round(round(lon / step) * step, 2)


def parse_location(payload: dict) -> Forecast:
    units = payload.get("hourly_units", {})
    if any(units.get(name) != unit for name, unit in EXPECTED_UNITS.items()):
        logger.error("Unexpected Open-Meteo units: %s", units)
        raise UpstreamServiceError
    hourly = payload["hourly"]
    rain = [r + s for r, s in zip(hourly["rain"], hourly["showers"], strict=True)]
    return Forecast(
        first_hour=datetime.fromisoformat(hourly["time"][0]).replace(tzinfo=UTC),
        wind_mph=hourly["wind_speed_10m"],
        gust_mph=hourly["wind_gusts_10m"],
        rain_in=rain,
        snow_in=hourly["snowfall"],
    )


def _fetch_chunk(points: tuple[Point, ...]) -> list[Forecast]:
    params = {
        "latitude": ",".join(f"{lat:.2f}" for lat, _ in points),
        "longitude": ",".join(f"{lon:.2f}" for _, lon in points),
        "hourly": HOURLY,
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",
        "timezone": "GMT",
        "forecast_days": settings.WEATHER["FORECAST_DAYS"],
    }
    payload = http.get_json(settings.WEATHER["URL"], params=params)
    locations = payload if isinstance(payload, list) else [payload]
    if len(locations) != len(points):
        logger.error("Open-Meteo returned %d locations for %d points", len(locations), len(points))
        raise UpstreamServiceError
    return [parse_location(location) for location in locations]


def _cache_key(point: Point) -> str:
    return f"wx:{point[0]:.2f}:{point[1]:.2f}"


def fetch_forecasts(points: Iterable[Point]) -> dict[Point, Forecast]:
    wanted = list(dict.fromkeys(snap(p) for p in points))
    found: dict[Point, Forecast] = {}
    missing: list[Point] = []
    for point in wanted:
        cached = cache.get(_cache_key(point))
        if cached is None:
            missing.append(point)
        else:
            found[point] = cached

    chunks = list(batched(missing, settings.WEATHER["CHUNK_SIZE"]))
    if chunks:
        logger.info("Fetching weather for %d locations in %d requests", len(missing), len(chunks))
        failure: UpstreamServiceError | None = None
        with ThreadPoolExecutor(
            max_workers=min(len(chunks), settings.WEATHER["MAX_WORKERS"])
        ) as pool:
            futures = [pool.submit(_fetch_chunk, chunk) for chunk in chunks]
            for chunk, future in zip(chunks, futures, strict=True):
                try:
                    forecasts = future.result()
                except UpstreamServiceError as exc:
                    failure = failure or exc
                    continue
                for point, forecast in zip(chunk, forecasts, strict=True):
                    cache.set(_cache_key(point), forecast, settings.WEATHER["TTL_S"])
                    found[point] = forecast
        if failure:
            raise failure
    return found
