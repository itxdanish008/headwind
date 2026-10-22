from dataclasses import dataclass
from datetime import datetime

from .domain.geometry import Point
from .domain.ranking import RouteSummary
from .domain.risk import Driver, Level
from .domain.sampling import Checkpoint


@dataclass(frozen=True)
class PlannedPlace:
    label: str
    point: Point
    timezone: str


@dataclass(frozen=True)
class Weather:
    wind_mph: float
    gust_mph: float
    rain_in_hr: float
    snow_in_hr: float


@dataclass(frozen=True)
class PlannedCheckpoint:
    checkpoint: Checkpoint
    eta_utc: datetime
    eta_local: datetime
    weather: Weather | None
    level: Level | None
    driver: Driver | None


@dataclass(frozen=True)
class PlannedRoute:
    id: str
    geometry: list[Point]
    distance_mi: float
    duration_s: float
    forced: bool
    checkpoints: list[PlannedCheckpoint]
    summary: RouteSummary


@dataclass(frozen=True)
class TripPlan:
    origin: PlannedPlace
    destination: PlannedPlace
    departure_utc: datetime
    routes: list[PlannedRoute]
    recommended_route_id: str
    reason: str
    warnings: list[str]


@dataclass(frozen=True)
class CorridorGrid:
    hours: list[datetime]
    cells: list[Point]
    step: float
    levels: list[int]
