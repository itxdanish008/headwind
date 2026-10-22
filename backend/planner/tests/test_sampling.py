import pytest

from planner.domain.geometry import cumulative_miles
from planner.domain.sampling import sample_checkpoints

from .conftest import meridian

ROUTE = meridian(30, 40)
LENGTH = cumulative_miles(ROUTE)[-1]


@pytest.mark.parametrize("interval", [10, 25, 50])
def test_spacing_and_endpoints(interval):
    checkpoints = sample_checkpoints(ROUTE, interval_mi=interval)
    miles = [c.mile for c in checkpoints]
    assert miles[0] == 0
    assert miles[-1] == pytest.approx(LENGTH)
    assert miles[:-1] == pytest.approx([i * interval for i in range(len(miles) - 1)])
    assert checkpoints[0].lat == ROUTE[0][0]
    assert checkpoints[-1].lat == ROUTE[-1][0]


@pytest.mark.parametrize("interval", [10, 25, 50])
def test_covered_miles_sum_to_route_length(interval):
    checkpoints = sample_checkpoints(ROUTE, interval_mi=interval)
    assert sum(c.covered_miles for c in checkpoints) == pytest.approx(LENGTH)


def test_coverage_splits_at_midpoints():
    checkpoints = sample_checkpoints(ROUTE, interval_mi=25)
    assert checkpoints[0].covered_miles == pytest.approx(12.5)
    assert checkpoints[1].covered_miles == pytest.approx(25)
    last_gap = LENGTH - checkpoints[-2].mile
    assert checkpoints[-1].covered_miles == pytest.approx(last_gap / 2)


def test_trip_shorter_than_interval_has_origin_and_destination_only():
    short = meridian(30, 30.5)
    checkpoints = sample_checkpoints(short, interval_mi=50)
    assert [c.mile for c in checkpoints] == [0, pytest.approx(cumulative_miles(short)[-1])]
    assert sum(c.covered_miles for c in checkpoints) == pytest.approx(cumulative_miles(short)[-1])


def test_destination_is_not_duplicated_when_length_is_an_exact_multiple():
    interval = LENGTH / 4
    miles = [c.mile for c in sample_checkpoints(ROUTE, interval_mi=interval)]
    assert len(miles) == 5


def test_zero_length_route_has_a_single_checkpoint():
    checkpoints = sample_checkpoints([(30.0, -100.0), (30.0, -100.0)], interval_mi=25)
    assert len(checkpoints) == 1
    assert checkpoints[0].covered_miles == 0
