"""
Compensation Benchmarking engine — deterministic checks.
Run from the backend/ directory:
    python3 tests/test_benchmarking_engine.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import math
import numpy as np

from engine.benchmarking_engine import (
    calculate_weighted_percentiles, run_regression, suggest_weights,
)

passed = 0
failed = 0


def check(label, cond):
    global passed, failed
    if cond:
        passed += 1
        print(f"  PASS  {label}")
    else:
        failed += 1
        print(f"  FAIL  {label}")


print("== Weighted percentile == numpy.percentile when weights are uniform ==")
rng = np.random.default_rng(42)
for trial in range(20):
    n = rng.integers(2, 30)
    values = rng.normal(100, 30, size=n).tolist()
    weights = [1.0] * n
    result = calculate_weighted_percentiles(values, weights)
    for q, key in [(25, "p25"), (50, "p50"), (75, "p75")]:
        expected = float(np.percentile(values, q, method="linear"))
        check(f"trial {trial} n={n} {key}: {result[key]:.4f} vs numpy {expected:.4f}",
              abs(result[key] - expected) < 1e-9)

print("\n== Weighted percentile responds sensibly to non-uniform weights ==")
# The formula pins position 0 to the lowest value and position 1 to the highest
# value exactly, regardless of weights (mirroring numpy's own 'linear' method,
# which always anchors min->rank0/max->rank100 regardless of n). A direct
# consequence: the highest-valued point's OWN weight cannot move its own
# (fixed-at-1.0) position, so it has no effect on the result. Weight on any
# interior or minimum point does shift the interpolation, as shown below.
values = [10, 20, 30, 40]
baseline = calculate_weighted_percentiles(values, [1, 1, 1, 1])
heavy_low = calculate_weighted_percentiles(values, [10, 1, 1, 1])
heavy_interior = calculate_weighted_percentiles(values, [1, 10, 1, 1])
heavy_high = calculate_weighted_percentiles(values, [1, 1, 1, 10])
check("heavy low weight pulls p50 down", heavy_low["p50"] < baseline["p50"])
check("heavy interior weight shifts p25", heavy_interior["p25"] != baseline["p25"])
check("heavy weight on the max point leaves percentiles unchanged (pinned at position 1.0)",
      heavy_high["p50"] == baseline["p50"] and heavy_high["p75"] == baseline["p75"])

print("\n== Regression: recovers known log-linear relationship ==")
true_intercept, true_slope = 5.0, 0.6
sizes = np.array([1, 2, 5, 10, 20, 50, 100, 200, 500, 1000], dtype=float)
pay = np.exp(true_intercept + true_slope * np.log(sizes))
weights = [1.0] * len(sizes)
reg = run_regression(pay.tolist(), sizes.tolist(), weights, client_size=50.0)
check("regression_valid is True with 10 peers", reg["regression_valid"] is True)
check(f"slope recovered ({reg['slope']:.4f} vs {true_slope})", abs(reg["slope"] - true_slope) < 1e-6)
check(f"intercept recovered ({reg['intercept']:.4f} vs {true_intercept})", abs(reg["intercept"] - true_intercept) < 1e-6)
check(f"R-squared ~= 1.0 for noiseless data ({reg['r_squared']:.6f})", abs(reg["r_squared"] - 1.0) < 1e-6)
expected_client_pred = math.exp(true_intercept + true_slope * math.log(50.0))
check("client predicted pay matches formula", abs(reg["client_predicted_pay"] - expected_client_pred) < 1e-6)

print("\n== Regression: falls back gracefully below the 8-peer minimum ==")
reg_small = run_regression(pay[:5].tolist(), sizes[:5].tolist(), [1.0] * 5, client_size=50.0)
check("regression_valid is False with only 5 peers", reg_small["regression_valid"] is False)
check("regression_warning is set", reg_small["regression_warning"] is not None)
check("slope is None on fallback", reg_small["slope"] is None)

print("\n== suggest_weights: decay by log-distance, clamped to [0.1, 1.0] ==")
# NOTE: the spec's prose says "~0.22 at 10x larger/smaller" but its own formula
# (exp(-1.5 * distance), distance = |log(peer) - log(client)|) gives
# exp(-1.5*ln(10)) = 10^-1.5 ≈ 0.0316 at exactly 10x — which the [0.1, 1.0] floor
# then clamps to 0.1. The two numbers in the spec don't reconcile; this test
# follows the literal formula, which is unambiguous, over the prose example.
w = suggest_weights([100.0, 1000.0, 10000.0, 1.0], client_size=100.0)
check("exact size match => weight 1.0", abs(w[0] - 1.0) < 1e-9)
unclamped_10x = math.exp(-1.5 * math.log(10))
check(f"10x larger => clamped to floor 0.1 (formula value {unclamped_10x:.4f} is below the floor)", abs(w[1] - 0.1) < 1e-9)
check("100x larger => still >= 0.1 (clamped)", w[2] >= 0.1)
check("all weights within [0.1, 1.0]", all(0.1 <= x <= 1.0 for x in w))
w_missing = suggest_weights([None, 50.0], client_size=100.0)
check("missing size data => weight 0.1", abs(w_missing[0] - 0.1) < 1e-9)

print("\n== excel_percentrank replicates Excel PERCENTRANK.INC ==")
from engine.benchmarking_engine import excel_percentrank

# Interpolation + truncation: rank of sorted point i is i/(n-1), truncated to 3 digits.
arr = [10.0, 20.0, 30.0, 40.0, 50.0]
check("exact match at index 1 => 25.0", excel_percentrank(arr, 20.0) == 25.0)
check("midpoint 25 => 37.5", excel_percentrank(arr, 25.0) == 37.5)
check("below min clamps to 0", excel_percentrank(arr, 5.0) == 0.0)
check("above max clamps to 100", excel_percentrank(arr, 99.0) == 100.0)
check("nulls dropped from array", excel_percentrank([10.0, None, 30.0], 20.0) == 50.0)
# Truncation, not rounding: 1/3 = 0.33333... -> 33.3 (and 2/3 -> 66.6, NOT 66.7)
check("truncates like Excel (2/3 -> 66.6)", excel_percentrank([0.0, 1.0, 2.0, 3.0], 2.0) == 66.6)

print("\n== Data aging (spec §1) ==")
from engine.benchmarking_engine import age_peer, compute_yoy
from models.benchmarking import BenchmarkData, PeerRecord, PriorYearRecord

AGING = 0.03


def _peer(ticker, salary=None, next_salary=None, sti=None, lti=None,
          sti3=None, lti3=None, tdc=None, year=2025, is_client=False):
    return PeerRecord(
        lookup_key=f"{ticker}_{year}_CEO", ticker=ticker, company_name=ticker,
        year=year, role_tags=["CEO"], base_salary=salary,
        base_salary_next_year=next_salary, stip_target_pct=sti,
        ltip_target_pct=lti, stip_3yr_avg_pct=sti3, ltip_3yr_avg_pct=lti3,
        target_tdc=tdc, is_client=is_client,
    )


# Per-peer rule: disclosed next-year salary bypasses the multiplier entirely.
d = age_peer(_peer("A", salary=1000.0, next_salary=1100.0, sti=1.0, lti=2.0), AGING)
check("disclosed next-year salary used as-is (no multiplier)", d.aged_salary == 1100.0 and d.used_disclosed)
check("aged TDC built off disclosed salary", abs(d.aged_tdc - (1100 + 1100 * 1.0 + 1100 * 2.0)) < 1e-9)

# No disclosure: salary * (1 + factor), current-year %s carried forward unchanged.
d = age_peer(_peer("B", salary=1000.0, sti=0.5, lti=1.5), AGING)
check("undisclosed salary aged by (1+factor)", abs(d.aged_salary - 1030.0) < 1e-9)
check("STI/LTI %s carried forward, not re-forecast", abs(d.aged_tdc - (1030 * (1 + 0.5 + 1.5))) < 1e-9)

# 3-year-average fallback when Target % is missing (Excel CEO!N9/U9 behavior).
d = age_peer(_peer("C", salary=1000.0, sti=1.5, lti=None, lti3=3.15), AGING)
check("missing Target LTI % falls back to 3-yr average", abs(d.aged_ltip - 1030 * 3.15) < 1e-9)

# Missing both % sources: aged TDC is null (drops out), not zero.
d = age_peer(_peer("D", salary=1000.0), AGING)
check("missing %s => aged TDC is None (percentile dropout, not zero)", d.aged_tdc is None)

# Client-row exception (§1.5): the client's projection value is the current
# Target TDC passed straight through — the client must never be aged.
client = _peer("CLIENT", salary=1000.0, sti=1.0, lti=2.0, tdc=5000.0, is_client=True)
peers = [_peer(t, salary=s, sti=1.0, lti=2.0, tdc=s * 4)
         for t, s in [("P1", 900.0), ("P2", 1000.0), ("P3", 1100.0), ("P4", 1200.0)]]
data = BenchmarkData(
    client_ticker="CLIENT", reporting_currency="CAD", default_year=2025,
    available_years=[2025], roles=["CEO"], peers=peers + [client],
    peer_sizes=[], aging_factor=AGING,
)
yoy = compute_yoy(data, "CEO")
aged_col = [y for y in yoy.years if y.aged][0]
current_col = [y for y in yoy.years if y.year == 2025][0]
check("client TDC identical in current and aged columns (pass-through)",
      aged_col.client == current_col.client == 5000.0)
check("client absent from the aged peer list", all(p.ticker != "CLIENT" for p in yoy.aged_peers))
expected_aged_p2 = 1000.0 * 1.03 * 4  # salary*(1+3%) * (1 + 100% + 200%)
check("peer rows ARE aged in the same run (not a blanket skip)",
      any(abs((p.aged_tdc or 0) - expected_aged_p2) < 1e-6 for p in yoy.aged_peers))

# Aging factor is a parameter, not a constant: a different factor changes output.
yoy_5 = compute_yoy(data, "CEO", aging_factor=0.05)
check("aging factor override propagates (5% != 3% output)",
      yoy_5.years[-1].p50 != yoy.years[-1].p50 and yoy_5.aging_factor == 0.05)
check("client still passed through unchanged under override", yoy_5.years[-1].client == 5000.0)

# Percentiles drop nulls (a peer with no aged TDC must not count as zero).
data_with_null = data.model_copy(deep=True)
data_with_null.peers.append(_peer("NULLPEER", salary=800.0))  # no %s => null aged TDC
yoy_null = compute_yoy(data_with_null, "CEO")
check("null aged TDC dropped from percentiles (n unchanged)",
      [y for y in yoy_null.years if y.aged][0].n_peers == 4)

# Prior-year column comes from import records, not the degenerate raw rows.
data_prior = data.model_copy(deep=True)
data_prior.prior_year_records = [
    PriorYearRecord(lookup_key=f"{t}_2024_CEO", ticker=t, role="CEO", company_name=t,
                    year=2024, target_tdc=v, is_client=(t == "CLIENT"))
    for t, v in [("P1", 3000.0), ("P2", 3500.0), ("P3", 4000.0), ("CLIENT", 4800.0)]
]
yoy_prior = compute_yoy(data_prior, "CEO")
col_2024 = [y for y in yoy_prior.years if y.year == 2024][0]
check("prior-year column present from import records", col_2024.p50 == 3500.0 and col_2024.n_peers == 3)
check("prior-year client from import, excluded from peer percentiles", col_2024.client == 4800.0)

# Prior-year hardcoded overrides take precedence field-by-field.
from models.benchmarking import PriorYearOverride
yoy_ov = compute_yoy(data_prior, "CEO",
                     prior_year_override=PriorYearOverride(p50=9999.0, client=8888.0))
col_ov = [y for y in yoy_ov.years if y.year == 2024][0]
check("override replaces p50 and client", col_ov.p50 == 9999.0 and col_ov.client == 8888.0)
check("non-overridden fields keep import-derived values", col_ov.p25 is not None and col_ov.p75 == 3750.0)
yoy_ov2 = compute_yoy(data, "CEO",  # no import records at all
                      prior_year_override=PriorYearOverride(p25=1.0, p50=2.0, p75=3.0, client=2.5))
col_ov2 = [y for y in yoy_ov2.years if y.year == 2024]
check("override alone creates the prior-year column", len(col_ov2) == 1 and col_ov2[0].p50 == 2.0)

# Manual peer exclusion from the aged-year calc (analyst mirrors a source
# workbook's hand-deleted "-" cell without a hardcoded/general rule).
yoy_excl = compute_yoy(data_with_null, "CEO", excluded_tickers=["P2"])
aged_excl = [y for y in yoy_excl.years if y.aged][0]
check("excluded ticker drops out of aged percentile n_peers", aged_excl.n_peers == 3)
p2_detail = next(p for p in yoy_excl.aged_peers if p.ticker == "P2")
check("excluded peer flagged but still returned in aged_peers", p2_detail.excluded and p2_detail.aged_tdc is not None)
non_excluded = [p for p in yoy_excl.aged_peers if p.ticker != "P2"]
check("non-excluded peers not flagged", all(not p.excluded for p in non_excluded))

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
