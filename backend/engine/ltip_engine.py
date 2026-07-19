"""
LTIP Calculation Engine
GBM simulation, Black-Scholes (Merton), PSU multiplier (rTSR / internal / both).
Cliff vesting at year T (default 3).
"""
import io
import math
import numpy as np
import pandas as pd
from scipy.stats import norm
from typing import Dict, Any, List


# ---------------------------------------------------------------------------
# Black-Scholes with Merton continuous dividend yield adjustment
# ---------------------------------------------------------------------------
def black_scholes_call(S: float, K: float, T: float,
                        r: float, q: float, sigma: float) -> float:
    """
    S: current share price
    K: strike price
    T: option term in years
    r: annual risk-free rate (decimal)
    q: continuous dividend yield (decimal)
    sigma: annualised volatility
    Returns: absolute dollar value per option
    """
    if sigma <= 0 or T <= 0:
        return max(S - K, 0.0)
    d1 = (math.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    call = S * math.exp(-q * T) * norm.cdf(d1) - K * math.exp(-r * T) * norm.cdf(d2)
    return call


def option_fair_value_pct(S: float, K: float, T: float,
                           r: float, q: float, sigma: float) -> float:
    """Returns fair value as fraction of share price (e.g. 0.312 = 31.2%)."""
    return black_scholes_call(S, K, T, r, q, sigma) / S


# ---------------------------------------------------------------------------
# Grant unit calculation
# ---------------------------------------------------------------------------
def calculate_grant_units(grant_value: float, share_price: float,
                           rsu_wt: float, psu_wt: float, opt_wt: float,
                           option_fv_pct: float) -> Dict[str, float]:
    """
    All weights are decimals summing to 1.0.
    option_fv_pct: decimal output of option_fair_value_pct() — dollar value per option = share_price × option_fv_pct
    """
    rsu_units = (grant_value * rsu_wt) / share_price if share_price > 0 else 0
    psu_units = (grant_value * psu_wt) / share_price if share_price > 0 else 0
    opt_dollar_per_unit = share_price * option_fv_pct
    option_units = (grant_value * opt_wt) / opt_dollar_per_unit if opt_dollar_per_unit > 0 else 0
    return {
        "rsu_units": rsu_units,
        "psu_units": psu_units,
        "option_units": option_units,
    }


# ---------------------------------------------------------------------------
# PSU multiplier functions
# ---------------------------------------------------------------------------
def calculate_multiplier_gap(gap_pp: float, curve: Dict[str, Any]) -> float:
    """
    rTSR gap-denominated piecewise function.
    gap_pp: outperformance in percentage points (+ = outperform, - = underperform)
    """
    t_gap = curve["threshold_gap"]
    t_pay = curve["threshold_payout"]
    max_gap = curve["max_gap"]
    max_pay = curve["max_payout"]

    if gap_pp < t_gap:
        return 0.0
    elif gap_pp <= 0.0:
        denom = 0.0 - t_gap
        slope = (gap_pp - t_gap) / denom if denom != 0 else 1.0
        return t_pay + slope * (1.0 - t_pay)
    elif gap_pp <= max_gap:
        slope = gap_pp / max_gap if max_gap != 0 else 1.0
        return 1.0 + slope * (max_pay - 1.0)
    else:
        return max_pay


def calculate_multiplier_achievement(achievement_pct: float,
                                     curve: Dict[str, Any]) -> float:
    """STIP-style achievement-based piecewise for internal PSU metric."""
    if not curve.get("threshold_enabled", True):
        t_perf, t_pay = 0.0, 0.0
    else:
        t_perf = curve["threshold_perf"]
        t_pay = curve["threshold_payout"]

    tgt_perf = curve["target_perf"]
    tgt_pay = curve["target_payout"]
    max_perf = curve["max_perf"]
    max_pay = curve["max_payout"]
    p = achievement_pct

    if p < t_perf:
        return 0.0
    elif p <= tgt_perf:
        denom = tgt_perf - t_perf
        slope = (p - t_perf) / denom if denom != 0 else 1.0
        return t_pay + slope * (tgt_pay - t_pay)
    elif p <= max_perf:
        denom = max_perf - tgt_perf
        slope = (p - tgt_perf) / denom if denom != 0 else 1.0
        return tgt_pay + slope * (max_pay - tgt_pay)
    else:
        return max_pay


# ---------------------------------------------------------------------------
# Excel ingestion
# ---------------------------------------------------------------------------
def _find_header_row(file_bytes: bytes) -> int:
    """
    Scan the first 5 rows of the Price History sheet to find the header row.
    Detects it by looking for 'Date' (case-insensitive) in the first column,
    which is present regardless of whether the user kept the 'COMPANY' placeholder
    or replaced it with a real ticker symbol.
    Falls back to looking for 'COMPANY' for backwards compatibility.
    Returns the 0-indexed row number to pass as `header=` to pd.read_excel.
    """
    for skip in range(5):
        try:
            probe = pd.read_excel(
                io.BytesIO(file_bytes), sheet_name="Price History",
                header=skip, nrows=1
            )
            cols = [str(c).strip() for c in probe.columns]
            # Primary signal: first column is "Date" and remaining columns look
            # like tickers (short strings, not long instruction sentences)
            if cols and cols[0].lower() == "date" and len(cols) > 1 and len(cols[1]) < 40:
                return skip
            # Legacy fallback: COMPANY present anywhere
            if "COMPANY" in cols:
                return skip
        except Exception:
            pass
    return 0  # fallback — let the caller raise the descriptive error


def ingest_price_data(file_bytes: bytes) -> Dict[str, Any]:
    header_row = _find_header_row(file_bytes)
    df = pd.read_excel(
        io.BytesIO(file_bytes), sheet_name="Price History",
        header=header_row, index_col=0, parse_dates=True
    )
    # Ensure column names are strings before stripping (wrong header row detection
    # can leave columns as datetime or numeric objects)
    df.columns = [str(c).strip() for c in df.columns]
    df = df.sort_index()
    df = df.dropna(how="all")

    # Force-parse the index as datetime — parse_dates=True in read_excel can
    # silently fail for certain Excel date formats, leaving the index as object
    # dtype.  pd.to_datetime with errors='coerce' handles all common formats;
    # rows that genuinely can't be parsed become NaT and are then dropped.
    try:
        df.index = pd.to_datetime(df.index, errors="coerce")
        df = df[df.index.notna()]          # drop any rows with unparseable dates
    except Exception:
        pass                               # index already datetime — nothing to do

    # Drop weekends — Saturday=5, Sunday=6 in pandas dayofweek.
    # Carried-forward weekend prices produce zero log returns that suppress
    # annualised volatility and corrupt the √252 annualisation factor.
    if hasattr(df.index, "dayofweek"):
        df = df[df.index.dayofweek < 5]

    # Also drop consecutive duplicate-price rows that survive the weekend filter
    # (e.g. public holidays where the broker carried Friday's close forward).
    # A log return of exactly 0.0 across ALL columns simultaneously is a
    # near-certain indicator of a stale/carried price rather than genuine data.
    log_chg = np.log(df / df.shift(1))
    stale_rows = (log_chg == 0).all(axis=1)
    # Keep the first occurrence (shift produces NaN on row 0 → not flagged)
    df = df[~stale_rows]

    # Rename first column to COMPANY if the user used a real ticker name there
    company_rename_warning = None
    if "COMPANY" not in df.columns:
        original_company_col = df.columns[0]
        df = df.rename(columns={original_company_col: "COMPANY"})
        company_rename_warning = (
            f"Column '{original_company_col}' was treated as the subject company (COMPANY). "
            "To avoid this message, keep the first price column header as 'COMPANY'."
        )

    # Strip leading zeros / NaN rows per column (e.g. a recently-IPO'd company
    # has zeros before its first trading day — including those rows would corrupt
    # the log-return series with -inf values and inflate historical volatility).
    # For each column, find the first row where the price is a valid positive
    # number, then trim the whole dataframe to the latest such start date.
    first_valid_idx = df.apply(lambda col: col[col > 0].first_valid_index())
    trim_date = first_valid_idx.max()   # most restrictive start across all columns
    if trim_date is not None:
        df = df.loc[trim_date:]

    # Validate < 10% missing per column
    nan_pct = df.isna().mean()
    bad_cols = nan_pct[nan_pct > 0.10].index.tolist()
    if bad_cols:
        raise ValueError(f"Columns with >10% missing data: {bad_cols}")

    df = df.ffill().bfill()  # forward/backward fill residual gaps

    log_returns = np.log(df / df.shift(1)).dropna()

    annual_vol = (log_returns.std() * np.sqrt(252)).to_dict()
    annual_return = (log_returns.mean() * 252).to_dict()  # arithmetic approx
    corr_matrix = log_returns.corr().values.tolist()

    warnings: List[str] = []
    if company_rename_warning:
        warnings.append(company_rename_warning)
    if len(df) < 252:
        warnings.append(f"Only {len(df)} trading days found. At least 252 (1 year) recommended.")

    # Read peer names and betas from Sheet 2 (Peer Config) if it exists
    peer_names: Dict[str, str] = {}
    peer_betas: Dict[str, float] = {}
    try:
        # header=2 skips the title + instructions rows and uses row 3 ("Ticker", "Company Name"…)
        cfg = pd.read_excel(io.BytesIO(file_bytes), sheet_name="Peer Config", header=2)
        cfg.columns = [str(c).strip() for c in cfg.columns]
        ticker_col = cfg.columns[0]
        name_col   = cfg.columns[1] if len(cfg.columns) > 1 else None
        # Find Beta column — case-insensitive, anywhere in the header row
        beta_col = next((c for c in cfg.columns if "beta" in c.lower()), None)
        for _, row in cfg.iterrows():
            t = str(row[ticker_col]).strip()
            if not t or t == "nan":
                continue
            if name_col:
                n = str(row[name_col]).strip()
                if n and n != "nan":
                    peer_names[t] = n
            if beta_col:
                try:
                    b = float(row[beta_col])
                    if not np.isnan(b):
                        peer_betas[t] = b
                except (ValueError, TypeError):
                    pass  # blank or non-numeric beta — will fall back to common drift
    except Exception:
        pass  # Peer Config sheet absent or malformed

    return {
        "tickers": df.columns.tolist(),
        "annual_vol": annual_vol,
        "annual_return": annual_return,
        "corr_matrix": corr_matrix,
        "n_trading_days": len(df),
        "validation_warnings": warnings,
        "peer_names": peer_names,
        "peer_betas": peer_betas,   # ticker → beta; empty dict = no betas uploaded
    }


# ---------------------------------------------------------------------------
# PSU multiplier helper (shared by cliff and graded paths)
# company_factor and peer_factor_matrix are total-return factors (S_T / S_0)
# T_perf is the full performance period in years (always the complete window)
# ---------------------------------------------------------------------------
def _compute_psu_mult(company_factor: np.ndarray,
                      peer_factor_matrix: np.ndarray,
                      peer_idx: List[int],
                      T_perf: float,
                      psu_cfg: Dict[str, Any],
                      rng: np.random.Generator,
                      n: int) -> np.ndarray:
    mode = psu_cfg["mode"]
    rtsr_mult = np.ones(n)
    internal_mult = np.ones(n)

    if mode in ("rtsr", "both"):
        if len(peer_idx) == 0:
            rtsr_mult = np.ones(n)
        else:
            rtsr_curve   = psu_cfg["rtsr_curve"]
            rtsr_scoring = psu_cfg.get("rtsr_scoring", "gap")

            if rtsr_scoring == "percentile_rank":
                beats    = (company_factor > peer_factor_matrix).sum(axis=0)
                pct_rank = beats / len(peer_idx)
                pct_curve = {
                    "threshold_enabled": True,
                    "threshold_perf":  rtsr_curve["threshold_percentile"] / 100,
                    "threshold_payout": rtsr_curve["threshold_payout"],
                    "target_perf":     rtsr_curve["target_percentile"] / 100,
                    "target_payout":   rtsr_curve["target_payout"],
                    "max_perf":        rtsr_curve["max_percentile"] / 100,
                    "max_payout":      rtsr_curve["max_payout"],
                }
                rtsr_mult = np.array([calculate_multiplier_achievement(float(p), pct_curve)
                                      for p in pct_rank])
            elif rtsr_scoring == "gap_median":
                # Gap vs peer median — more robust to outlier peers than mean
                peer_median_factor = np.median(peer_factor_matrix, axis=0)
                co_ann   = (company_factor      ** (1 / T_perf) - 1) * 100
                peer_ann = (peer_median_factor   ** (1 / T_perf) - 1) * 100
                rtsr_gap = co_ann - peer_ann
                rtsr_mult = np.array([calculate_multiplier_gap(float(g), rtsr_curve)
                                      for g in rtsr_gap])
            else:
                # gap (default) — gap vs peer mean
                peer_avg_factor = peer_factor_matrix.mean(axis=0)
                co_ann   = (company_factor   ** (1 / T_perf) - 1) * 100
                peer_ann = (peer_avg_factor  ** (1 / T_perf) - 1) * 100
                rtsr_gap = co_ann - peer_ann
                rtsr_mult = np.array([calculate_multiplier_gap(float(g), rtsr_curve)
                                      for g in rtsr_gap])

    if mode in ("internal", "both"):
        internal_metrics = psu_cfg.get("internal_metrics") or []
        if not internal_metrics:
            internal_metrics = [{
                "weight": 1.0,
                "volatility_sigma": psu_cfg.get("internal_volatility_sigma", 0.10),
                "distribution": psu_cfg.get("internal_distribution", "lognormal"),
                "curve": psu_cfg.get("internal_curve", {}),
            }]

        n_int = len(internal_metrics)
        total_w = sum(float(m.get("weight", 1.0)) for m in internal_metrics) or 1.0

        # ── Correlated Z draws for internal metrics ──────────────────────────
        # Use the supplied correlation matrix; fall back to 0.6 off-diagonal
        # (realistic for financial metrics driven by the same business cycle).
        raw_corr = psu_cfg.get("internal_correlation_matrix") or []
        if n_int == 1:
            Z_int = rng.standard_normal((1, n))
        elif raw_corr and len(raw_corr) == n_int:
            R_int = np.array(raw_corr, dtype=float)
            # Nearest PSD fix
            eigvals, eigvecs = np.linalg.eigh(R_int)
            eigvals = np.maximum(eigvals, 1e-10)
            R_int = eigvecs @ np.diag(eigvals) @ eigvecs.T
            d = np.sqrt(np.diag(R_int))
            R_int = R_int / np.outer(d, d)
            L_int = np.linalg.cholesky(R_int)
            Z_int = L_int @ rng.standard_normal((n_int, n))
        else:
            # Default: 0.6 off-diagonal
            R_int = np.full((n_int, n_int), 0.6)
            np.fill_diagonal(R_int, 1.0)
            L_int = np.linalg.cholesky(R_int)
            Z_int = L_int @ rng.standard_normal((n_int, n))

        weighted_mult = np.zeros(n)
        for idx, m in enumerate(internal_metrics):
            w         = float(m.get("weight", 1.0)) / total_w
            int_curve = m.get("curve", {}) or {}
            if not int_curve:
                int_curve = {
                    "threshold_enabled": True, "threshold_perf": 0.80, "threshold_payout": 0.50,
                    "target_perf": 1.00, "target_payout": 1.00, "max_perf": 1.20, "max_payout": 2.00,
                }
            z = Z_int[idx]

            sim_mode = m.get("simulation_mode", "relative")
            historical = m.get("historical_actuals") or []
            included = [r for r in historical if r.get("included", True) and r.get("value", 0) != 0]
            included_sorted = sorted(included, key=lambda r: r["year"])

            if sim_mode == "target_difficulty" and len(included_sorted) >= 2:
                # ── EAGR path ─────────────────────────────────────────────
                actuals = np.array([float(r["value"]) for r in included_sorted])
                yoy = np.diff(actuals) / np.abs(actuals[:-1])
                g_inf  = float(np.mean(yoy))
                sig_inf = float(np.std(yoy, ddof=1))
                X0 = float(actuals[-1])
                budget = float(m.get("budget_target") or X0)
                sigma_override = m.get("eagr_sigma_override")
                sig = float(sigma_override) if sigma_override is not None else sig_inf
                # EAGR: X_T = X0 + X0*g*T + σ*X0*√T*Z  (multi-year horizon)
                X_sim = X0 + X0 * g_inf * T_perf + sig * X0 * np.sqrt(T_perf) * z
                X_sim = np.maximum(X_sim, 0.0)
                ach_int = X_sim / budget if budget != 0 else np.ones(n)
            else:
                # ── Relative path (default) ───────────────────────────────
                sigma_int = float(m.get("volatility_sigma", 0.10))
                dist_int  = m.get("distribution", "lognormal")
                if dist_int == "lognormal":
                    mu_ln    = np.log(1.0 ** 2 / np.sqrt(sigma_int ** 2 + 1.0 ** 2))
                    sigma_ln = np.sqrt(np.log(1 + sigma_int ** 2))
                    ach_int  = np.exp(mu_ln + sigma_ln * z)
                else:
                    ach_int = np.maximum(1.0 + sigma_int * z, 0.0)

            metric_mult = np.array([calculate_multiplier_achievement(float(a), int_curve) for a in ach_int])
            weighted_mult += w * metric_mult
        internal_mult = weighted_mult

    if mode == "rtsr":
        return rtsr_mult
    elif mode == "internal":
        return internal_mult
    else:
        rw = float(psu_cfg["rtsr_weight"])
        iw = float(psu_cfg["internal_weight"])
        return rw * rtsr_mult + iw * internal_mult


# ---------------------------------------------------------------------------
# Main LTIP simulation — supports cliff, graded_thirds, and custom_graded
# ---------------------------------------------------------------------------
def run_ltip_simulation(payload: Dict[str, Any],
                         market_data: Dict[str, Any]) -> Dict[str, Any]:
    n           = int(payload.get("n_simulations", 10_000))
    vesting_mode = payload.get("vesting_mode", "cliff")
    T_input     = float(payload.get("vesting_term", 3.0))
    mu_co       = float(payload["company_growth_rate"])
    S0          = float(payload["share_price"])
    K           = float(payload.get("strike_price") or S0)

    # ── Build vest schedule: list of (year_label, fraction_of_units) ─────────
    # RSUs and Options split across these tranches.
    # PSUs always cliff-vest at the terminal year (full-period TSR).
    if vesting_mode == "cliff":
        vest_schedule = [(T_input, 1.0)]
    elif vesting_mode == "graded_thirds":
        n_yrs = max(1, int(round(T_input)))
        frac  = 1.0 / n_yrs
        vest_schedule = [(float(y), frac) for y in range(1, n_yrs + 1)]
    else:  # custom_graded
        raw = payload.get("custom_schedule") or [1.0]
        # Normalise so fractions always sum to exactly 1.0
        total = sum(raw)
        vest_schedule = [(float(y), f / total) for y, f in enumerate(raw, 1)]

    T_perf = vest_schedule[-1][0]  # full performance period = last vest year

    # ── Black-Scholes for option unit sizing ─────────────────────────────────
    opt_fv_pct = option_fair_value_pct(
        S=S0, K=K, T=float(payload["option_term"]),
        r=float(payload["risk_free_rate"]),
        q=float(payload["dividend_yield"]),
        sigma=float(market_data["annual_vol"]["COMPANY"]),
    )
    units = calculate_grant_units(
        grant_value=float(payload["grant_value"]),
        share_price=S0,
        rsu_wt=float(payload["rsu_weight"]),
        psu_wt=float(payload["psu_weight"]),
        opt_wt=float(payload["option_weight"]),
        option_fv_pct=opt_fv_pct,
    )

    # ── Market data + Cholesky ────────────────────────────────────────────────
    tickers      = market_data["tickers"]
    annual_vol   = market_data["annual_vol"]
    annual_return = market_data["annual_return"]
    R = np.array(market_data["corr_matrix"], dtype=float)

    eigvals, eigvecs = np.linalg.eigh(R)
    eigvals = np.maximum(eigvals, 1e-10)
    R = eigvecs @ np.diag(eigvals) @ eigvecs.T
    d = np.sqrt(np.diag(R))
    R = R / np.outer(d, d)
    L = np.linalg.cholesky(R)

    n_assets = len(tickers)
    co_idx   = tickers.index("COMPANY")
    peer_idx = [i for i in range(n_assets) if i != co_idx]

    # Peer drift: use CAPM (rf + β × ERP) when betas are provided for a peer,
    # otherwise fall back to common drift (mu_co) so the gap is unbiased.
    # Company drift is always mu_co (user's explicit growth assumption).
    rf         = float(payload.get("risk_free_rate", 0.035))
    erp        = float(payload.get("equity_risk_premium", 0.05))
    peer_betas = market_data.get("peer_betas", {})
    mu_vec = np.array([
        mu_co if i == co_idx
        else (rf + peer_betas[t] * erp if t in peer_betas else mu_co)
        for i, t in enumerate(tickers)
    ])
    sigma_vec = np.array([annual_vol[t] for t in tickers])

    rng = np.random.default_rng()

    # ── Simulate price paths ──────────────────────────────────────────────────
    if vesting_mode == "cliff":
        # Single terminal draw — fast path, same as the original engine.
        Z_ind  = rng.standard_normal((n_assets, n))
        Z_corr = L @ Z_ind
        R_factor = np.exp(
            (mu_vec - 0.5 * sigma_vec ** 2)[:, None] * T_perf
            + sigma_vec[:, None] * np.sqrt(T_perf) * Z_corr
        )
        # One tranche: everything vests at terminal year
        S_co_per_tranche  = [S0 * R_factor[co_idx]]   # list of (n,) arrays
        company_factor_terminal = R_factor[co_idx]
        peer_factor_terminal    = R_factor[peer_idx] if peer_idx else np.ones((0, n))

    else:
        # Annual path steps — required for graded vesting.
        # Each step advances 1 year with fresh correlated normals.
        # The cumulative log-return at each annual checkpoint gives S_t.
        log_S_cum = np.zeros((n_assets, n))
        S_co_per_tranche = []
        prev_year = 0.0

        for yr, _frac in vest_schedule:
            # Draw for the interval (prev_year → yr).  For integer schedules
            # this is always Δt = 1 year; for fractional intervals generalise
            # by scaling the GBM increment by sqrt(Δt).
            dt = yr - prev_year
            Z_ind  = rng.standard_normal((n_assets, n))
            Z_corr = L @ Z_ind
            log_S_cum += (
                (mu_vec - 0.5 * sigma_vec ** 2)[:, None] * dt
                + sigma_vec[:, None] * np.sqrt(dt) * Z_corr
            )
            S_co_per_tranche.append(S0 * np.exp(log_S_cum[co_idx]))
            prev_year = yr

        # Terminal factors for PSU TSR (last annual step = full period)
        company_factor_terminal = np.exp(log_S_cum[co_idx])
        peer_factor_terminal    = (np.exp(log_S_cum[peer_idx])
                                   if peer_idx else np.ones((0, n)))

    # ── PSU multiplier — always uses the full performance period ─────────────
    psu_cfg = payload["psu_metric"]
    psu_mult = _compute_psu_mult(
        company_factor_terminal, peer_factor_terminal,
        peer_idx, T_perf, psu_cfg, rng, n,
    )

    # ── Aggregate realized value per trial ───────────────────────────────────
    # RSUs and Options are split across vest tranches.
    # PSU cliff-vests as a lump sum at the terminal year.
    S_T_co   = S_co_per_tranche[-1]         # terminal company price (n,)
    rsu_val  = np.zeros(n)
    opt_val  = np.zeros(n)
    for (yr, frac), s_co in zip(vest_schedule, S_co_per_tranche):
        rsu_val += frac * units["rsu_units"] * s_co
        opt_val += frac * units["option_units"] * np.maximum(s_co - K, 0.0)
    psu_val   = units["psu_units"] * S_T_co * psu_mult
    total_val = rsu_val + psu_val + opt_val

    # ── Sort and extract percentile cases ─────────────────────────────────────
    sort_idx = np.argsort(total_val)
    total_s  = total_val[sort_idx]
    rsu_s    = rsu_val[sort_idx]
    psu_s    = psu_val[sort_idx]
    opt_s    = opt_val[sort_idx]

    def extract_case(pct: float) -> Dict[str, float]:
        target = float(np.percentile(total_s, pct))
        idx = min(int(np.searchsorted(total_s, target)), n - 1)
        return {
            "rsu":    round(float(rsu_s[idx]), 0),
            "psu":    round(float(psu_s[idx]), 0),
            "option": round(float(opt_s[idx]), 0),
            "total":  round(float(total_s[idx]), 0),
        }

    bear_case = extract_case(10)
    base_case = extract_case(50)
    bull_case = extract_case(90)
    grant_value = float(payload["grant_value"])
    median_psu_mult = float(np.percentile(psu_mult, 50))

    # ── Year-by-year table (uses GBM expected price for readability) ──────────
    # Cliff: years before T are indicative unrealised value.
    # Graded: each row is the tranche that actually vests that year (realised).
    sigma_co = float(annual_vol["COMPANY"])

    def gbm_expected_price(t: float) -> float:
        # Use median GBM path (variance-adjusted) so year-by-year base case
        # is consistent with the P50 Monte Carlo card above.
        # Median of lognormal = S0 * exp((μ - σ²/2) * t)
        return S0 * math.exp((mu_co - 0.5 * sigma_co ** 2) * t)

    yby: List[Dict[str, Any]] = []
    for step_idx, (yr, frac) in enumerate(vest_schedule):
        s_t = gbm_expected_price(yr)
        is_terminal = (step_idx == len(vest_schedule) - 1)
        is_cliff     = (vesting_mode == "cliff")

        # RSU and option for this tranche
        rsu_v = frac * units["rsu_units"] * s_t
        opt_v = frac * units["option_units"] * max(s_t - K, 0.0)

        # PSU only at terminal year; earlier years show 0 for graded
        if is_terminal:
            # Use the PSU value from the actual P50 simulation trial so the
            # table is consistent with the Base (P50) card.  Computing
            # s_t × median_psu_mult independently overstates because stock
            # price and PSU multiplier are positively correlated — their
            # independent medians multiply to more than the median of their
            # product.
            psu_v = base_case["psu"]
        elif is_cliff:
            # Cliff indicative years: show full PSU at expected price × 1.0
            psu_v = units["psu_units"] * s_t * 1.0
        else:
            psu_v = 0.0   # graded non-terminal years: PSU not yet vested

        # Indicative = unrealised value not yet accessible to the executive.
        # For cliff: all years before terminal are indicative.
        # For graded: each tranche is realised in the year it vests.
        indicative = is_cliff and not is_terminal

        yby.append({
            "year":       int(yr),
            "frac":       round(frac * 100, 1),    # % of units vesting this year
            "indicative": indicative,
            "rsu":        round(rsu_v, 0),
            "psu":        round(psu_v, 0),
            "option":     round(opt_v, 0),
            "total":      round(rsu_v + psu_v + opt_v, 0),
        })

    percentile_distribution = np.percentile(total_s, np.arange(1, 101)).tolist()

    # ── Post-vest option fan (GBM extension from vest → expiry) ──────────────
    # Only meaningful when there are options and remaining term > 0.
    post_vest_fan: List[Dict[str, Any]] = []
    opt_units = units["option_units"]
    remaining_term = float(payload.get("option_term", 5.0)) - T_perf
    if opt_units > 0 and remaining_term > 0.001:
        # Sample every 0.5 yr; ensure at least 3 points including endpoints.
        dt_post = 0.5
        n_steps = max(2, math.ceil(remaining_term / dt_post))
        t_posts = [i * remaining_term / n_steps for i in range(n_steps + 1)]

        # S_T_co is already the terminal company price for each trial (n,).
        # Extend each trial's GBM path independently for the post-vest period.
        for t_post in t_posts:
            if t_post < 1e-9:
                # At vest: option already has time value = BS(S_T_co, K, remaining, r, q, σ)
                S_post = S_T_co
            else:
                Z_pv = rng.standard_normal(n)
                S_post = S_T_co * np.exp(
                    (mu_co - 0.5 * sigma_co ** 2) * t_post
                    + sigma_co * np.sqrt(t_post) * Z_pv
                )

            t_remaining = remaining_term - t_post   # time left to expiry
            # BS hold value at this snapshot
            if t_remaining > 1e-9:
                bs_vals = np.array([
                    black_scholes_call(float(s), K, t_remaining, rf, float(payload.get("dividend_yield", 0.0)), sigma_co)
                    for s in S_post
                ])
            else:
                bs_vals = np.maximum(S_post - K, 0.0)

            intrinsic_vals = np.maximum(S_post - K, 0.0)

            # Scale to dollar value (multiply by option units × per-unit values)
            bs_dollar      = bs_vals      * opt_units
            intrinsic_dollar = intrinsic_vals * opt_units

            post_vest_fan.append({
                "t_post":        round(t_post, 4),           # years after vest
                "t_abs":         round(T_perf + t_post, 4),  # years from grant
                "bs_p10":        round(float(np.percentile(bs_dollar, 10)), 0),
                "bs_p50":        round(float(np.percentile(bs_dollar, 50)), 0),
                "bs_p90":        round(float(np.percentile(bs_dollar, 90)), 0),
                "intrinsic_p10": round(float(np.percentile(intrinsic_dollar, 10)), 0),
                "intrinsic_p50": round(float(np.percentile(intrinsic_dollar, 50)), 0),
                "intrinsic_p90": round(float(np.percentile(intrinsic_dollar, 90)), 0),
            })

    return {
        "bear":  bear_case,
        "base":  base_case,
        "bull":  bull_case,
        "grant_value":    grant_value,
        "bear_multiple":  round(bear_case["total"] / grant_value, 2),
        "base_multiple":  round(base_case["total"] / grant_value, 2),
        "bull_multiple":  round(bull_case["total"] / grant_value, 2),
        "option_fair_value_pct": round(opt_fv_pct * 100, 2),
        "units":          {k: round(v, 2) for k, v in units.items()},
        "vesting_mode":   vesting_mode,
        "vest_schedule":  [{"year": int(y), "frac": round(f * 100, 1)} for y, f in vest_schedule],
        "year_by_year":   yby,
        "percentile_distribution": percentile_distribution,
        "post_vest_fan":  post_vest_fan,
    }
