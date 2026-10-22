from collections.abc import Sequence
from dataclasses import dataclass
from itertools import pairwise

from .geometry import Point, cumulative_miles, point_at_distance

EPSILON_MI = 1e-6


@dataclass(frozen=True)
class Checkpoint:
    mile: float
    lat: float
    lon: float
    covered_miles: float

    @property
    def point(self) -> Point:
        return self.lat, self.lon


def sample_checkpoints(points: Sequence[Point], *, interval_mi: float) -> list[Checkpoint]:
    cum = cumulative_miles(points)
    total = cum[-1]
    miles = [0.0]
    if total > EPSILON_MI:
        k = 1
        while k * interval_mi < total - EPSILON_MI:
            miles.append(k * interval_mi)
            k += 1
        miles.append(total)

    edges = [0.0, *((a + b) / 2 for a, b in pairwise(miles)), total]
    return [
        Checkpoint(mile, *point_at_distance(points, cum, mile), covered_miles=hi - lo)
        for mile, (lo, hi) in zip(miles, pairwise(edges), strict=True)
    ]
