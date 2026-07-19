export interface PeerRecord {
  lookup_key: string
  ticker: string
  company_name: string
  year: number
  role_tags: string[]              // resolved tags; [] = excluded from role tabs
  position_match: string | null    // raw/audit field, not used for tab assignment
  position_title: string | null
  incumbent_name: string | null

  base_salary: number | null
  base_salary_next_year: number | null

  stip_actual: number | null
  stip_target_pct: number | null
  stip_3yr_avg_pct: number | null
  stip_target_dollar: number | null
  actual_tcc: number | null
  target_tcc: number | null

  ltip_rsu: number | null
  ltip_psu: number | null
  ltip_options: number | null
  ltip_dsu: number | null
  ltip_cash: number | null
  ltip_total: number | null
  ltip_target_pct: number | null
  ltip_3yr_avg_pct: number | null
  ltip_target_dollar: number | null

  target_tdc: number | null
  actual_tdc: number | null

  pension: number | null
  pension_type: string | null
  pension_converted: number | null
  pension_3yr_avg: number | null
  other: number | null
  other_converted: number | null
  other_3yr_avg: number | null
  actual_total_comp: number | null
  target_total_comp: number | null

  months_in_role: number | null
  is_client: boolean
}

export interface PeerSizeRecord {
  ticker: string
  company_name: string
  market_cap: number | null
  tev: number | null
  revenue: number | null
  total_assets: number | null
}

export interface PriorYearRecord {
  lookup_key: string
  ticker: string
  role: string
  company_name: string
  year: number
  actual_tdc: number | null
  target_tdc: number | null
  is_client: boolean
}

export interface BenchmarkData {
  client_ticker: string
  reporting_currency: string
  default_year: number
  available_years: number[]
  roles: string[]              // unique values across all peers[i].role_tags, sorted
  peers: PeerRecord[]
  peer_sizes: PeerSizeRecord[]
  validation_warnings: string[]
  aging_factor: number
  prior_year_records: PriorYearRecord[]
}

export type PayMetric = 'base' | 'tcc' | 'tdc' | 'total_comp'
export type SizeMetric = 'market_cap' | 'tev' | 'revenue' | 'total_assets'

export interface PercentileResult {
  p25: number
  p50: number
  p75: number
  avg: number
}

export interface PeerWeightedResult {
  ticker: string
  company_name: string
  pay_value: number
  suggested_weight: number
  applied_weight: number
  size_value: number | null
  predicted_pay: number | null
  residual: number | null
}

export interface RegressionResult {
  slope: number | null
  intercept: number | null
  r_squared: number | null
  client_predicted_pay: number | null
  regression_valid: boolean
  regression_warning: string | null
}

export interface CalculationResponse {
  role: string
  year: number
  pay_metric: PayMetric
  size_metric: SizeMetric
  unweighted: PercentileResult
  weighted: PercentileResult
  client_pay: number | null
  client_percentile_unweighted: number | null
  client_percentile_weighted: number | null
  peers: PeerWeightedResult[]
  regression: RegressionResult
}

export interface CalculateRequest {
  benchmark_data: BenchmarkData
  role: string
  year: number
  pay_metric: PayMetric
  size_metric: SizeMetric
  peer_weights: Record<string, number>
}

export interface SuggestWeightsRequest {
  benchmark_data: BenchmarkData
  role: string
  year: number
  size_metric: SizeMetric
}

export interface ExportRequest {
  benchmark_data: BenchmarkData
  calculation: CalculationResponse
}

export interface AgedPeerDetail {
  ticker: string
  company_name: string
  current_salary: number | null
  next_year_salary_disclosed: number | null
  used_disclosed: boolean
  aged_salary: number | null
  sti_pct: number | null
  lti_pct: number | null
  aged_stip: number | null
  aged_tcc: number | null
  aged_ltip: number | null
  aged_tdc: number | null
  excluded: boolean
}

export interface YoYYearStats {
  year: number
  label: string                // "2024", "2025", "2026E"
  aged: boolean
  p25: number | null
  p50: number | null
  p75: number | null
  avg: number | null
  client: number | null
  client_percentile: number | null
  n_peers: number
}

export interface YoYResponse {
  role: string
  metric: string
  aging_factor: number
  years: YoYYearStats[]
  aged_peers: AgedPeerDetail[]
}

export interface PriorYearOverride {
  p25?: number | null
  p50?: number | null
  p75?: number | null
  avg?: number | null
  client?: number | null
}

export interface YoYRequest {
  benchmark_data: BenchmarkData
  role: string
  aging_factor?: number | null
  prior_year_override?: PriorYearOverride | null
  excluded_tickers?: string[] | null
}

export const PAY_METRIC_LABELS: Record<PayMetric, string> = {
  base: 'Base Salary',
  tcc: 'Total Cash (TCC)',
  tdc: 'Total Direct Comp (TDC)',
  total_comp: 'Total Comp',
}

export const SIZE_METRIC_LABELS: Record<SizeMetric, string> = {
  market_cap: 'Market Cap',
  tev: 'Total Enterprise Value',
  revenue: 'Revenue',
  total_assets: 'Total Assets',
}
