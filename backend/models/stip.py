from pydantic import BaseModel, field_validator
from typing import Optional, List


class MilestoneOutcome(BaseModel):
    """One discrete outcome for a milestone-type metric."""
    label: str           # e.g. "Failed", "On Track", "Exceeded"
    probability: float   # decimal; all outcomes for one metric must sum to 1.0
    achievement: float   # achievement decimal, e.g. 1.0 = 100% of budget


class CurveDesign(BaseModel):
    threshold_enabled: bool = False
    threshold_perf: float = 0.80
    threshold_payout: float = 0.50
    target_perf: float = 1.00
    target_payout: float = 1.00
    max_perf: float = 1.20
    max_payout: float = 2.00


class ScorecardMetric(BaseModel):
    name: str
    category_type: str  # "financial" | "operational" | "esg" | "individual"
    weight: float        # decimal e.g. 0.60
    budget_target: float
    volatility_sigma: float
    distribution: Optional[str] = None   # overrides global if set
    # Pass 1 — metric behaviour extensions
    metric_behavior: str = "continuous"  # continuous | safety_capped | safety_gate | individual | milestone
    gate_probability: float = 0.0        # decimal, e.g. 0.03 = 3% annual incident probability
    # Pass 2 — discrete milestone outcomes
    milestone_outcomes: Optional[List[MilestoneOutcome]] = None
    # Pass 3 — per-metric payout curve override
    curve: Optional[CurveDesign] = None
    # Pass 4 — metric direction
    metric_direction: str = "higher"            # "higher" | "lower" (costs, incidents, etc.)
    # Pass 5 — target difficulty (EAGR) simulation
    simulation_mode: str = "relative"          # "relative" | "target_difficulty"
    historical_actuals: Optional[List[float]] = None
    eagr_sigma_override: Optional[float] = None  # if set, overrides inferred σ from historicals
    eagr_g_override: Optional[float] = None      # if set, overrides inferred g (mean growth) from historicals


class PeerBenchmark(BaseModel):
    median_pct: float = 0.55
    p25_pct: float = 0.40
    p75_pct: float = 0.70
    data_source: str = ""


class StipSimulateRequest(BaseModel):
    base_salary: float = 400_000
    target_stip_pct: float = 0.60
    distribution: str = "lognormal"
    n_simulations: int = 10_000
    curve_design: CurveDesign
    scorecard_metrics: List[ScorecardMetric]
    correlation_matrix: List[List[float]]
    peer_benchmark: Optional[PeerBenchmark] = None
    # Pass 2 — plan-level board discretion modifier
    board_discretion_pct: float = 0.0   # max ±adjustment as decimal (e.g. 0.20 = ±20%)

    @field_validator("scorecard_metrics")
    @classmethod
    def weights_sum_to_one(cls, v):
        # Safety-gate metrics carry weight=0 and act as post-calculation modifiers,
        # so exclude them from the 100% target check.
        non_gate = [m for m in v if m.metric_behavior != "safety_gate"]
        total = round(sum(m.weight for m in non_gate), 6)
        if abs(total - 1.0) > 0.01:
            raise ValueError(f"Scorecard weights sum to {total*100:.1f}%. Must equal 100%.")
        return v


class ValidateMatrixRequest(BaseModel):
    correlation_matrix: List[List[float]]


class StipExportRequest(BaseModel):
    inputs: StipSimulateRequest
    results: dict  # the full simulate response
