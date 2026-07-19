export interface PsuRtsrCurve {
  threshold_gap: number         // pp, e.g. -10  (gap mode only)
  threshold_payout: number      // e.g. 0.50
  max_gap: number               // pp, e.g. 15   (gap mode only)
  max_payout: number            // e.g. 2.00
  // percentile_rank mode fields
  threshold_percentile: number  // e.g. 25
  target_percentile: number     // e.g. 50
  max_percentile: number        // e.g. 75
  target_payout: number         // e.g. 1.0
}

export interface PsuInternalCurve {
  threshold_enabled: boolean
  threshold_perf: number
  threshold_payout: number
  target_perf: number
  target_payout: number
  max_perf: number
  max_payout: number
}

export interface HistoricalActualRow {
  year: number
  value: number
  included: boolean
}

export interface InternalPsuMetric {
  id: string                       // local UUID for list keying
  name: string                     // e.g. "ROIC", "EBITDA CAGR"
  weight: number                   // decimal 0–1; all internal metrics must sum to 1.0
  volatility_sigma: number
  distribution: 'lognormal' | 'normal'
  curve: PsuInternalCurve
  // EAGR / Target Difficulty
  simulation_mode: 'relative' | 'target_difficulty'
  historical_actuals: HistoricalActualRow[]
  budget_target: number            // projected target value (same units as actuals)
  eagr_sigma_override?: number     // manual σ override (decimal); undefined = use inferred
}

export const DEFAULT_INTERNAL_CURVE: PsuInternalCurve = {
  threshold_enabled: true,
  threshold_perf: 0.80,
  threshold_payout: 0.50,
  target_perf: 1.00,
  target_payout: 1.00,
  max_perf: 1.20,
  max_payout: 2.00,
}

export interface PsuMetricConfig {
  mode: 'rtsr' | 'internal' | 'both'
  rtsr_scoring: 'gap' | 'gap_median' | 'percentile_rank'
  rtsr_weight: number
  internal_weight: number
  rtsr_curve: PsuRtsrCurve
  // Multi-metric internal component
  internal_metrics: InternalPsuMetric[]
  // Correlation matrix for internal metrics (n×n, defaults to 0.6 off-diagonal)
  internal_correlation_matrix: number[][]
}

export interface MarketData {
  tickers: string[]
  annual_vol: Record<string, number>
  annual_return: Record<string, number>
  corr_matrix: number[][]
  n_trading_days: number
  validation_warnings: string[]
  peer_names: Record<string, string>   // ticker → full company name from Peer Config sheet
  peer_betas: Record<string, number>   // ticker → beta; empty = not provided, use common drift
}

export type VestingMode = 'cliff' | 'graded_thirds' | 'custom_graded'

export interface LtipInputs {
  grant_value: number
  share_price: number
  rsu_weight: number
  psu_weight: number
  option_weight: number
  option_term: number
  risk_free_rate: number
  dividend_yield: number
  strike_price?: number
  psu_metric: PsuMetricConfig
  company_growth_rate: number
  equity_risk_premium: number
  vesting_term: number
  vesting_mode: VestingMode
  custom_schedule?: number[]   // fractions per year, only for custom_graded
  n_simulations: number
  market_data: MarketData
}

export interface VehicleCase {
  rsu: number
  psu: number
  option: number
  total: number
}

export interface YearByYear {
  year: number
  indicative: boolean
  rsu: number
  psu: number
  option: number
  total: number
}

export interface YearByYearRow {
  year: number
  frac: number          // % of units vesting this year
  indicative: boolean
  rsu: number
  psu: number
  option: number
  total: number
}

export interface PostVestPoint {
  t_post: number          // years after vest
  t_abs: number           // years from grant
  bs_p10: number
  bs_p50: number
  bs_p90: number
  intrinsic_p10: number
  intrinsic_p50: number
  intrinsic_p90: number
}

export interface LtipResults {
  bear: VehicleCase
  base: VehicleCase
  bull: VehicleCase
  grant_value: number
  bear_multiple: number
  base_multiple: number
  bull_multiple: number
  option_fair_value_pct: number
  units: { rsu_units: number; psu_units: number; option_units: number }
  vesting_mode: VestingMode
  vest_schedule: { year: number; frac: number }[]
  year_by_year: YearByYearRow[]
  percentile_distribution: number[]
  post_vest_fan: PostVestPoint[]
}
