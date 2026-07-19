# STIP / LTIP Scenario Analysis Platform
## Phase 2 Build Specification

**May 2026**

| FRONTEND | BACKEND |
|---|---|
| React + TypeScript | Python 3.11 + FastAPI |
| Recharts for visualisation | NumPy / SciPy / Pandas |
| Tailwind CSS (brand palette) | openpyxl for Excel I/O |

---

## Context

This document outlines the Phase 2 enhancements to the STIP/LTIP Scenario Analysis Platform. The platform was built as a local consulting tool to model short- and long-term incentive plan designs for executive compensation clients. Phase 1 established the core simulation engine, Black-Scholes option pricing, and rTSR/internal-metric PSU modeling.

Phase 2 adds enhancements that expand the platform's instrument coverage and analytical depth. The changes are designed to keep the platform general-purpose — applicable to any client — while enabling design scenarios that were previously impossible to model.

---

## What Currently Exists

The platform has two modules — STIP and LTIP — each backed by a Monte Carlo simulation engine.

**LTIP Engine (the focus of Phase 2):**

| Vehicle | How it's valued | How it vests |
|---|---|---|
| RSUs | Units × terminal share price | Time-based (cliff or graded) |
| PSUs | Units × terminal price × multiplier | Multiplier from rTSR vs. peers, internal metric, or both |
| Standard Options | Units × max(S_T − K, 0) | Time-based (cliff or graded) |

The simulation runs a correlated Geometric Brownian Motion (GBM) across the company and all uploaded peer companies, drawing from the Cholesky decomposition of a historical correlation matrix. All volatility and growth rate assumptions for peers are pulled from the Excel upload (historical data). The company's expected growth rate (CAGR) is the one user-supplied forward-looking input.

**Current limitations being addressed in Phase 2:**
1. No instrument type exists where vesting is conditional on a financial metric hurdle (e.g. ROE, EBIT Margin)
2. No instrument type supports stock price hurdle vesting on a PSU
3. All volatility and peer growth rate assumptions are backward-looking with no override path
4. The PSU curve designer applies one curve per vehicle type — per-metric curves are not supported
5. The STIP scorecard applies one global payout curve to all metrics — per-metric curves are not supported
6. Results show aggregate payout totals — per-vehicle contribution is not broken out visually
7. The simulation does not output goal-setting probability tables — it only shows payout given fixed goals

---

## Priority 1 — Performance Stock Options (Financial Metric Hurdle)

### Overview

A **performance stock option** is a standard stock option with an additional vesting gate: the option only vests (partially or fully) if a specified financial metric clears a performance hurdle during the performance period. Unlike a price-hurdle option (where the gate is the stock hitting a target price), the gate here is an internal operating metric such as Return on Equity (ROE), EBIT Margin, ROIC, or Revenue Growth.

The option still behaves like a regular option once vested — its value is driven by the stock price. But *whether* it vests, and *how much* of it vests, is determined by the financial metric simulation.

**The dual condition:** There are two gates that must both be cleared:
1. The financial metric must clear at least the threshold → some fraction of options vest
2. The stock price at exercise must be above the strike price → those vested options are in the money

If the metric clears but the stock is flat or down, the options vest but are underwater — worth nothing. If the stock doubles but the metric misses completely, the options never vest — also worth nothing.

Two measurement patterns are supported, covering the range of designs seen in practice:

### Two Measurement Types

**Annual Tranches:**
Each year of the performance period is tested independently. The metric is simulated forward year by year. Each year's options tranche (1/N of the total grant) vests at the rate determined by that year's curve result. A bad year does not forfeit future years. Total vesting is the sum of each year's weighted contribution.

Mathematically, since each year carries equal weight (1/N), the total vesting fraction equals the average of the annual payout percentages. These are equivalent: summing N equal-weight tranches produces the same number as averaging N values. The code implements this as a weighted sum to make the logic explicit and to allow unequal tranche weights in future.

**Period Average:**
The metric is simulated year by year, but the test happens only once — at the end — using the average value across all years. One outcome, one payout percentage, applied to the full option grant.

