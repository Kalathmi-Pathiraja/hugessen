"""
Compensation benchmarking computation engine — weighted percentiles, WLS
log-linear regression, and peer weight suggestion.

Self-contained by design: must not import from ltip_engine.py or stip_engine.py,
and must not be imported by them. See Compensation_Benchmarking_Design_Spec.md
Section 10.
"""
import math
from typing import Dict, List, Optional

import numpy as np

from models.benchmarking import (
    AgedPeerDetail, BenchmarkData, CalculationResponse, PeerRecord, PeerSizeRecord,
    PercentileResult, PeerWeightedResult, PriorYearOverride, RegressionResult,
    YoYResponse, YoYYearStats,
)

MIN_PEERS_FOR_REGRESSION = 8


def calculate_weighted_percentiles(values: List[float], weights: List[float]) -> Dict:
    """Weighted P25/P50/P75 via linear interpolation of the weighted CDF.

    Position of sorted point i is defined as (cumulative weight strictly
    before i) / (total weight - weight of the highest-valued point). This
    specific normalization — not a plain cumsum/total ratio — is what makes
    the result collapse exactly to numpy.percentile(..., interpolation=
    'linear') when all weights are equal; see backend/tests/test_benchmarking_engine.py.
    """
    if not values:
        raise ValueError("calculate_weighted_percentiles requires at least one value")

    pairs = sorted(zip(values, weights), key=lambda t: t[0])
    sorted_values = [v for v, _ in pairs]
    sorted_weights = [w for _, w in pairs]
    n = len(sorted_values)

    if n == 1:
        v = sorted_values[0]
        return {"p25": v, "p50": v, "p75": v, "sorted_values": sorted_values, "sorted_weights": sorted_weights}

    denom = sum(sorted_weights) - sorted_weights[-1]
    positions = []
    running = 0.0
    for w in sorted_weights:
        positions.append(running / denom if denom > 0 else 0.0)
        running += w

    def interp(q: float) -> float:
        if q <= positions[0]:
            return sorted_values[0]
        if q >= positions[-1]:
            return sorted_values[-1]
        for i in range(n - 1):
            if positions[i] <= q <= positions[i + 1]:
                if positions[i + 1] == positions[i]:
                    return sorted_values[i]
                frac = (q - positions[i]) / (positions[i + 1] - positions[i])
                return sorted_values[i] + frac * (sorted_values[i + 1] - sorted_values[i])
        return sorted_values[-1]

    return {
        "p25": interp(0.25), "p50": interp(0.50), "p75": interp(0.75),
        "sorted_values": sorted_values, "sorted_weights": sorted_weights,
    }


def weighted_percentile_rank(value: float, values: List[float], weights: List[float]) -> float:
    """Where `value` falls in the weighted distribution, as a 0-100 percentile."""
    if not values:
        return 0.0
    total = sum(weights)
    if total <= 0:
        return 0.0
    below = sum(w for v, w in zip(values, weights) if v <= value)
    return round(100 * below / total, 1)


def excel_percentrank(values: List[Optional[float]], x: Optional[float]) -> Optional[float]:
    """Excel PERCENTRANK.INC over the peer array (client excluded by
    construction — the ranges on the role tabs never include the client row),
    as a 0-100 percentile.

    Interpolates linearly between the two bracketing peers: rank of sorted
    point i is i/(n-1), TRUNCATED (not rounded) to 3 decimal digits — Excel
    truncates PERCENTRANK to its significance argument (default 3). The source
    model clamps out-of-range values to "max"/"min" (CEO!I40/W40); here that
    maps to 100/0. Matches CEO!W42 = PERCENTRANK(W47:W66, W41) = 0.292 for the
    headline TDC positioning.
    """
    if x is None:
        return None
    vals = sorted(v for v in values if v is not None)
    n = len(vals)
    if n == 0:
        return None
    if n == 1 or x <= vals[0]:
        return 0.0
    if x >= vals[-1]:
        return 100.0

    def trunc3(frac: float) -> float:
        return math.floor(frac * 1000) / 10.0   # 0.29268 -> 29.2

    for i in range(n - 1):
        if vals[i] == x:
            return trunc3(i / (n - 1))
        if vals[i] < x < vals[i + 1]:
            frac_between = (x - vals[i]) / (vals[i + 1] - vals[i])
            return trunc3((i + frac_between) / (n - 1))
    return 100.0


