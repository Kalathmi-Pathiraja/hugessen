from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict


class PsuRtsrCurve(BaseModel):
    """Gap-denominated PSU curve. threshold/max in pp. Target hardlocked at 0pp → 1.0x.
    Also carries percentile-rank fields (used when rtsr_scoring='percentile_rank');
    defaults follow standard market practice: 25th/50th/75th percentile."""
    # Gap mode fields
    threshold_gap: float = -10.0   # pp, e.g. -10 means underperform peers by 10pp
    threshold_payout: float = 0.50
    max_gap: float = 15.0          # pp outperformance above which payout is capped
    max_payout: float = 2.00
    # Percentile-rank mode fields (ignored in gap / gap_median modes)
    threshold_percentile: float = 25.0  # percentile below which payout = 0
    target_percentile: float = 50.0     # percentile at which payout = 1.0×
    target_payout: float = 1.00
    max_percentile: float = 75.0        # percentile at/above which payout = max_payout


class PsuInternalCurve(BaseModel):
    """STIP-style achievement curve for internal metric component of PSU."""
    threshold_enabled: bool = True
    threshold_perf: float = 0.80
    threshold_payout: float = 0.50
    target_perf: float = 1.00
    target_payout: float = 1.00
    max_perf: float = 1.20
    max_payout: float = 2.00


class InternalPsuMetric(BaseModel):
    id: str = ""
    name: str = "Internal Metric"
    weight: float = 1.0                    # fraction; all internal metrics must sum to 1.0
    volatility_sigma: float = 0.10
    distribution: str = "lognormal"
    curve: PsuInternalCurve = PsuInternalCurve()
    # EAGR / Target Difficulty fields
    simulation_mode: str = "relative"      # "relative" | "target_difficulty"
    historical_actuals: Optional[List[Dict]] = None  # [{year, value, included}]
    budget_target: Optional[float] = None  # projected target value (same units as actuals)
    eagr_sigma_override: Optional[float] = None  # manual σ override (decimal)


class PsuMetricConfig(BaseModel):
    mode: str = "rtsr"   # "rtsr" | "internal" | "both"
    rtsr_scoring: str = "gap"              # "gap" | "gap_median" | "percentile_rank"
    rtsr_weight: float = 1.0
    internal_weight: float = 0.0
    rtsr_curve: PsuRtsrCurve = PsuRtsrCurve()
    internal_metrics: List[InternalPsuMetric] = []
    internal_correlation_matrix: List[List[float]] = []  # n×n; empty = identity (independent)

    @field_validator("mode")
    @classmethod
    def valid_mode(cls, v):
        if v not in ("rtsr", "internal", "both"):
            raise ValueError("PSU mode must be 'rtsr', 'internal', or 'both'")
        return v


class MarketData(BaseModel):
    """Returned by the upload endpoint and stored in frontend state."""
    tickers: List[str]             # ['COMPANY', 'CNQ', 'TOU', ...]
    annual_vol: Dict[str, float]   # {'COMPANY': 0.28, ...}
    annual_return: Dict[str, float]  # historical mean ann. return per ticker
    corr_matrix: List[List[float]]
    n_trading_days: int
    validation_warnings: List[str] = []
    peer_names: Dict[str, str] = {}   # ticker → full company name from Peer Config sheet
    peer_betas: Dict[str, float] = {}  # ticker → beta from Peer Config sheet; empty = not provided


class LtipSimulateRequest(BaseModel):
    grant_value: float = 500_000
    share_price: float = 20.0
    rsu_weight: float = 0.40
    psu_weight: float = 0.40
    option_weight: float = 0.20
    # Black-Scholes
    option_term: float = 5.0
    risk_free_rate: float = 0.035
    dividend_yield: float = 0.0
    strike_price: Optional[float] = None   # defaults to share_price
    # PSU
    psu_metric: PsuMetricConfig = PsuMetricConfig()
    # GBM / vesting
    company_growth_rate: float = 0.06
    equity_risk_premium: float = 0.05   # ERP for CAPM peer drift; default 5.0%
    vesting_term: float = 3.0            # cliff years, or total years for graded
    vesting_mode: str = "cliff"          # "cliff" | "graded_thirds" | "custom_graded"
    custom_schedule: Optional[List[float]] = None  # fractions per year, must sum to 1.0
    n_simulations: int = 10_000
    # Market data (passed back from upload response)
    market_data: MarketData

    @field_validator("rsu_weight", "psu_weight", "option_weight")
    @classmethod
    def positive_weight(cls, v):
        if v < 0:
            raise ValueError("Vehicle weights must be >= 0")
        return v

    @field_validator("vesting_mode")
    @classmethod
    def valid_vesting_mode(cls, v):
        if v not in ("cliff", "graded_thirds", "custom_graded"):
            raise ValueError("vesting_mode must be 'cliff', 'graded_thirds', or 'custom_graded'")
        return v


class LtipExportRequest(BaseModel):
    inputs: LtipSimulateRequest
    results: dict