### How the Financial Metric Simulation Works

The simulation models the metric as a single stochastic process. Two frameworks are supported:

**Geometric Brownian Motion (GBM)** — for metrics that grow multiplicatively (Revenue, EBIT):
```
X_T = X_0 × exp((g − σ²/2) × T + σ × √T × Z)
```

**Effective Annual Growth Rate (EAGR)** — for ratio metrics near a natural mean (ROE %, EBIT Margin %):
```
X_T = X_0 + X_0 × g + σ × √T × Z
```

Where: X_0 = starting value, g = expected growth rate, σ = historical standard deviation, Z = standard normal random variable.

### Payout Curve and Hurdles

The hurdles and the payout curve are the same thing described two different ways. The curve defines three bend points — each one is a hurdle level:

```
Below Threshold value    →   0% vests          ← threshold hurdle
At Threshold value       →   Threshold payout % (e.g. 25%)
At Target value          →   Target payout % (e.g. 50% or 100%)
At or above Maximum      →   Maximum payout % (e.g. 100%)
Between points           →   Linear interpolation
```

For annual tranches, the curve can vary by year — the hurdle levels can escalate over the performance period. Year-by-year curves are entered through a tabbed interface in the frontend (one tab per year, each with its own threshold/target/max inputs).

### New Backend Function: `run_metric_monte_carlo()`

```python
import numpy as np
from typing import List, Dict, Any, Literal

def run_metric_monte_carlo(
    starting_value: float,
    growth_rates: List[float],          # one per year, e.g. [0.05, 0.07, 0.09, 0.08, 0.08]
    volatility: float,                  # annualised std dev of the metric
    payout_curves: List[Dict],          # one curve dict per year
    measurement_type: Literal["annual_tranches", "period_average"],
    framework: Literal["gbm", "eagr"],
    n_simulations: int = 100_000,
) -> Dict[str, Any]:
    """
    Simulates a financial metric over a multi-year performance period.
    Returns probability-weighted expected payout % and hurdle probabilities.
    """
    rng = np.random.default_rng()
    n_years = len(growth_rates)
    n = n_simulations

    # Simulate metric path year by year
    metric_path = np.zeros((n_years, n))
    current = np.full(n, starting_value)

    for yr_idx, g in enumerate(growth_rates):
        Z = rng.standard_normal(n)
        if framework == "gbm":
            current = current * np.exp((g - 0.5 * volatility**2) + volatility * Z)
        else:  # eagr
            current = current + current * g + volatility * current * Z
        metric_path[yr_idx] = current

    if measurement_type == "annual_tranches":
        # Each year contributes 1/n_years of the total grant (equal-weight tranches)
        # Total vesting = sum of (tranche_weight × annual_payout_pct) = mean of annual payouts
        tranche_weight = 1.0 / n_years
        total_per_sim = sum(
            tranche_weight * _apply_payout_curve(metric_path[yr], payout_curves[yr])
            for yr in range(n_years)
        )
        year_payouts = [
            float(np.mean(_apply_payout_curve(metric_path[yr], payout_curves[yr])))
            for yr in range(n_years)
        ]
        hurdle_probs = [_hurdle_probabilities(metric_path[yr], payout_curves[yr])
                        for yr in range(n_years)]
    else:  # period_average
        average_metric = metric_path.mean(axis=0)
        total_per_sim = _apply_payout_curve(average_metric, payout_curves[0])
        year_payouts = None
        hurdle_probs = [_hurdle_probabilities(average_metric, payout_curves[0])]

    return {
        "expected_payout_pct": float(np.mean(total_per_sim)),
        "payout_by_year": year_payouts,
        "hurdle_probabilities": hurdle_probs,
        "payout_distribution": np.percentile(total_per_sim, np.arange(1, 101)).tolist(),
        # Goal-setting output: probability of achieving each hurdle
        "goal_setting_table": _goal_setting_table(total_per_sim),
    }


def _apply_payout_curve(metric_values: np.ndarray, curve: Dict) -> np.ndarray:
    """Vectorised piecewise payout. Returns array of payout fractions (0.0 – max_payout)."""
    t_val, t_pay = curve["threshold_value"], curve["threshold_payout"]
    tgt_val, tgt_pay = curve["target_value"], curve["target_payout"]
    max_val, max_pay = curve["max_value"], curve["max_payout"]
    v = metric_values
    out = np.zeros(len(v))
    mask1 = (v >= t_val) & (v < tgt_val)
    denom1 = tgt_val - t_val
    out[mask1] = t_pay + np.where(denom1 > 0, (v[mask1] - t_val) / denom1, 1.0) * (tgt_pay - t_pay)
    mask2 = (v >= tgt_val) & (v < max_val)
    denom2 = max_val - tgt_val
    out[mask2] = tgt_pay + np.where(denom2 > 0, (v[mask2] - tgt_val) / denom2, 1.0) * (max_pay - tgt_pay)
    out[v >= max_val] = max_pay
    return out


def _hurdle_probabilities(metric_values: np.ndarray, curve: Dict) -> Dict:
    return {
        "prob_above_threshold": float(np.mean(metric_values >= curve["threshold_value"])),
        "prob_above_target":    float(np.mean(metric_values >= curve["target_value"])),
        "prob_above_max":       float(np.mean(metric_values >= curve["max_value"])),
    }


def _goal_setting_table(payout_distribution: np.ndarray) -> Dict:
    """
    Reverse output: given the simulation, what metric level corresponds
    to each probability of achievement? Used for goal-setting conversations.
    """
    return {
        "threshold_90pct": float(np.percentile(payout_distribution, 10)),
        "target_50pct":    float(np.percentile(payout_distribution, 50)),
        "max_10pct":       float(np.percentile(payout_distribution, 90)),
    }
```