def run_regression(pay_values: List[float], size_values: List[float], weights: List[float],
                    client_size: Optional[float]) -> Dict:
    """Weighted least squares regression of log(pay) on log(size)."""
    pairs = [(p, s, w) for p, s, w in zip(pay_values, size_values, weights)
             if p is not None and s is not None and p > 0 and s > 0]

    if len(pairs) < MIN_PEERS_FOR_REGRESSION:
        return {
            "slope": None, "intercept": None, "r_squared": None,
            "client_predicted_pay": None, "regression_valid": False,
            "regression_warning": (
                f"Only {len(pairs)} peers have valid size data for this metric — "
                f"minimum {MIN_PEERS_FOR_REGRESSION} required. Showing unweighted percentiles."
            ),
        }

    pay_arr = np.array([p for p, _, _ in pairs])
    size_arr = np.array([s for _, s, _ in pairs])
    w_arr = np.array([w for _, _, w in pairs])

    log_pay = np.log(pay_arr)
    log_size = np.log(size_arr)
    X = np.column_stack([np.ones(len(pairs)), log_size])

    XtW = X.T * w_arr
    beta = np.linalg.solve(XtW @ X, XtW @ log_pay)
    intercept, slope = float(beta[0]), float(beta[1])

    fitted = np.exp(X @ beta)
    ss_res = np.sum(w_arr * (pay_arr - fitted) ** 2)
    weighted_mean = np.sum(w_arr * pay_arr) / np.sum(w_arr)
    ss_tot = np.sum(w_arr * (pay_arr - weighted_mean) ** 2)
    r_squared = float(1 - ss_res / ss_tot) if ss_tot > 0 else None

    client_predicted_pay = None
    if client_size and client_size > 0:
        client_predicted_pay = float(np.exp(intercept + slope * math.log(client_size)))

    return {
        "slope": slope, "intercept": intercept, "r_squared": r_squared,
        "client_predicted_pay": client_predicted_pay,
        "regression_valid": True, "regression_warning": None,
    }


def suggest_weights(peer_sizes: List[Optional[float]], client_size: Optional[float]) -> List[float]:
    """Decay weight by log-distance from client size. Weight 1.0 = exact size match,
    ~0.22 at 10x larger/smaller, clamped to [0.1, 1.0] — no peer gets zero weight."""
    if not client_size or client_size <= 0:
        return [0.5] * len(peer_sizes)
    weights = []
    for s in peer_sizes:
        if s is None or s <= 0:
            weights.append(0.1)
            continue
        distance = abs(math.log(s) - math.log(client_size))
        w = math.exp(-1.5 * distance)
        weights.append(max(0.1, min(1.0, w)))
    return weights


# ---------------------------------------------------------------------------
# Field accessors
# ---------------------------------------------------------------------------

_PAY_FIELD = {
    "base": "base_salary",
    "tcc": "target_tcc",
    "tdc": "target_tdc",
    "total_comp": "target_total_comp",
}
_SIZE_FIELD = {
    "market_cap": "market_cap",
    "tev": "tev",
    "revenue": "revenue",
    "total_assets": "total_assets",
}


def _pay_value(peer: PeerRecord, pay_metric: str) -> Optional[float]:
    return getattr(peer, _PAY_FIELD[pay_metric], None)


def _size_value(peer_size: PeerSizeRecord, size_metric: str) -> Optional[float]:
    return getattr(peer_size, _SIZE_FIELD[size_metric], None)


