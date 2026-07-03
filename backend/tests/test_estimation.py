from app.defaults import DEFAULT_CONFIG
from app.estimation import (compare_sessions, compute_estimate,
                            compute_function_points, compute_vaf)

PARAMS = {
    "screens": 10, "use_cases": 8, "business_objects": 5,
    "interfaces": 3, "batches": 2, "languages": 2, "roles": 3,
}


def test_function_points_average_weights():
    fp = compute_function_points(PARAMS, DEFAULT_CONFIG)
    # screens 10*4 + use_cases 8*5 + BOs 5*10 + interfaces 3*7 + batches 2*5
    # + languages (2-1)*4 + roles (3-1)*4 = 40+40+50+21+10+4+8 = 173
    assert fp["unadjusted"] == 173
    assert fp["adjusted"] == 173  # VAF disabled -> 1.0
    assert fp["vaf"] == 1.0


def test_first_language_and_role_not_counted():
    fp = compute_function_points({**PARAMS, "languages": 1, "roles": 1}, DEFAULT_CONFIG)
    by_param = {c["param"]: c for c in fp["components"]}
    assert by_param["languages"]["fp"] == 0
    assert by_param["roles"]["fp"] == 0


def test_vaf():
    vaf, tdi = compute_vaf({"performance": 5, "complex_processing": 3})
    assert tdi == 8
    assert abs(vaf - 0.73) < 1e-9

    fp = compute_function_points(PARAMS, DEFAULT_CONFIG, vaf_enabled=True,
                                 gsc={"performance": 5, "complex_processing": 3})
    assert fp["adjusted"] == round(173 * 0.73, 2)


def test_vaf_scores_clamped():
    vaf, tdi = compute_vaf({"performance": 99, "reusability": -4})
    assert tdi == 5  # clamped to 0..5


def test_complexity_weighting_configurable():
    config = {**DEFAULT_CONFIG, "complexity": {**DEFAULT_CONFIG["complexity"],
                                               "business_objects": "high"}}
    fp = compute_function_points(PARAMS, config)
    by_param = {c["param"]: c for c in fp["components"]}
    assert by_param["business_objects"]["weight"] == 15
    assert by_param["business_objects"]["fp"] == 75


def test_variants_effort_and_cost():
    result = compute_estimate(PARAMS, DEFAULT_CONFIG)
    classic = result["variants"]["classic"]
    assert classic["hours"]["expected"] == 173 * 14
    assert classic["cost"]["expected"] == 173 * 14 * 120
    assert classic["hours"]["best"] == round(173 * 14 * 0.85, 1)
    assert classic["hours"]["worst"] == round(173 * 14 * 1.35, 1)

    agentic = result["variants"]["agentic"]
    assert agentic["hours"]["expected"] == 173 * 2


def test_phase_distribution_sums_to_total():
    result = compute_estimate(PARAMS, DEFAULT_CONFIG)
    for variant in result["variants"].values():
        total_cost = sum(p["cost"] for p in variant["phases"].values())
        assert abs(total_cost - variant["cost"]["expected"]) < 1.0


def test_operations_and_consulting_based_on_implementation():
    result = compute_estimate(PARAMS, DEFAULT_CONFIG)
    agile = result["variants"]["agile"]
    impl_cost = agile["phases"]["implementation"]["cost"]
    assert agile["operations"]["annual_cost"] == round(impl_cost * 0.15, 2)
    assert agile["consulting"]["cost"] == round(impl_cost * 0.10, 2)


def test_token_estimate():
    result = compute_estimate(PARAMS, DEFAULT_CONFIG)
    tokens = result["tokens"]
    assert tokens["total_tokens"] == 173 * 400_000
    assert tokens["cost"] == round(173 * 400_000 / 1_000_000 * 8, 2)


def test_drilldown_by_param_sums_to_total():
    result = compute_estimate(PARAMS, DEFAULT_CONFIG)
    agile = result["variants"]["agile"]
    total = sum(p["cost"] for p in agile["by_param"].values())
    assert abs(total - agile["cost"]["expected"]) < 1.0


def test_zero_params():
    result = compute_estimate({}, DEFAULT_CONFIG)
    assert result["function_points"]["adjusted"] == 0
    assert result["variants"]["classic"]["cost"]["expected"] == 0


def test_compare_sessions():
    r1 = compute_estimate(PARAMS, DEFAULT_CONFIG)
    params2 = {**PARAMS, "screens": 14, "interfaces": 4}
    r2 = compute_estimate(params2, DEFAULT_CONFIG)
    delta = compare_sessions(
        {"version": 1, "params": PARAMS, "results": r1},
        {"version": 2, "params": params2, "results": r2},
    )
    assert delta["fp_delta"] == r2["function_points"]["adjusted"] - r1["function_points"]["adjusted"]
    screens = next(d for d in delta["param_deltas"] if d["param"] == "screens")
    assert screens["delta"] == 4
    assert delta["cost_deltas"]["agile"] == round(
        r2["variants"]["agile"]["cost"]["expected"] - r1["variants"]["agile"]["cost"]["expected"], 2
    )