### Integration with the LTIP Simulation

```python
# New fourth vehicle weight alongside rsu_wt, psu_wt, opt_wt
perf_opt_wt = float(payload.get("perf_option_weight", 0.0))
perf_opt_fv_pct = option_fair_value_pct(S=S0, K=K, T=perf_opt_term, r=r, q=q, sigma=sigma)
perf_opt_units = (grant_value * perf_opt_wt) / (S0 * perf_opt_fv_pct)

# Run the financial metric Monte Carlo (separate from stock price GBM)
metric_result = run_metric_monte_carlo(**payload["perf_option_metric"])
expected_payout = metric_result["expected_payout_pct"]   # e.g. 0.33

# Realised value: intrinsic option value × probability-weighted vesting fraction
perf_opt_val = perf_opt_units * np.maximum(S_T_co - K, 0.0) * expected_payout

# Accounting fair value shown in results:
# Performance Option FV = Black-Scholes Value × Expected Payout %
# e.g.  $36.86 × 33% = $12.16 per option
```

### Frontend Changes

A new section appears when `perf_option_weight > 0`:

**Panel A — Metric Setup**

| Field | Type | Default | Notes |
|---|---|---|---|
| Metric name | Dropdown + free-text | ROE | Pre-populated: ROE, EBIT Margin, ROIC, Revenue Growth, EPS |
| Starting value | Numeric | — | Client's current metric level (e.g. 14.2%) |
| Simulation framework | Toggle: GBM / EAGR | EAGR | EAGR for ratio metrics; GBM for absolute dollar metrics |
| Measurement type | Toggle: Annual Tranches / Period Average | Annual Tranches | Drives payout aggregation |
| Historical volatility (σ) | Numeric | — | Std dev from historical data |
| Contractual term (years) | Numeric | 6 | Option life after grant |

**Panel B — Per-Year Growth Rate Grid**
One row per year of the performance period. Default: same rate all years. Each row independently editable.

**Panel C — Per-Year Payout Curve (Annual Tranches)**
Tabbed interface — one tab per year. Each tab: threshold value, threshold payout %, target value, target payout %, max value, max payout %. Live chart previews the curve shape. For Period Average: single curve panel.