def _role_year_peers(data: BenchmarkData, role: str, year: int) -> List[PeerRecord]:
    return [p for p in data.peers if role in p.role_tags and p.year == year and not p.is_client]


def _client_peer(data: BenchmarkData, role: str, year: int) -> Optional[PeerRecord]:
    for p in data.peers:
        if p.is_client and role in p.role_tags and p.year == year:
            return p
    return None


def compute_suggested_weights(data: BenchmarkData, role: str, year: int, size_metric: str) -> Dict[str, float]:
    peers = _role_year_peers(data, role, year)
    size_by_ticker = {ps.ticker: ps for ps in data.peer_sizes}
    client_size_rec = size_by_ticker.get(data.client_ticker)
    client_size = _size_value(client_size_rec, size_metric) if client_size_rec else None

    sizes = [_size_value(size_by_ticker[p.ticker], size_metric) if p.ticker in size_by_ticker else None for p in peers]
    suggested = suggest_weights(sizes, client_size)
    return {p.ticker: w for p, w in zip(peers, suggested)}


def compute_calculation(data: BenchmarkData, role: str, year: int, pay_metric: str,
                         size_metric: str, peer_weight_overrides: Dict[str, float]) -> CalculationResponse:
    peers = _role_year_peers(data, role, year)
    size_by_ticker = {ps.ticker: ps for ps in data.peer_sizes}
    client_size_rec = size_by_ticker.get(data.client_ticker)
    client_size = _size_value(client_size_rec, size_metric) if client_size_rec else None

    in_scope = []
    for p in peers:
        pay = _pay_value(p, pay_metric)
        if pay is None:
            continue
        size_rec = size_by_ticker.get(p.ticker)
        size = _size_value(size_rec, size_metric) if size_rec else None
        in_scope.append((p, pay, size))

    tickers = [p.ticker for p, _, _ in in_scope]
    pay_values = [pay for _, pay, _ in in_scope]
    size_values = [size for _, _, size in in_scope]
    suggested = suggest_weights(size_values, client_size)
    applied = [peer_weight_overrides.get(t, s) for t, s in zip(tickers, suggested)]

    unweighted_pct = calculate_weighted_percentiles(pay_values, [1.0] * len(pay_values))
    weighted_pct = calculate_weighted_percentiles(pay_values, applied)
    unweighted_avg = sum(pay_values) / len(pay_values)
    weighted_avg = (sum(p * w for p, w in zip(pay_values, applied)) / sum(applied)) if sum(applied) > 0 else unweighted_avg

    reg = run_regression(pay_values, size_values, applied, client_size)

    predicted_by_idx: List[Optional[float]] = [None] * len(in_scope)
    residual_by_idx: List[Optional[float]] = [None] * len(in_scope)
    if reg["regression_valid"]:
        for i, size in enumerate(size_values):
            if size is not None and size > 0:
                pred = math.exp(reg["intercept"] + reg["slope"] * math.log(size))
                predicted_by_idx[i] = pred
                residual_by_idx[i] = pay_values[i] - pred

    peer_results = [
        PeerWeightedResult(
            ticker=p.ticker, company_name=p.company_name, pay_value=pay,
            suggested_weight=round(sug, 3), applied_weight=round(app, 3),
            size_value=size, predicted_pay=predicted_by_idx[i], residual=residual_by_idx[i],
        )
        for i, ((p, pay, size), sug, app) in enumerate(zip(in_scope, suggested, applied))
    ]

    client = _client_peer(data, role, year)
    client_pay = _pay_value(client, pay_metric) if client else None
    client_pct_unweighted = excel_percentrank(pay_values, client_pay)
    client_pct_weighted = weighted_percentile_rank(client_pay, pay_values, applied) if client_pay is not None else None

    return CalculationResponse(
        role=role, year=year, pay_metric=pay_metric, size_metric=size_metric,
        unweighted=PercentileResult(p25=unweighted_pct["p25"], p50=unweighted_pct["p50"], p75=unweighted_pct["p75"], avg=unweighted_avg),
        weighted=PercentileResult(p25=weighted_pct["p25"], p50=weighted_pct["p50"], p75=weighted_pct["p75"], avg=weighted_avg),
        client_pay=client_pay,
        client_percentile_unweighted=client_pct_unweighted,
        client_percentile_weighted=client_pct_weighted,
        peers=peer_results,
        regression=RegressionResult(
            slope=reg["slope"], intercept=reg["intercept"], r_squared=reg["r_squared"],
            client_predicted_pay=reg["client_predicted_pay"], regression_valid=reg["regression_valid"],
            regression_warning=reg["regression_warning"],
        ),
    )


