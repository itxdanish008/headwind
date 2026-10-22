from datetime import UTC, datetime
from itertools import pairwise

import pytest

from planner.domain.eta import (
    Segment,
    departure_to_utc,
    elapsed_seconds,
    forecast_position,
    to_local,
)

SEGMENTS = [Segment(10, 600), Segment(30, 1800), Segment(10, 1200)]


def test_elapsed_follows_segment_speeds():
    assert elapsed_seconds([0, 5, 10, 25, 50], route_miles=50, segments=SEGMENTS) == pytest.approx(
        [0, 300, 600, 1500, 3600]
    )


def test_elapsed_is_monotonic():
    miles = [i * 0.5 for i in range(101)]
    elapsed = elapsed_seconds(miles, route_miles=50, segments=SEGMENTS)
    assert all(b >= a for a, b in pairwise(elapsed))


def test_elapsed_rescales_when_segment_lengths_differ_from_geometry():
    assert elapsed_seconds(
        [0, 25, 50], route_miles=50, segments=[Segment(500, 3600)]
    ) == pytest.approx([0, 1800, 3600])


def test_elapsed_for_zero_length_route_is_zero():
    assert elapsed_seconds([0], route_miles=0, segments=[Segment(0, 0)]) == [0]


def test_departure_is_read_in_the_origin_timezone():
    local = datetime(2026, 10, 22, 8, 0)
    assert departure_to_utc(local, (32.78, -96.80)) == datetime(2026, 10, 22, 13, 0, tzinfo=UTC)
    assert departure_to_utc(local, (39.74, -104.99)) == datetime(2026, 10, 22, 14, 0, tzinfo=UTC)


def test_standard_time_applies_after_daylight_saving_ends():
    local = datetime(2026, 12, 1, 8, 0)
    assert departure_to_utc(local, (32.78, -96.80)) == datetime(2026, 12, 1, 14, 0, tzinfo=UTC)


def test_to_local_uses_the_checkpoint_timezone():
    moment = datetime(2026, 10, 22, 20, 0, tzinfo=UTC)
    assert to_local(moment, (32.78, -96.80)).hour == 15
    assert to_local(moment, (39.74, -104.99)).hour == 14


FIRST = datetime(2026, 10, 22, 10, 0, tzinfo=UTC)


@pytest.mark.parametrize(
    ("eta", "precip_index", "wind_index", "wind_fraction"),
    [
        (datetime(2026, 10, 22, 10, 0, tzinfo=UTC), 0, 0, 0),
        (datetime(2026, 10, 22, 10, 30, tzinfo=UTC), 1, 0, 0.5),
        (datetime(2026, 10, 22, 11, 0, tzinfo=UTC), 1, 1, 0),
        (datetime(2026, 10, 22, 12, 15, tzinfo=UTC), 3, 2, 0.25),
    ],
)
def test_forecast_position_uses_the_hour_ending_at_or_after_the_eta(
    eta, precip_index, wind_index, wind_fraction
):
    position = forecast_position(eta, first_hour=FIRST, hours=49)
    assert position is not None
    assert position.precip_index == precip_index
    assert position.wind_index == wind_index
    assert position.wind_fraction == pytest.approx(wind_fraction)


def test_forecast_position_is_none_outside_the_forecast():
    assert (
        forecast_position(datetime(2026, 10, 22, 9, 59, tzinfo=UTC), first_hour=FIRST, hours=49)
        is None
    )
    assert (
        forecast_position(datetime(2026, 10, 24, 10, 0, tzinfo=UTC), first_hour=FIRST, hours=49)
        is not None
    )
    assert (
        forecast_position(datetime(2026, 10, 24, 10, 1, tzinfo=UTC), first_hour=FIRST, hours=49)
        is None
    )
