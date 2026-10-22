from dataclasses import dataclass
from enum import IntEnum
from typing import Literal

Driver = Literal["wind", "rain", "snow"]


class Level(IntEnum):
    LOW = 0
    MODERATE = 1
    HIGH = 2
    SEVERE = 3
    NO_TRAVEL = 4


@dataclass(frozen=True)
class Classification:
    level: Level
    driver: Driver | None


@dataclass(frozen=True)
class _Scale:
    bounds: tuple[float, float, float]
    no_travel: float
    no_travel_inclusive: bool

    def level(self, value: float) -> Level:
        # Unit-converted inputs carry float noise, so 0.1 must not read as 0.0999999.
        value = round(value, 4)
        if value >= self.no_travel if self.no_travel_inclusive else value > self.no_travel:
            return Level.NO_TRAVEL
        return Level(sum(value >= bound for bound in self.bounds))


# The spec's ranges share endpoints. Severe's upper end is inclusive for rain and snow
# because No Travel is defined as strictly greater; wind No Travel is >= 55 as written.
WIND = _Scale((25, 35, 45), 55, no_travel_inclusive=True)
RAIN = _Scale((0.10, 0.25, 0.50), 1.00, no_travel_inclusive=False)
SNOW = _Scale((0.5, 1.0, 2.0), 3.0, no_travel_inclusive=False)

NO_TRAVEL_LOAD_LBS = 30_000
SEVERE_LOAD_LBS = 40_000


def wind_level(mph: float, *, load_lbs: float) -> Level:
    level = WIND.level(mph)
    if level == Level.SEVERE and load_lbs > NO_TRAVEL_LOAD_LBS:
        return Level.NO_TRAVEL
    if level == Level.HIGH and load_lbs > SEVERE_LOAD_LBS:
        return Level.SEVERE
    return level


def rain_level(in_per_hr: float) -> Level:
    return RAIN.level(in_per_hr)


def snow_level(in_per_hr: float) -> Level:
    return SNOW.level(in_per_hr)


def classify_checkpoint(
    *, wind_mph: float, rain_in_hr: float, snow_in_hr: float, load_lbs: float
) -> Classification:
    levels: list[tuple[Level, Driver]] = [
        (wind_level(wind_mph, load_lbs=load_lbs), "wind"),
        (rain_level(rain_in_hr), "rain"),
        (snow_level(snow_in_hr), "snow"),
    ]
    level, driver = max(levels, key=lambda pair: pair[0])
    return Classification(level, driver if level > Level.LOW else None)