# ---------------------------------------------------------------------------
# Data aging (YoY trend) — mirrors the "DATA AGING" block on each role tab of
# the source model. Verified against Hudbay 2026 EC Benchmarking v7 cached
# formula outputs (CEO tab rows 47-71).
# ---------------------------------------------------------------------------

def age_peer(peer: PeerRecord, aging_factor: float) -> AgedPeerDetail:
    """One peer's aged projection.

    Excel formula per peer (CEO!I47 and equivalents):
        IF(next_year_salary disclosed, use it as-is,
           current base salary * (1 + aging factor))
    Target STI% / LTI% are carried forward from the current year unchanged —
    they are never re-forecast. Where the current year's Target % itself is
    undisclosed, the 3-year average % stands in — the same fallback the role
    tabs' N/U columns apply (CEO!N9/U9). Peers still missing salary or either
    % after the fallback produce a null aged TDC and drop out of the
    percentile math, matching the Excel's IFERROR(...,"-") dropout.
    """
    sti_pct = peer.stip_target_pct if peer.stip_target_pct is not None else peer.stip_3yr_avg_pct
    lti_pct = peer.ltip_target_pct if peer.ltip_target_pct is not None else peer.ltip_3yr_avg_pct

    detail = AgedPeerDetail(
        ticker=peer.ticker,
        company_name=peer.company_name,
        current_salary=peer.base_salary,
        next_year_salary_disclosed=peer.base_salary_next_year,
        sti_pct=sti_pct,
        lti_pct=lti_pct,
    )

    if peer.base_salary_next_year is not None:
        detail.used_disclosed = True
        detail.aged_salary = peer.base_salary_next_year
    elif peer.base_salary is not None:
        detail.aged_salary = peer.base_salary * (1 + aging_factor)

    if detail.aged_salary is not None and sti_pct is not None:
        detail.aged_stip = detail.aged_salary * sti_pct
        detail.aged_tcc = detail.aged_salary + detail.aged_stip
    if detail.aged_salary is not None and lti_pct is not None:
        detail.aged_ltip = detail.aged_salary * lti_pct
    if detail.aged_tcc is not None and detail.aged_ltip is not None:
        detail.aged_tdc = detail.aged_tcc + detail.aged_ltip

    return detail


def _plain_percentiles(values: List[float]) -> Dict[str, Optional[float]]:
    """Unweighted P25/P50/P75/avg with numpy's linear interpolation — identical
    to Excel PERCENTILE(), which is what the YoY blocks use (no peer weights)."""
    if not values:
        return {"p25": None, "p50": None, "p75": None, "avg": None}
    arr = np.array(values, dtype=float)
    p25, p50, p75 = np.percentile(arr, [25, 50, 75])
    return {"p25": float(p25), "p50": float(p50), "p75": float(p75), "avg": float(arr.mean())}


