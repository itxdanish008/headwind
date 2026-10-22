import pytest

from planner.domain.ranking import (
    RouteScore,
    RouteSummary,
    recommend,
    route_sort_key,
    summarize,
)
from planner.domain.risk import Level


def score(route_id, *, no_travel=0.0, severe=0.0, high=0.0, avg=0.0, duration=36_000):
    miles = {level: 0.0 for level in Level}
    miles[Level.NO_TRAVEL] = no_travel
    miles[Level.SEVERE] = severe
    miles[Level.HIGH] = high
    return RouteScore(route_id, RouteSummary(miles, avg, 0.0), duration)


def test_summarize_weights_risk_by_covered_miles():
    summary = summarize([(Level.LOW, 10), (Level.HIGH, 30)])
    assert summary.avg_risk == pytest.approx(1.5)
    assert summary.miles_by_level[Level.LOW] == 10
    assert summary.miles_by_level[Level.HIGH] == 30
    assert summary.unknown_miles == 0


def test_summarize_excludes_unknown_from_the_average():
    summary = summarize([(Level.MODERATE, 20), (None, 80)])
    assert summary.avg_risk == pytest.approx(1.0)
    assert summary.unknown_miles == 80


def test_summarize_with_only_unknown_has_no_average():
    summary = summarize([(None, 50)])
    assert summary.avg_risk is None
    assert summary.unknown_miles == 50


def test_no_travel_ranks_worse_than_any_amount_of_severe():
    blocked = score("blocked", no_travel=5, severe=0)
    slow = score("slow", severe=300)
    assert recommend([blocked, slow]).route_id == "slow"


def test_severe_then_high_then_average_then_duration():
    routes = [
        score("a", severe=10, high=0, avg=0.5, duration=100),
        score("b", severe=0, high=50, avg=2.0, duration=900),
        score("c", severe=0, high=20, avg=1.5, duration=900),
        score("d", severe=0, high=20, avg=1.0, duration=950),
        score("e", severe=0, high=20, avg=1.0, duration=800),
    ]
    assert [r.route_id for r in sorted(routes, key=route_sort_key)] == ["e", "d", "c", "b", "a"]


def test_mileage_is_rounded_to_a_tenth_before_comparing():
    noisy = score("noisy", severe=10.04, avg=1.2, duration=500)
    clean = score("clean", severe=10.0, avg=1.1, duration=900)
    assert recommend([noisy, clean]).route_id == "clean"


def test_average_is_rounded_to_two_decimals_before_comparing():
    slower = score("slower", avg=1.004, duration=900)
    faster = score("faster", avg=1.001, duration=500)
    assert recommend([slower, faster]).route_id == "faster"


def test_identical_routes_keep_provider_order():
    assert recommend([score("first"), score("second")]).route_id == "first"


def test_reason_names_the_deciding_criterion():
    reason = recommend([score("a", severe=0), score("b", severe=12)]).reason
    assert "Severe" in reason
    assert "12.0 mi" in reason

    reason = recommend([score("a", high=0, severe=3), score("b", high=9, severe=3)]).reason
    assert "High" in reason

    reason = recommend([score("a", avg=0.5), score("b", avg=1.5)]).reason
    assert "average risk" in reason

    reason = recommend([score("a", duration=47_100), score("b", duration=49_200)]).reason
    assert "13 h 05 min" in reason
    assert "13 h 40 min" in reason


def test_reason_for_a_tie_and_for_a_single_route():
    assert "Tied" in recommend([score("a"), score("b")]).reason
    assert "Only route" in recommend([score("a")]).reason


def test_warns_when_every_route_has_no_travel_miles():
    result = recommend([score("a", no_travel=10), score("b", no_travel=40)])
    assert result.route_id == "a"
    assert len(result.warnings) == 1
    assert "No Travel" in result.warnings[0]


def test_no_warning_when_a_route_avoids_no_travel():
    assert recommend([score("a", no_travel=10), score("b")]).warnings == []


def test_reason_cites_the_criterion_that_beat_the_riskiest_rival_not_just_the_runner_up():
    routes = [
        score("a", no_travel=25, duration=900),
        score("b", duration=1000),
        score("c", duration=1100),
    ]
    result = recommend(routes)
    assert result.route_id == "b"
    assert "No Travel" in result.reason
    assert "on Route a." in result.reason


def test_reason_mentions_a_rival_that_ties_on_the_deciding_criterion():
    routes = [
        score("a", avg=0.0, duration=44_555),
        score("b", avg=0.03, duration=45_720),
        score("c", avg=0.0, duration=44_601),
    ]
    result = recommend(routes)
    assert result.route_id == "a"
    assert result.reason.startswith("Lowest average risk: 0.00 vs 0.03 on Route b.")
    assert "Route c ties there; shortest travel time at equal risk" in result.reason
    assert "12 h 22 min 35 s vs 12 h 23 min 21 s" in result.reason


def test_reason_has_no_tie_sentence_when_every_rival_is_separated_at_once():
    assert "ties" not in recommend([score("a", severe=0), score("b", severe=12)]).reason
