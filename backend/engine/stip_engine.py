"""
STIP Calculation Engine
5-step pipeline — each step is independently callable for debugging.
"""
import numpy as np
from typing import List, Dict, Any


# ---------------------------------------------------------------------------
# Step 1 – Metric achievement
# ---------------------------------------------------------------------------
def calculate_metric_achievement(actual: float, budget: float) -> float:
    """Returns achievement as a decimal (e.g. 0.97 = 97% of budget)."""
    if budget == 0:
        raise ValueError("Budget/target value cannot be zero.")
    return actual / budget


# ---------------------------------------------------------------------------
# Step 2 – Single metric multiplier (piecewise linear curve)
# ---------------------------------------------------------------------------
def calculate_multiplier(achievement_pct: float, curve: Dict[str, Any]) -> float:
    """
    Maps achievement % to a payout multiplier using the piecewise curve.
    Handles threshold_enabled=False by treating threshold as (0%, 0%).
    """
    if not curve.get("threshold_enabled", True):
        t_perf = 0.0
        t_pay = 0.0
    else:
        t_perf = curve["threshold_perf"]
        t_pay = curve["threshold_payout"]

    p = achievement_pct
    tgt_perf = curve["target_perf"]
    tgt_pay = curve["target_payout"]
    max_perf = curve["max_perf"]
    max_pay = curve["max_payout"]

    if p < t_perf:
        return 0.0
    elif p <= tgt_perf:
        denom = tgt_perf - t_perf
        if denom == 0:
            return t_pay
        slope = (p - t_perf) / denom
        return t_pay + slope * (tgt_pay - t_pay)
    elif p <= max_perf:
        denom = max_perf - tgt_perf
        if denom == 0:
            return tgt_pay
        slope = (p - tgt_perf) / denom
        return tgt_pay + slope * (max_pay - tgt_pay)
    else:
        return max_pay


# ---------------------------------------------------------------------------
# Step 3 – Weighted aggregate multiplier
# ---------------------------------------------------------------------------
def calculate_weighted_multiplier(multipliers: List[float], weights: List[float]) -> float:
    """Dot product of individual multipliers and their weights."""
    return float(np.dot(multipliers, weights))


# ---------------------------------------------------------------------------
# Step 4 – Dollar payout
# ---------------------------------------------------------------------------
def calculate_dollar_payout(multiplier: float, target_opportunity: float) -> float:
    return multiplier * target_opportunity


# ---------------------------------------------------------------------------
# Step 5 – % of target
# ---------------------------------------------------------------------------
def calculate_payout_pct_of_target(payout: float, target_opportunity: float) -> float:
    if target_opportunity == 0:
        raise ValueError("Target opportunity cannot be zero.")
    return payout / target_opportunity


# ---------------------------------------------------------------------------
# Correlation matrix validation
# ---------------------------------------------------------------------------
def validate_correlation_matrix(corr_matrix: List[List[float]]) -> Dict[str, Any]:
    R = np.array(corr_matrix, dtype=float)
    eigenvalues = np.linalg.eigvalsh(R)
    is_valid = bool(np.all(eigenvalues >= -1e-8))
    return {"valid": is_valid, "eigenvalues": eigenvalues.tolist()}


