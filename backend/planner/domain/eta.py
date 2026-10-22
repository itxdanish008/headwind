from bisect import bisect_left
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import cache
from zoneinfo import ZoneInfo

from timezonefinder import TimezoneFinder

from .geometry import Point


@dataclass(frozen=True)
class Segment:
    length_mi: float
    duration_s: float


@dataclass(frozen=True)
class ForecastPosition:
    precip_index: int
    wind_index: int
    wind_fraction: float


def elapsed_seconds(
    miles: Sequence[float], *, route_miles: float, segments: Sequence[Segment]
) -> list[float]:
    cum_len, cum_dur = [0.0], [0.0]
    for seg in segments:
        cum_len.append(cum_len[-1] + seg.length_mi)
        cum_dur.append(cum_dur[-1] + seg.duration_s)
    if route_miles <= 0:
        return [0.0 for _ in miles]

    scale = cum_len[-1] / route_miles
    elapsed = []
    for mile in miles:
        target = min(mile * scale, cum_len[-1])
        i = max(bisect_left(cum_len, target) - 1, 0)
        length = cum_len[i + 1] - cum_len[i]
        t = (target - cum_len[i]) / length if length else 0.0
        elapsed.append(cum_dur[i] + t * (cum_dur[i + 1] - cum_dur[i]))
    return elapsed


@cache
def _finder() -> TimezoneFinder:
    return TimezoneFinder()


def timezone_name(point: Point) -> str:
    return _finder().timezone_at(lat=point[0], lng=point[1]) or "UTC"


def _zone(point: Point) -> ZoneInfo:
    return ZoneInfo(timezone_name(point))


def departure_to_utc(local: datetime, point: Point) -> datetime:
    return local.replace(tzinfo=_zone(point)).astimezone(UTC)


def to_local(moment: datetime, point: Point) -> datetime:
    return moment.astimezone(_zone(point))


def forecast_position(
    eta: datetime, *, first_hour: datetime, hours: int
) -> ForecastPosition | None:
    # Open-Meteo stamps precipitation with the end of its hour, so an ETA belongs to the
    # first stamp at or after it. Wind is instantaneous and is interpolated between stamps.
    offset = (eta - first_hour) / timedelta(hours=1)
    wind_index = int(offset // 1)
    precip_index = -int(-offset // 1)
    if offset < 0 or precip_index >= hours:
        return None
    return ForecastPosition(precip_index, wind_index, offset - wind_index)