**Results Addition:** Fourth bar "Perf. Options" in purple (#7C3AED). Shows Expected Payout %, Accounting Fair Value, and year-by-year hurdle probability table for annual tranches.

---

## Priority 2 — Per-Metric Payout Curves (STIP and PSU)

### Overview

Currently one global payout curve applies to all STIP scorecard metrics, and one curve applies to all internal PSU metrics. In practice, different metrics warrant different curve designs — an ESG score might require a higher threshold before any payout (90% of target), while a stretch financial metric might have a lower threshold (75%). This is standard practice in real executive plans and is now supported for both STIP and PSU.

### STIP — Per-Metric Curves

**Backend change:** Each metric in the STIP scorecard payload now carries its own `curve` dict instead of inheriting a global one:

```python
# Before: one global curve applied to all metrics
curve = payload["curve_design"]
multiplier = calculate_multiplier(achievement, curve)

# After: each metric carries its own curve
for metric in payload["scorecard_metrics"]:
    curve = metric["curve"]          # metric-specific curve
    multiplier = calculate_multiplier(achievement, curve)
```

**Frontend change:** In the Scorecard Builder, each metric row gains an "Edit Curve" button that opens that metric's individual threshold/target/max curve designer. The global curve card is removed. A default curve (80%/50%→100%/100%→120%/200%) is pre-populated for each new metric and can be overridden per row.

### PSU — Per-Metric Internal Curves

**Backend change:** `_compute_psu_mult()` receives a list of `{name, weight, volatility, curve}` dicts instead of one curve:

```python
# After (Phase 2)
internal_metrics = psu_cfg["internal_metrics"]  # list of metrics with individual curves

internal_mult = np.zeros(n)
for metric in internal_metrics:
    z_m   = rng.standard_normal(n)
    ach_m = np.maximum(1.0 + metric["volatility"] * z_m, 0.0)
    mult_m = np.array([calculate_multiplier_achievement(float(a), metric["curve"])
                       for a in ach_m])
    internal_mult += metric["weight"] * mult_m
```

**Frontend change:** The internal metric section of the PSU Curve Designer becomes a repeatable list. Each metric has: name, weight (%), volatility, and an Edit Curve button. A running weight total must equal 100%. The rTSR sub-panel is unchanged.

---

## Priority 3 — Forward-Looking Assumption Flexibility

### Overview

All volatility and growth rate assumptions currently come exclusively from the uploaded Excel price history. This priority adds the ability to override any assumption with forward-looking estimates. This affects both the GBM stock price simulation (where it has the largest impact) and the Black-Scholes option pricing (where it changes the fair value of options).

**Where these assumptions flow through the model:**

| Assumption | Affects GBM simulation | Affects Black-Scholes |
|---|---|---|
| Company volatility (σ) | Yes — drives stock price path variance | Yes — drives option fair value |
| Peer volatility (σ_i) | Yes — drives peer price paths, rTSR gap | No |
| Company growth rate (μ) | Yes — drives expected stock price drift | No |
| Peer growth rate (μ_i) | Yes — drives expected peer drift, rTSR gap | No |

The GBM impact is primary. Overriding a peer's volatility changes every simulated price path for that peer, which changes the rTSR gap distribution, which changes the PSU multiplier distribution, which changes total payout. Black-Scholes is a secondary but visible impact on option unit sizing.

### Backend Change

```python
def run_ltip_simulation(payload: Dict[str, Any], market_data: Dict[str, Any]) -> Dict[str, Any]:

    # Start from historical values
    annual_vol    = market_data["annual_vol"].copy()
    annual_return = market_data["annual_return"].copy()

    # Apply forward-looking overrides — any ticker not listed uses historical value
    vol_overrides    = payload.get("volatility_overrides", {})
    growth_overrides = payload.get("growth_rate_overrides", {})

    for ticker, vol in vol_overrides.items():
        if ticker in annual_vol:
            annual_vol[ticker] = float(vol)

    for ticker, g in growth_overrides.items():
        if ticker in annual_return:
            annual_return[ticker] = float(g)

    # Build GBM vectors from (possibly overridden) values — rest of simulation unchanged
    mu_vec    = np.array([annual_return.get(t, 0.06) for t in tickers])
    sigma_vec = np.array([annual_vol[t] for t in tickers])
```

The company growth rate override (`mu_co`) that already exists continues to work as a special case of this mechanism.

### Frontend Change

**Simulation Parameters panel (primary location — GBM inputs):**
A collapsible section "Override Forward-Looking Assumptions" contains:
- Company volatility toggle: Historical (read-only display) vs. Custom/Implied (editable input). A single override here flows to both GBM and Black-Scholes automatically.
- Peer override table: one row per uploaded peer, columns for Historical CAGR (read-only), Override CAGR, Historical Vol (read-only), Override Vol. Fields left blank use historical values. Reset button restores all to historical.

| Peer | Historical CAGR | Override CAGR | Historical Vol (σ) | Override Vol (σ) |
|---|---|---|---|---|
| CNQ | 8.2% | [ ___ ] | 31.4% | [ ___ ] |
| TOU | 6.7% | [ ___ ] | 28.1% | [ ___ ] |

The Black-Scholes panel shows company volatility as a read-only display that reflects whatever value is active (historical or overridden) — it does not have its own separate toggle.

---

## Priority 4 — Per-Vehicle Result Breakdown

### Overview

The simulation already returns per-vehicle values at each percentile. This priority makes that breakdown visible as a contribution table in the results panel, enabling consultants to quantify what each vehicle is contributing to total realised value.

### Backend Change

None. The data already exists in the simulation output:
```json
{ "base": { "rsu": 241000, "psu": 389000, "option": 172000, "total": 802000 } }
```

### Frontend Change

Below the existing stacked bar chart, add a vehicle contribution table:

| Vehicle | Bear Case | Base Case | Bull Case |
|---|---|---|---|
| RSU | $X (X%) | $X (X%) | $X (X%) |
| PSU | $X (X%) | $X (X%) | $X (X%) |
| Options | $X (X%) | $X (X%) | $X (X%) |
| **Total** | **$X** | **$X** | **$X** |

Percentage = that vehicle's share of total for that scenario. Computed in the frontend from existing data. If performance stock options are present (Priority 1), a fourth row is added in purple.

---

## Priority 5 — Multi-Year Average Measurement (Bundled with Priority 1)

The `measurement_type: "period_average"` path in `run_metric_monte_carlo()` documented under Priority 1 covers this. No additional work required.

**Example configuration:**
- Metric: ROE, Starting value: 14.2%, Growth: +1%/year, Volatility: 2.5%
- Measurement: average ROE across years 1–5, tested once at end of period
- Payout curve: threshold 13%, target 14.5%, max 16%

---

## Priority 6 — Goal-Setting Probability Output

### Overview

A use case the platform does not currently support: using the Monte Carlo simulation in reverse to answer "given these assumptions, what should the threshold, target, and maximum levels be set at?" This is distinct from the current flow, which asks "given fixed goals, what will the payout distribution be?"

The output is a probability table that a consultant can present to a compensation committee to justify why a particular goal level is appropriately rigorous:

```
Metric: Pre-Tax Profit    Starting value: $2,323M    Volatility: 64%

Probability of Achievement    Implied Goal Level
          90%  (Threshold)    $307M     ← easy to hit, right level for threshold
          50%  (Target)       $1,643M   ← median outcome, right level for target
          10%  (Maximum)      $2,981M   ← only 10% chance, genuinely stretch
```

The choice of historical lookback period used to derive volatility has a significant impact on the width of the goal range — a shorter lookback excluding crisis years produces tighter goals, while a longer lookback incorporating volatile periods produces a wider range. The lookback selector makes this sensitivity visible and adjustable.

### Backend Change

The `run_metric_monte_carlo()` function already computes this via `_goal_setting_table()` (included in Priority 1 code). For the STIP simulation, the same output needs to be added to `run_stip_simulation()`:

```python
def run_stip_simulation(payload: dict) -> dict:
    # ... existing simulation logic ...

    # Goal-setting output: for each metric, what value corresponds to 90/50/10% achievement?
    goal_setting = {}
    for i, metric in enumerate(metrics):
        metric_sims = achievement[i] * metric["budget_target"]   # convert back to absolute values
        goal_setting[metric["name"]] = {
            "threshold_90pct": float(np.percentile(metric_sims, 10)),
            "target_50pct":    float(np.percentile(metric_sims, 50)),
            "max_10pct":       float(np.percentile(metric_sims, 90)),
        }

    return {
        # ... existing outputs ...
        "goal_setting": goal_setting,
    }
```

### Frontend Change

A new collapsible section in the STIP results: "Goal-Setting Recommendation." Shows a table per metric with the probability-implied threshold/target/max values. Includes a note explaining what each probability level means in plain language.

A **lookback period selector** is added to the Simulation Parameters panel:
- Options: 3-year, 5-year, 7-year, 10-year, Full history
- Default: Full history (current behaviour)
- Changing the lookback recalculates volatility from only that window of the uploaded price data and re-runs the simulation

---

## PSU with Stock Price Hurdles — Future Build

This design uses PSUs where vesting is triggered by the stock price hitting specific absolute dollar targets during the performance window, not by a financial metric or rTSR ranking.

**How it works:**
- Four price hurdles, each unlocking a tranche of PSUs
- A tranche vests if the stock holds the target price for a minimum period (e.g. 2 consecutive months) at any point within the 5-year window
- Probability of achievement is determined by Monte Carlo on the stock price path
- Accounting classification: market condition under IFRS/US GAAP — expense is recognized regardless of whether the hurdle is ever achieved

**How it differs from the current model:**
The current GBM simulation only looks at terminal stock price (or annual steps for graded vesting). Price-hurdle PSUs require **path-dependent simulation** — you need to check whether the stock touched the target price at any point along the path, not just at the end. This requires step-by-step simulation at a finer time resolution (monthly or weekly steps).

**Why it is a future build:**
Path-dependent simulation is significantly more computationally intensive and requires restructuring how the GBM runs (from a terminal draw to a full monthly path). This is the right design for special/transformational grants and should be scoped as a separate phase once Phase 2 priorities are stable.

---

## Summary & Estimated Timeline

| Priority | Feature | Backend | Frontend | Build | Test |
|---|---|---|---|---|---|
| 1 + 5 | Performance stock options + multi-year average | High — new Monte Carlo function, new API fields | High — 3 sub-panels, per-year curve tabs | 3–4 days | 1–2 days |
| 2 | Per-metric curves (STIP + PSU) | Low — 15-line change per engine | Medium — repeatable curve panels in both designers | 1.5 days | 0.5 days |
| 3 | Forward-looking assumptions (vol + CAGR overrides) | Low — optional override dicts, ~20 lines | Medium — override section in sim params, BS reads it | 1 day | 0.5 days |
| 4 | Per-vehicle result breakdown table | None | Low — frontend calc on existing data | 0.5 days | 0.25 days |
| 6 | Goal-setting probability output + lookback selector | Low — percentile read on existing simulation | Medium — new results section + lookback dropdown | 1 day | 0.5 days |
| **Total** | | | | **7–8 days build** | **3–4 days test** |

**Recommended build order:** 4 → 3 → 2 → 6 → 1+5

**Future build (not Phase 2):** PSU with stock price hurdles (path-dependent simulation), backtesting of historical financial metric data.

---

## Design Principles (Unchanged from Phase 1)

- All new inputs default to backwards-compatible values — no existing simulation is broken
- New vehicles and overrides are opt-in — if weights are 0 and no overrides are set, Phase 1 behaviour is unchanged
- The platform remains general-purpose — metric names, curve shapes, growth rates, and measurement types are all user-configurable; nothing is hardcoded to a specific client design
- Brand colours: Navy `#0A192F`, Orange `#FF6B00`, Teal `#0E7490`, Purple `#7C3AED` (performance options)

---

*END OF PHASE 2 SPECIFICATION*
