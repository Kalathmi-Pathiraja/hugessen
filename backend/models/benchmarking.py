from pydantic import BaseModel
from typing import Optional, List, Dict


class PeerRecord(BaseModel):
    lookup_key: str
    ticker: str
    company_name: str
    year: int
    role_tags: List[str] = []        # resolved per role-tag rule; [] = excluded from role tabs
    position_match: Optional[str] = None   # raw/audit field, not used for tab assignment
    position_title: Optional[str] = None
    incumbent_name: Optional[str] = None

    base_salary: Optional[float] = None
    base_salary_next_year: Optional[float] = None

    stip_actual: Optional[float] = None
    stip_target_pct: Optional[float] = None
    stip_3yr_avg_pct: Optional[float] = None
    stip_target_dollar: Optional[float] = None
    actual_tcc: Optional[float] = None
    target_tcc: Optional[float] = None

    ltip_rsu: Optional[float] = None
    ltip_psu: Optional[float] = None
    ltip_options: Optional[float] = None
    ltip_dsu: Optional[float] = None
    ltip_cash: Optional[float] = None
    ltip_total: Optional[float] = None
    ltip_target_pct: Optional[float] = None
    ltip_3yr_avg_pct: Optional[float] = None
    ltip_target_dollar: Optional[float] = None

    target_tdc: Optional[float] = None
    actual_tdc: Optional[float] = None

    pension: Optional[float] = None
    pension_type: Optional[str] = None
    pension_converted: Optional[float] = None
    pension_3yr_avg: Optional[float] = None
    other: Optional[float] = None
    other_converted: Optional[float] = None
    other_3yr_avg: Optional[float] = None
    actual_total_comp: Optional[float] = None
    target_total_comp: Optional[float] = None

    months_in_role: Optional[float] = None
    is_client: bool = False


class PeerSizeRecord(BaseModel):
    ticker: str
    company_name: str
    market_cap: Optional[float] = None
    tev: Optional[float] = None
    revenue: Optional[float] = None
    total_assets: Optional[float] = None


class PriorYearRecord(BaseModel):
    """One row of an "Import <year> Data" tab — the prior engagement's final
    Actual/Target TDC, used for the earliest column of the YoY trend chart
    (the prior year's Raw Data rows carry actual-only disclosures, so their
    target fields are unusable)."""
    lookup_key: str
    ticker: str
    role: str
    company_name: str
    year: int
    actual_tdc: Optional[float] = None
    target_tdc: Optional[float] = None
    is_client: bool = False


class BenchmarkData(BaseModel):
    client_ticker: str
    reporting_currency: str
    default_year: int
    available_years: List[int]
    roles: List[str]            # unique values across all peers[i].role_tags, sorted
    peers: List[PeerRecord]
    peer_sizes: List[PeerSizeRecord]
    validation_warnings: List[str] = []
    # Single global aging assumption ('Raw Data'!H13 "Data Aging:" in the source
    # model) — every role tab references the same cell, so one value here, not
    # one per role.
    aging_factor: float = 0.03
    prior_year_records: List[PriorYearRecord] = []


# ---------------------------------------------------------------------------
# Calculation models
# ---------------------------------------------------------------------------

class PercentileResult(BaseModel):
    p25: float
    p50: float
    p75: float
    avg: float


class PeerWeightedResult(BaseModel):
    ticker: str
    company_name: str
    pay_value: float
    suggested_weight: float
    applied_weight: float
    size_value: Optional[float] = None
    predicted_pay: Optional[float] = None
    residual: Optional[float] = None


class RegressionResult(BaseModel):
    slope: Optional[float] = None
    intercept: Optional[float] = None
    r_squared: Optional[float] = None
    client_predicted_pay: Optional[float] = None
    regression_valid: bool = False
    regression_warning: Optional[str] = None


class CalculationResponse(BaseModel):
    role: str
    year: int
    pay_metric: str            # 'base' | 'tcc' | 'tdc' | 'total_comp'
    size_metric: str           # 'market_cap' | 'tev' | 'revenue' | 'total_assets'
    unweighted: PercentileResult
    weighted: PercentileResult
    client_pay: Optional[float] = None
    client_percentile_unweighted: Optional[float] = None
    client_percentile_weighted: Optional[float] = None
    peers: List[PeerWeightedResult]
    regression: RegressionResult


class CalculateRequest(BaseModel):
    benchmark_data: BenchmarkData
    role: str
    year: int
    pay_metric: str
    size_metric: str
    peer_weights: Dict[str, float] = {}   # ticker -> applied weight override; missing = use suggested


class SuggestWeightsRequest(BaseModel):
    benchmark_data: BenchmarkData
    role: str
    year: int
    size_metric: str


class ExportRequest(BaseModel):
    benchmark_data: BenchmarkData
    calculation: CalculationResponse


# ---------------------------------------------------------------------------
# YoY trend / data aging models
# ---------------------------------------------------------------------------

class AgedPeerDetail(BaseModel):
    """Per-peer aged projection — surfaced so the UI (and spot-checks) can show
    exactly how each aged TDC was built."""
    ticker: str
    company_name: str
    current_salary: Optional[float] = None
    next_year_salary_disclosed: Optional[float] = None
    used_disclosed: bool = False
    aged_salary: Optional[float] = None
    sti_pct: Optional[float] = None
    lti_pct: Optional[float] = None
    aged_stip: Optional[float] = None
    aged_tcc: Optional[float] = None
    aged_ltip: Optional[float] = None
    aged_tdc: Optional[float] = None
    excluded: bool = False          # analyst-excluded from the aged-year percentile calc


class YoYYearStats(BaseModel):
    year: int
    label: str                     # "2024", "2025", "2026E"
    aged: bool = False             # True only for the projection column
    p25: Optional[float] = None
    p50: Optional[float] = None
    p75: Optional[float] = None
    avg: Optional[float] = None
    client: Optional[float] = None
    client_percentile: Optional[float] = None
    n_peers: int = 0


class YoYResponse(BaseModel):
    role: str
    metric: str                    # currently always 'tdc' (Target TDC)
    aging_factor: float
    years: List[YoYYearStats]
    aged_peers: List[AgedPeerDetail]


class PriorYearOverride(BaseModel):
    """Hardcoded prior-year stats for the YoY chart. The source model's YoY
    tabs paste these values in by hand (they predate the current Raw Data), so
    the platform allows the same: any field set here replaces the value
    derived from the Import tab. All in raw dollars."""
    p25: Optional[float] = None
    p50: Optional[float] = None
    p75: Optional[float] = None
    avg: Optional[float] = None
    client: Optional[float] = None


class YoYRequest(BaseModel):
    benchmark_data: BenchmarkData
    role: str
    aging_factor: Optional[float] = None   # None = use benchmark_data.aging_factor
    prior_year_override: Optional[PriorYearOverride] = None
    excluded_tickers: Optional[List[str]] = None   # dropped from the 2026E aged percentile calc only
