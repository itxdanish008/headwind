import math
from bisect import bisect_right
from collections.abc import Sequence
from itertools import pairwise

Point = tuple[float, float]  # (lat, lon)

EARTH_RADIUS_MI = 3958.7613
MILES_PER_DEGREE_LAT = 69.093


def haversine_mi(a: Point, b: Point) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + (
        math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_MI * math.asin(math.sqrt(h))


def cumulative_miles(points: Sequence[Point]) -> list[float]:
    cum = [0.0]
    for a, b in pairwise(points):
        cum.append(cum[-1] + haversine_mi(a, b))
    return cum


def point_at_distance(points: Sequence[Point], cum: Sequence[float], miles: float) -> Point:
    if miles <= 0:
        return points[0]
    if miles >= cum[-1]:
        return points[-1]
    i = bisect_right(cum, miles) - 1
    span = cum[i + 1] - cum[i]
    t = (miles - cum[i]) / span if span else 0.0
    (lat1, lon1), (lat2, lon2) = points[i], points[i + 1]
    return lat1 + (lat2 - lat1) * t, lon1 + (lon2 - lon1) * t


def corridor_cells(
    routes: Sequence[Sequence[Point]], max_cells: int = 600, base_step: float = 0.25
) -> tuple[list[Point], float]:
    """Lattice cell centres within one cell of any route, and the lattice step in degrees.

    Cells sit on a fixed lattice so different trips share weather cache entries. The step
    doubles until the cell count fits the cap.
    """
    step = base_step
    while True:
        touched = _touched_cells(routes, step)
        cells = {(i + di, j + dj) for i, j in touched for di in (-1, 0, 1) for dj in (-1, 0, 1)}
        if len(cells) <= max_cells:
            centres = [(round(i * step, 6), round(j * step, 6)) for i, j in sorted(cells)]
            return centres, step
        step *= 2


def _touched_cells(routes: Sequence[Sequence[Point]], step: float) -> set[tuple[int, int]]:
    spacing = step * MILES_PER_DEGREE_LAT / 2
    touched: set[tuple[int, int]] = set()
    for route in routes:
        cum = cumulative_miles(route)
        distances = [d * spacing for d in range(int(cum[-1] / spacing) + 1)] + [cum[-1]]
        for d in distances:
            lat, lon = point_at_distance(route, cum, d)
            touched.add((round(lat / step), round(lon / step)))
    return touched


def shared_fraction(
    route: Sequence[Point], other: Sequence[Point], tolerance_mi: float = 0.5
) -> float:
    cell = 0.02
    other_cum = cumulative_miles(other)
    grid: dict[tuple[int, int], list[Point]] = {}
    for d in [i * 0.25 for i in range(int(other_cum[-1] / 0.25) + 1)] + [other_cum[-1]]:
        lat, lon = point_at_distance(other, other_cum, d)
        grid.setdefault((round(lat / cell), round(lon / cell)), []).append((lat, lon))

    def near(point: Point) -> bool:
        i, j = round(point[0] / cell), round(point[1] / cell)
        return any(
            haversine_mi(point, candidate) <= tolerance_mi
            for di in (-1, 0, 1)
            for dj in (-1, 0, 1)
            for candidate in grid.get((i + di, j + dj), ())
        )

    cum = cumulative_miles(route)
    samples = [i * 0.5 for i in range(int(cum[-1] / 0.5) + 1)]
    if not samples:
        return 0.0
    return sum(near(point_at_distance(route, cum, d)) for d in samples) / len(samples)


def offset_via_points(route: Sequence[Point], *, fraction: float) -> tuple[Point, Point]:
    cum = cumulative_miles(route)
    total = cum[-1]
    before = point_at_distance(route, cum, total / 2 - total * 0.05)
    after = point_at_distance(route, cum, total / 2 + total * 0.05)
    mid = point_at_distance(route, cum, total / 2)

    cos_lat = math.cos(math.radians(mid[0]))
    east = (after[1] - before[1]) * cos_lat
    north = after[0] - before[0]
    norm = math.hypot(east, north)
    offset_deg = fraction * total / MILES_PER_DEGREE_LAT
    d_lat, d_lon = east / norm * offset_deg, -north / norm * offset_deg / cos_lat
    return (mid[0] + d_lat, mid[1] + d_lon), (mid[0] - d_lat, mid[1] - d_lon)


def simplify(points: Sequence[Point], *, tolerance_mi: float) -> list[Point]:
    if len(points) < 3:
        return list(points)
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        farthest, index = 0.0, 0
        for i in range(start + 1, end):
            distance = _offset_from_segment(points[i], points[start], points[end])
            if distance > farthest:
                farthest, index = distance, i
        if farthest > tolerance_mi:
            keep[index] = True
            stack += [(start, index), (index, end)]
    return [point for point, kept in zip(points, keep, strict=True) if kept]


def _offset_from_segment(p: Point, a: Point, b: Point) -> float:
    cos_lat = math.cos(math.radians(a[0]))
    ax, ay = (b[1] - a[1]) * cos_lat, b[0] - a[0]
    px, py = (p[1] - a[1]) * cos_lat, p[0] - a[0]
    length_sq = ax * ax + ay * ay
    t = max(0.0, min(1.0, (px * ax + py * ay) / length_sq)) if length_sq else 0.0
    return math.hypot(px - t * ax, py - t * ay) * MILES_PER_DEGREE_LAT