# ---------------------------------------------------------------------------
# Monte Carlo simulation
# ---------------------------------------------------------------------------
def run_stip_simulation(payload: Dict[str, Any]) -> Dict[str, Any]:
    n = int(payload["n_simulations"])
    metrics = payload["scorecard_metrics"]
    R = np.array(payload["correlation_matrix"], dtype=float)
    global_curve = payload["curve_design"]
    n_m = len(metrics)
    global_dist = payload.get("distribution", "lognormal")
    rng = np.random.default_rng()

    # ── Pass 2: Cholesky split ────────────────────────────────────────────────
    # Milestone and safety-gate metrics don't use correlated market draws.
    # We decompose only the sub-matrix of continuous metrics so their Z draws
    # remain correlated (e.g. EBITDA and ROIC still move together) without
    # forcing meaningless correlations onto discrete milestone outcomes.
    CORR_BEHAVIORS = {"continuous", "safety_capped", "individual"}
    corr_idxs = [i for i, m in enumerate(metrics)
                 if m.get("metric_behavior", "continuous") in CORR_BEHAVIORS]

    Z_for = {}   # maps original metric index → correlated Z array of shape (n,)
    if corr_idxs:
        R_sub = R[np.ix_(corr_idxs, corr_idxs)]
        L_sub = np.linalg.cholesky(R_sub)
        Z_ind_sub = rng.standard_normal((len(corr_idxs), n))
        Z_corr_sub = L_sub @ Z_ind_sub
        for sub_pos, orig_idx in enumerate(corr_idxs):
            Z_for[orig_idx] = Z_corr_sub[sub_pos]

    # ── Simulate achievement % ────────────────────────────────────────────────
    achievement = np.zeros((n_m, n))
    # Track per-metric inferred params for results output
    metric_inferred: List[Dict] = [{}] * n_m

    for i, metric in enumerate(metrics):
        behavior = metric.get("metric_behavior", "continuous")

        # Safety-gate: no achievement distribution — fires as post-calc modifier
        if behavior == "safety_gate":
            achievement[i] = np.ones(n)
            continue

        # Milestone: discrete probability-weighted draw — independent of market
        if behavior == "milestone":
            outcomes = metric.get("milestone_outcomes") or []
            if not outcomes:
                achievement[i] = np.ones(n)
                continue
            probs = np.array([float(o["probability"]) for o in outcomes])
            probs /= probs.sum()
            achs  = np.array([float(o["achievement"])  for o in outcomes])
            choices = rng.choice(len(outcomes), size=n, p=probs)
            achievement[i] = achs[choices]
            continue

        # ── Target Difficulty mode: EAGR from historical actuals ─────────────
        sim_mode = metric.get("simulation_mode", "relative")
        historical = metric.get("historical_actuals") or []
        if sim_mode == "target_difficulty" and len(historical) >= 2:
            actuals = np.array([float(v) for v in historical])
            yoy = np.diff(actuals) / np.abs(actuals[:-1])
            g_inf   = float(np.mean(yoy))
            sig_inf = float(np.std(yoy, ddof=1))
            X0      = float(actuals[-1])
            budget  = float(metric.get("budget_target", X0))
            T       = 1.0   # STIP = 1-year horizon
            z = Z_for.get(i, rng.standard_normal(n))
            # Use manual σ override if provided, else use inferred σ from historicals
            sigma_override = metric.get("eagr_sigma_override")
            sig = float(sigma_override) if sigma_override is not None else sig_inf
            g_override = metric.get("eagr_g_override")
            g = float(g_override) if g_override is not None else g_inf
            # EAGR: X_T = X0 + X0*g + sig*X0*sqrt(T)*Z
            X_sim = X0 + X0 * g + sig * X0 * np.sqrt(T) * z
            X_sim = np.maximum(X_sim, 0.0)
            # Normalise to achievement ratio vs budget target
            # For lower-is-better metrics: budget/X_sim (coming in under budget is good)
            direction = metric.get("metric_direction", "higher")
            if direction == "lower":
                achievement[i] = budget / np.maximum(X_sim, 1e-9) if budget != 0 else np.ones(n)
            else:
                achievement[i] = X_sim / budget if budget != 0 else np.ones(n)
            metric_inferred[i] = {
                "simulation_mode": "target_difficulty",
                "inferred_g": round(g_inf * 100, 2),
                "inferred_sigma": round(sig_inf * 100, 2),   # always report inferred for display
                "effective_sigma": round(sig * 100, 2),       # what was actually used
                "effective_g": round(g * 100, 2),             # what was actually used for drift
                "starting_value": X0,
            }
            continue

        # ── Relative mode (default) ───────────────────────────────────────────
        sigma = float(metric["volatility_sigma"])
        z = Z_for.get(i, rng.standard_normal(n))
        mu = 1.0
        dist = metric.get("distribution") or global_dist

        if behavior == "individual":
            curve_for_floor = metric.get("curve", global_curve)
            floor = (curve_for_floor.get("threshold_perf", 0.50)
                     if curve_for_floor.get("threshold_enabled", False) else 0.50)
            achievement[i] = np.maximum(mu + sigma * z, floor)
        elif dist == "lognormal":
            mu_ln    = np.log(mu**2 / np.sqrt(sigma**2 + mu**2))
            sigma_ln = np.sqrt(np.log(1 + (sigma / mu) ** 2))
            achievement[i] = np.exp(mu_ln + sigma_ln * z)
        else:  # normal
            achievement[i] = np.maximum(mu + sigma * z, 0.0)
        metric_inferred[i] = {"simulation_mode": "relative"}

    # ── Apply metric direction flip (lower-is-better) ─────────────────────────
    # For "lower" metrics (costs, incidents, debt): achievement = budget / actual.
    # In relative mode the draws are centred at 1.0 (≈ actual/budget), so flip
    # to 1/achievement.  In EAGR mode the flip was already applied above via
    # budget/X_sim, so this pass only touches relative draws.
    for i, metric in enumerate(metrics):
        if metric.get("metric_direction", "higher") == "lower":
            behavior = metric.get("metric_behavior", "continuous")
            if behavior in {"safety_gate", "milestone"}:
                continue
            sim_mode = metric_inferred[i].get("simulation_mode", "relative")
            if sim_mode == "relative":
                # Flip: underperforming the budget (draws < 1) becomes outperforming
                achievement[i] = np.minimum(1.0 / np.maximum(achievement[i], 0.01), 4.0)

    # ── Apply multiplier curve (per-metric, falls back to global) ────────────
    multipliers = np.zeros((n_m, n))
    for i, metric in enumerate(metrics):
        if metric.get("metric_behavior") == "safety_gate":
            continue
        c = metric.get("curve") or global_curve
        for j in range(n):
            multipliers[i, j] = calculate_multiplier(float(achievement[i, j]), c)

    # safety_capped: hard ceiling at target payout — no upside beyond 100% performance
    for i, metric in enumerate(metrics):
        if metric.get("metric_behavior") == "safety_capped":
            c = metric.get("curve") or global_curve
            multipliers[i] = np.minimum(multipliers[i], c["target_payout"])

    # ── Weighted aggregate ────────────────────────────────────────────────────
    weights = np.array([float(m["weight"]) for m in metrics])
    overall_multipliers = weights @ multipliers  # shape (n,)

    # ── Safety gate ───────────────────────────────────────────────────────────
    # Fires last — one gate event wipes the entire trial to zero, regardless of
    # how well every other metric performed.
    for metric in metrics:
        if metric.get("metric_behavior") == "safety_gate":
            gate_prob = float(metric.get("gate_probability", 0.0))
            if gate_prob > 0:
                gate_fires = rng.random(n) < gate_prob
                overall_multipliers = np.where(gate_fires, 0.0, overall_multipliers)

    # ── Board discretion modifier (Pass 2) ───────────────────────────────────
    # The Compensation Committee can adjust the formula result up or down by up
    # to disc_pct in either direction (uniform draw).  Applied multiplicatively:
    #   final = formula × (1 + U(-disc, +disc))
    # Floored at zero so discretion can never manufacture a negative payout.
    disc_pct = float(payload.get("board_discretion_pct", 0.0))
    if disc_pct > 0:
        disc_draws = rng.uniform(-disc_pct, disc_pct, n)
        overall_multipliers = np.maximum(overall_multipliers * (1.0 + disc_draws), 0.0)

    # ── Percentiles ──────────────────────────────────────────────────────────
    payout_pct        = overall_multipliers * 100.0
    payout_pct_sorted = np.sort(payout_pct)
    bear, base, bull  = np.percentile(payout_pct_sorted, [10, 50, 90])
    percentile_distribution = np.percentile(payout_pct_sorted, np.arange(1, 101)).tolist()

    # ── Per-metric stats ──────────────────────────────────────────────────────
    metric_stats = []
    for i, m in enumerate(metrics):
        behavior = m.get("metric_behavior", "continuous")
        budget   = float(m["budget_target"])
        c        = m.get("curve") or global_curve
        max_pay  = c["max_payout"]

        if behavior == "safety_gate":
            gate_prob = float(m.get("gate_probability", 0.0))
            metric_stats.append({
                "name": m["name"],
                "weight_pct": 0.0,
                "prob_zero": round(gate_prob * 100, 1),
                "prob_above_threshold": 0.0,
                "prob_target": 0.0, "prob_max": 0.0, "median_mult": 0.0,
                "budget_target": budget,
                "bear_raw": 0.0, "base_raw": 0.0, "bull_raw": 0.0,
                "bear_achievement_pct": 0.0, "base_achievement_pct": 0.0, "bull_achievement_pct": 0.0,
                "metric_behavior": behavior,
                "metric_direction": m.get("metric_direction", "higher"),
                "threshold_perf": 0.0, "threshold_enabled": False,
                "gate_probability_pct": round(gate_prob * 100, 1),
                "simulation_mode": "relative",
                "inferred_g": None, "inferred_sigma": None, "starting_value": None,
            })
            continue

        p10_ach, p50_ach, p90_ach = np.percentile(achievement[i], [10, 50, 90])
        inferred = metric_inferred[i]

        # prob_above_threshold: fraction of sims where any payout occurs (mult > 0)
        t_perf = c["threshold_perf"] if c.get("threshold_enabled", True) else 0.0
        metric_stats.append({
            "name": m["name"],
            "weight_pct":   round(float(m["weight"]) * 100, 1),
            "prob_zero":    round(float(np.mean(multipliers[i] == 0.0)) * 100, 1),
            "prob_above_threshold": round(float(np.mean(achievement[i] >= t_perf)) * 100, 1),
            "prob_target":  round(float(np.mean(multipliers[i] >= 1.0)) * 100, 1),
            "prob_max":     round(float(np.mean(multipliers[i] >= max_pay)) * 100, 1),
            "median_mult":  round(float(np.percentile(multipliers[i], 50)), 3),
            "budget_target": budget,
            "bear_raw":  round(float(p10_ach) * budget, 4),
            "base_raw":  round(float(p50_ach) * budget, 4),
            "bull_raw":  round(float(p90_ach) * budget, 4),
            "bear_achievement_pct": round(float(p10_ach) * 100, 1),
            "base_achievement_pct": round(float(p50_ach) * 100, 1),
            "bull_achievement_pct": round(float(p90_ach) * 100, 1),
            "metric_behavior": behavior,
            "metric_direction": m.get("metric_direction", "higher"),
            "threshold_perf": round(t_perf * 100, 1),
            "threshold_enabled": bool(c.get("threshold_enabled", True)),
            "gate_probability_pct": 0.0,
            "simulation_mode": inferred.get("simulation_mode", "relative"),
            "inferred_g": inferred.get("inferred_g"),
            "inferred_sigma": inferred.get("inferred_sigma"),
            "starting_value": inferred.get("starting_value"),
        })

    target_opp = float(payload["base_salary"]) * float(payload["target_stip_pct"])

    return {
        "bear_pct_of_target": round(bear, 1),
        "base_pct_of_target": round(base, 1),
        "bull_pct_of_target": round(bull, 1),
        "bear_dollar": round(bear / 100 * target_opp, 0),
        "base_dollar": round(base / 100 * target_opp, 0),
        "bull_dollar": round(bull / 100 * target_opp, 0),
        "target_opportunity": target_opp,
        "metric_stats": metric_stats,
        "percentile_distribution": percentile_distribution,
    }
