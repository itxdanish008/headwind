import pytest

from planner.domain.risk import Level, classify_checkpoint, rain_level, snow_level, wind_level

LIGHT_LOAD = 20_000


@pytest.mark.parametrize(
    ("mph", "expected"),
    [
        (0, Level.LOW),
        (24.99, Level.LOW),
        (25, Level.MODERATE),
        (34.99, Level.MODERATE),
        (35, Level.HIGH),
        (44.99, Level.HIGH),
        (45, Level.SEVERE),
        (54.99, Level.SEVERE),
        (55, Level.NO_TRAVEL),
        (80, Level.NO_TRAVEL),
    ],
)
def test_wind_thresholds_for_a_light_load(mph, expected):
    assert wind_level(mph, load_lbs=LIGHT_LOAD) == expected


@pytest.mark.parametrize(
    ("in_hr", "expected"),
    [
        (0, Level.LOW),
        (0.0999, Level.LOW),
        (0.10, Level.MODERATE),
        (0.2499, Level.MODERATE),
        (0.25, Level.HIGH),
        (0.4999, Level.HIGH),
        (0.50, Level.SEVERE),
        (1.00, Level.SEVERE),
        (1.0001, Level.NO_TRAVEL),
    ],
)
def test_rain_thresholds(in_hr, expected):
    assert rain_level(in_hr) == expected


def test_rain_float_noise_does_not_drop_a_boundary_value_a_level():
    assert rain_level(0.07 + 0.03 - 1e-12) == Level.MODERATE


@pytest.mark.parametrize(
    ("in_hr", "expected"),
    [
        (0, Level.LOW),
        (0.49, Level.LOW),
        (0.5, Level.MODERATE),
        (0.99, Level.MODERATE),
        (1.0, Level.HIGH),
        (1.99, Level.HIGH),
        (2.0, Level.SEVERE),
        (3.0, Level.SEVERE),
        (3.01, Level.NO_TRAVEL),
    ],
)
def test_snow_thresholds(in_hr, expected):
    assert snow_level(in_hr) == expected


@pytest.mark.parametrize(
    ("mph", "load", "expected"),
    [
        (50, 30_000, Level.SEVERE),
        (50, 30_001, Level.NO_TRAVEL),
        (45, 30_001, Level.NO_TRAVEL),
        (54.99, 30_001, Level.NO_TRAVEL),
        (40, 40_000, Level.HIGH),
        (40, 40_001, Level.SEVERE),
        (35, 40_001, Level.SEVERE),
        (40, 30_001, Level.HIGH),
        (44.99, 80_000, Level.SEVERE),
        (34.99, 80_000, Level.MODERATE),
        (55, 0, Level.NO_TRAVEL),
        (30, 80_000, Level.MODERATE),
    ],
)
def test_wind_load_rules(mph, load, expected):
    assert wind_level(mph, load_lbs=load) == expected


def test_checkpoint_takes_the_worst_condition_and_names_it():
    result = classify_checkpoint(wind_mph=30, rain_in_hr=0.3, snow_in_hr=0, load_lbs=LIGHT_LOAD)
    assert (result.level, result.driver) == (Level.HIGH, "rain")

    result = classify_checkpoint(wind_mph=10, rain_in_hr=0, snow_in_hr=2.5, load_lbs=LIGHT_LOAD)
    assert (result.level, result.driver) == (Level.SEVERE, "snow")


def test_load_rule_can_make_wind_the_driver():
    result = classify_checkpoint(wind_mph=40, rain_in_hr=0.3, snow_in_hr=0, load_lbs=41_000)
    assert (result.level, result.driver) == (Level.SEVERE, "wind")


def test_ties_prefer_wind_then_rain_then_snow():
    result = classify_checkpoint(wind_mph=30, rain_in_hr=0.1, snow_in_hr=0.5, load_lbs=LIGHT_LOAD)
    assert (result.level, result.driver) == (Level.MODERATE, "wind")
    result = classify_checkpoint(wind_mph=0, rain_in_hr=0.1, snow_in_hr=0.5, load_lbs=LIGHT_LOAD)
    assert (result.level, result.driver) == (Level.MODERATE, "rain")


def test_calm_weather_has_no_driver():
    result = classify_checkpoint(wind_mph=5, rain_in_hr=0, snow_in_hr=0, load_lbs=LIGHT_LOAD)
    assert (result.level, result.driver) == (Level.LOW, None)