def compute_yoy(data: BenchmarkData, role: str, aging_factor: Optional[float] = None,
                prior_year_override: Optional["PriorYearOverride"] = None,
                excluded_tickers: Optional[List[str]] = None) -> YoYResponse:
    """Target-TDC trend per role: prior actual year, current actual year, and
    the aged projection year, matching the source model's "<Role> - YoY" tabs.

    Client-row exception: the client's own figures are NEVER aged — the
    projection column carries the client's current-year Target TDC through
    unchanged (Hudbay's TDC is identical in the 2025 and 2026E columns of the
    source model).

    `excluded_tickers`: peers the analyst has manually dropped from the
    2026E aged percentile calc — mirrors source-model workbooks where a peer's
    aged-column cell was hand-overwritten with "-" (see spec §"Known manual
    overrides"). Excluded peers still appear in `aged_peers` (flagged) so the
    UI can show them struck through / unchecked, they just don't feed the
    P25/P50/P75/percentile math.
    """
    excluded = set(excluded_tickers or [])
    factor = aging_factor if aging_factor is not None else data.aging_factor
    current_year = max(data.available_years) if data.available_years else data.default_year

    years: List[YoYYearStats] = []

    # Prior year: preferentially the "Import <year> Data" tab (the prior
    # engagement's final Target TDC). The prior year's Raw Data rows are
    # actual-only disclosures whose target fields degenerate to base salary,
    # so they are NOT a usable source for a Target TDC column. Any hardcoded
    # override supplied by the user (mirroring the pasted values on the source
    # model's YoY tabs) takes precedence field-by-field.
    prior_year = current_year - 1
    prior_recs = [r for r in data.prior_year_records if r.year == prior_year and r.role == role]
    ov = prior_year_override
    has_override = ov is not None and any(
        v is not None for v in (ov.p25, ov.p50, ov.p75, ov.avg, ov.client))
    if prior_recs or has_override:
        tdc = [r.target_tdc for r in prior_recs if r.target_tdc is not None and not r.is_client]
        stats = _plain_percentiles(tdc)
        client_rec = next((r for r in prior_recs if r.is_client), None)
        client_pay = client_rec.target_tdc if client_rec else None
        if has_override:
            stats["p25"] = ov.p25 if ov.p25 is not None else stats["p25"]
            stats["p50"] = ov.p50 if ov.p50 is not None else stats["p50"]
            stats["p75"] = ov.p75 if ov.p75 is not None else stats["p75"]
            stats["avg"] = ov.avg if ov.avg is not None else stats["avg"]
            client_pay = ov.client if ov.client is not None else client_pay
        years.append(YoYYearStats(
            year=prior_year, label=str(prior_year), aged=False,
            **stats,
            client=client_pay,
            client_percentile=excel_percentrank(tdc, client_pay) if tdc else None,
            n_peers=len(tdc),
        ))

    # Current year: straight from the Raw Data target TDC.
    peers = _role_year_peers(data, role, current_year)
    tdc = [p.target_tdc for p in peers if p.target_tdc is not None]
    stats = _plain_percentiles(tdc)
    client = _client_peer(data, role, current_year)
    client_pay = client.target_tdc if client else None
    years.append(YoYYearStats(
        year=current_year, label=str(current_year), aged=False,
        **stats,
        client=client_pay,
        client_percentile=excel_percentrank(tdc, client_pay),
        n_peers=len(tdc),
    ))

    # Aged projection: built from current-year peers only.
    aged_details = [age_peer(p, factor) for p in peers]
    for d in aged_details:
        d.excluded = d.ticker in excluded
    aged_tdc = [d.aged_tdc for d in aged_details if d.aged_tdc is not None and not d.excluded]
    stats = _plain_percentiles(aged_tdc)
    client_pay = client.target_tdc if client else None   # pass-through, never aged
    years.append(YoYYearStats(
        year=current_year + 1, label=f"{current_year + 1}E", aged=True,
        **stats,
        client=client_pay,
        client_percentile=excel_percentrank(aged_tdc, client_pay),
        n_peers=len(aged_tdc),
    ))

    return YoYResponse(role=role, metric="tdc", aging_factor=factor, years=years, aged_peers=aged_details)
