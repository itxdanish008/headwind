from itertools import pairwise

import pytest

from planner.domain.geometry import (
    corridor_cells,
    cumulative_miles,
    haversine_mi,
    offset_via_points,
    point_at_distance,
    shared_fraction,
    simplify,
)

from .conftest import meridian


def test_haversine_one_degree_of_latitude():
    assert haversine_mi((30.0, -100.0), (31.0, -100.0)) == pytest.approx(69.09, abs=0.02)


def test_haversine_dallas_to_denver():
    assert haversine_mi((32.7767, -96.7970), (39.7392, -104.9903)) == pytest.approx(663, abs=5)


def test_haversine_same_point_is_zero():
    assert haversine_mi((40.0, -90.0), (40.0, -90.0)) == 0


def test_cumulative_miles_starts_at_zero_and_never_decreases():
    cum = cumulative_miles(meridian(30, 35))
    assert cum[0] == 0
    assert all(b >= a for a, b in pairwise(cum))
    assert cum[-1] == pytest.approx(5 * 69.09, abs=0.5)


@pytest.mark.parametrize("miles", [0, 100, 250.5])
def test_point_at_distance_lies_on_route(miles):
    route = meridian(30, 40)
    lat, lon = point_at_distance(route, cumulative_miles(route), miles)
    assert lon == -100.0
    assert haversine_mi(route[0], (lat, lon)) == pytest.approx(miles, abs=0.05)


def test_point_at_distance_clamps_to_ends():
    route = meridian(30, 40)
    cum = cumulative_miles(route)
    assert point_at_distance(route, cum, -5) == route[0]
    assert point_at_distance(route, cum, cum[-1] + 50) == route[-1]


def test_corridor_cells_sit_on_the_lattice_and_cover_the_route():
    route = meridian(30, 40)
    cells, step = corridor_cells([route])
    assert step == 0.25
    assert len(cells) == len(set(cells))
    for lat, lon in cells:
        assert lat / step == pytest.approx(round(lat / step))
        assert lon / step == pytest.approx(round(lon / step))
    for lat, lon in route[::10]:
        nearest = min(abs(lat - c_lat) + abs(lon - c_lon) for c_lat, c_lon in cells)
        assert nearest <= step


def test_corridor_cells_widens_the_lattice_to_respect_the_cap():
    route = meridian(25, 48, vertices=400)
    cells, step = corridor_cells([route], max_cells=100)
    assert len(cells) <= 100
    assert step > 0.25


def test_corridor_cells_of_a_long_trip_stay_under_the_default_cap():
    cells, _ = corridor_cells([meridian(30, 45), meridian(30, 45, lon=-98.0)])
    assert len(cells) <= 600


def test_shared_fraction_of_identical_and_disjoint_routes():
    route = meridian(30, 35)
    assert shared_fraction(route, route) == 1
    assert shared_fraction(route, meridian(30, 35, lon=-98.0)) == 0


def test_shared_fraction_respects_the_tolerance():
    route = meridian(30, 35)
    assert shared_fraction(route, meridian(30, 35, lon=-99.995)) == 1
    assert shared_fraction(route, meridian(30, 35, lon=-99.95)) == 0


def test_shared_fraction_counts_partial_overlap():
    assert shared_fraction(meridian(30, 40), meridian(30, 35)) == pytest.approx(0.5, abs=0.02)


def test_offset_via_points_straddle_the_midpoint_perpendicular_to_the_route():
    route = meridian(30, 40)
    total = cumulative_miles(route)[-1]
    left, right = offset_via_points(route, fraction=0.125)
    mid = point_at_distance(route, cumulative_miles(route), total / 2)
    for via in (left, right):
        assert via[0] == pytest.approx(mid[0], abs=0.01)
        assert haversine_mi(mid, via) == pytest.approx(0.125 * total, rel=0.02)
    assert left[1] > -100.0 > right[1] or right[1] > -100.0 > left[1]


def test_simplify_keeps_the_ends_and_the_corners():
    corner = [(30.0, -100.0), (30.5, -100.0), (31.0, -100.0), (31.0, -99.0)]
    assert simplify(corner, tolerance_mi=0.1) == [(30.0, -100.0), (31.0, -100.0), (31.0, -99.0)]


def test_simplify_drops_points_within_the_tolerance():
    wobble = [(30.0, -100.0), (30.5, -100.001), (31.0, -100.0)]
    assert simplify(wobble, tolerance_mi=0.5) == [wobble[0], wobble[-1]]
    assert len(simplify(wobble, tolerance_mi=0.01)) == 3


def test_simplify_of_a_dense_route_stays_within_the_tolerance():
    route = meridian(30, 40, vertices=2000)
    assert simplify(route, tolerance_mi=0.05) == [route[0], route[-1]]
    assert simplify(route[:2], tolerance_mi=0.05) == route[:2]
