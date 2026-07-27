export interface CurveDesign {
  threshold_enabled: boolean
  threshold_perf: number     // e.g. 0.80
  threshold_payout: number   // e.g. 0.50
  target_perf: number        // hardlocked 1.00
  target_payout: number      // hardlocked 1.00
  max_perf: number           // e.g. 1.20
  max_payout: number         // e.g. 2.00
}

export type MetricBehavior = 'continuous' | 'safety_capped' | 'safety_gate' | 'individual' | 'milestone'
export type MetricDirection = 'higher' | 'lower'

// Pass 2 — one discrete outcome for a milestone metric
export interface MilestoneOutcome {
  label: string       // e.g. "Failed", "On Track", "Exceeded"
  probability: number // decimal; all outcomes for one metric must sum to 1.0
  achievement: number // achievement decimal, e.g. 1.0 = at budget
}

// Historical actuals row — used by the table editor in TargetDifficultyPanel
export interface HistoricalDataRow {
  year: number
  value: number
  included: boolean   // whether this row is used for g/σ inference
}

export interface ScorecardMetric {
  id: string                 // local UUID for table keying
  name: string
  category_type: 'financial' | 'operational' | 'esg' | 'individual'
  category_label: string     // user-facing display name of the category
  weight: number             // decimal 0–1
  budget_target: number
  volatility_sigma: number
  distribution?: string      // 'lognormal' | 'normal'
  // Pass 1 — metric behaviour extensions
  metric_behavior: MetricBehavior
  metric_direction?: MetricDirection  // 'higher' (default) | 'lower' (costs, incidents, etc.)
  gate_probability?: number           // decimal 0–1; only for safety_gate
  // Pass 2 — milestone discrete outcomes
  milestone_outcomes?: MilestoneOutcome[]
  // Per-metric curve override (falls back to global if not set)
  curve?: CurveDesign
  // Target difficulty mode
  simulation_mode?: 'relative' | 'target_difficulty'
  historical_data?: HistoricalDataRow[]   // rich table (year + value + included flag)
  historical_actuals?: number[]           // legacy / derived — used as backend payload
  eagr_sigma_override?: number            // if set, overrides inferred σ from historicals
  eagr_g_override?: number               // if set, overrides inferred g (growth rate) from historicals
}

export interface PeerBenchmark {
  median_pct: number
  p25_pct: number
  p75_pct: number
  data_source: string
}

export interface StipInputs {
  base_salary: number
  target_stip_pct: number
  distribution: 'lognormal' | 'normal'
  n_simulations: number
  curve_design: CurveDesign
  scorecard_metrics: ScorecardMetric[]
  correlation_matrix: number[][]
  peer_benchmark?: PeerBenchmark
}

// Category definition — four fixed types, fully renameable display labels
export interface Category {
  type: 'financial' | 'operational' | 'esg' | 'individual'
  label: string
}

export const DEFAULT_CATEGORIES: Category[] = [
  { type: 'financial',    label: 'Financial' },
  { type: 'operational',  label: 'Operational' },
  { type: 'esg',          label: 'ESG' },
  { type: 'individual',   label: 'Individual / Qualitative' },
]

export const METRIC_LIBRARY: Record<string, string[]> = {
  financial:   ['EBITDA', 'Revenue', 'Operating Income', 'Free Cash Flow (FCF)',
                 'Return on Invested Capital (ROIC)', 'Return on Equity (ROE)', 'Net Income'],
  operational: ['Production Volumes', 'HSE Incident Rate (TRIR)',
                 'CapEx Delivery (% on budget)', 'Project Milestones (% complete)',
                 'Customer Satisfaction (NPS)'],
  esg:         ['Carbon Emissions Reduction (% vs baseline)', 'Water Usage Intensity',
                 'Diversity & Inclusion Representation (%)', 'Board Gender Diversity (%)'],
  individual:  ['Leadership Discretionary Score (0–100)', 'Strategic Initiative Delivery',
                 'Talent Development Score'],
}

// Correlation defaults keyed by [type_a, type_b]
export const CORRELATION_DEFAULTS: Record<string, Record<string, number>> = {
  financial:   { financial: 0.60, operational: 0.35, esg: 0.10, individual: 0.10 },
  operational: { financial: 0.35, operational: 0.40, esg: 0.20, individual: 0.20 },
  esg:         { financial: 0.10, operational: 0.20, esg: 0.40, individual: 0.10 },
  individual:  { financial: 0.10, operational: 0.20, esg: 0.10, individual: 0.20 },
}

// Simulation results
export interface MetricStat {
  name: string
  weight_pct: number
  prob_zero: number
  prob_above_threshold: number
  prob_target: number
  prob_max: number
  median_mult: number
  // Raw simulated outcomes
  budget_target: number
  bear_raw: number
  base_raw: number
  bull_raw: number
  bear_achievement_pct: number
  base_achievement_pct: number
  bull_achievement_pct: number
  // Behaviour metadata
  metric_behavior: MetricBehavior
  gate_probability_pct: number
  metric_direction?: MetricDirection
  // Curve info (for achievement chart reference lines)
  threshold_perf?: number
  threshold_enabled?: boolean
  // Target difficulty metadata
  simulation_mode?: string
  inferred_g?: number | null
  inferred_sigma?: number | null
  starting_value?: number | null
}

export interface ScenarioInputs {
  baseSalary: number
  targetStipPct: number
  distribution: 'lognormal' | 'normal'
  curve: CurveDesign
  metrics: ScorecardMetric[]
  corrMatrix: number[][]
  peer: PeerBenchmark
  boardDiscretionPct: number
}

export interface ScenarioSnapshot {
  id: string
  name: string
  inputs: ScenarioInputs
  results: StipResults | null
  running: boolean
  error: string | null
}

export interface ScenarioPercentiles {
  bear: number
  base: number
  bull: number
}

export interface StipResults {
  bear_pct_of_target: number
  base_pct_of_target: number
  bull_pct_of_target: number
  bear_dollar: number
  base_dollar: number
  bull_dollar: number
  target_opportunity: number
  metric_stats: MetricStat[]
  percentile_distribution: number[]
  scenario_percentiles: ScenarioPercentiles
}
