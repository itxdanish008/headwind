from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field

from .risk import Level


@dataclass(frozen=True)
class RouteSummary:
    miles_by_level: dict[Level, float]
    avg_risk: float | None
    unknown_miles: float


@dataclass(frozen=True)
class RouteScore:
    route_id: str
    summary: RouteSummary
    duration_s: float


@dataclass(frozen=True)
class Recommendation:
    route_id: str
    reason: str
    warnings: list[str] = field(default_factory=list)


def summarize(covered: Iterable[tuple[Level | None, float]]) -> RouteSummary:
    miles_by_level = {level: 0.0 for level in Level}
    unknown = 0.0
    for level, miles in covered:
        if level is None:
            unknown += miles
        else:
            miles_by_level[level] += miles
    known = sum(miles_by_level.values())
    avg = sum(level * miles for level, miles in miles_by_level.items()) / known if known else None
    return RouteSummary(miles_by_level, avg, unknown)


def route_sort_key(route: RouteScore) -> tuple[float, float, float, float, float]:
    # No Travel is a stricter state than Severe, so it leads even though the spec skips it.
    # Rounding keeps float noise from deciding a tie.
    miles = route.summary.miles_by_level
    return (
        round(miles[Level.NO_TRAVEL], 1),
        round(miles[Level.SEVERE], 1),
        round(miles[Level.HIGH], 1),
        round(route.summary.avg_risk or 0.0, 2),
        route.duration_s,
    )


def _miles(value: float) -> str:
    return f"{value:.1f} mi"


def _average(value: float) -> str:
    return f"{value:.2f}"


def _duration(seconds: float) -> str:
    minutes = round(seconds / 60)
    return f"{minutes // 60} h {minutes % 60:02d} min"


def _duration_exact(seconds: float) -> str:
    hours, rest = divmod(round(seconds), 3600)
    minutes, secs = divmod(rest, 60)
    return f"{hours} h {minutes:02d} min {secs:02d} s"


def _describe(index: int, won: float, lost: float) -> str:
    label, fmt = _CRITERIA[index]
    won_text, lost_text = fmt(won), fmt(lost)
    if fmt is _duration and won_text == lost_text:
        won_text, lost_text = _duration_exact(won), _duration_exact(lost)
    return f"{label}: {won_text} vs {lost_text}"


_CRITERIA = (
    ("Fewest No Travel miles", _miles),
    ("Fewest Severe miles", _miles),
    ("Fewest High miles", _miles),
    ("Lowest average risk", _average),
    ("Shortest travel time at equal risk", _duration),
)


def _first_difference(a: tuple, b: tuple) -> int | None:
    return next((i for i, (x, y) in enumerate(zip(a, b, strict=True)) if x != y), None)


def _reason(best: RouteScore, rivals: Sequence[RouteScore]) -> str:
    best_key = route_sort_key(best)
    separated = [
        (index, rival)
        for rival in rivals
        if (index := _first_difference(best_key, route_sort_key(rival))) is not None
    ]
    if not separated:
        return "Tied with the other routes on risk and travel time."
    index, rival = min(separated, key=lambda pair: pair[0])
    rival_key = route_sort_key(rival)
    reason = f"{_describe(index, best_key[index], rival_key[index])} on Route {rival.route_id}."

    level = [(i, r) for i, r in separated if i > index]
    if level:
        later, tied = min(level, key=lambda pair: pair[0])
        detail = _describe(later, best_key[later], route_sort_key(tied)[later])
        reason += f" Route {tied.route_id} ties there; {detail[0].lower()}{detail[1:]}."
    return reason


def recommend(routes: Sequence[RouteScore]) -> Recommendation:
    ranked = sorted(routes, key=route_sort_key)
    best = ranked[0]
    reason = _reason(best, ranked[1:]) if len(ranked) > 1 else "Only route available."
    warnings = []
    if all(r.summary.miles_by_level[Level.NO_TRAVEL] > 0 for r in routes):
        warnings.append("Every route has No Travel conditions. Delay the trip or reroute.")
    return Recommendation(best.route_id, reason, warnings)
