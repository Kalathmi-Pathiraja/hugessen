import { useState, useRef } from 'react'
import ExcelUpload from './ExcelUpload'
import GrantSizing from './GrantSizing'
import BlackScholes from './BlackScholes'
import PsuCurveDesigner from './PsuCurveDesigner'
import SimulationParams from './SimulationParams'
import LtipResults from './LtipResults'
import { ltipApi } from '../../api/client'
import {
  MarketData, LtipResults as ResultsType,
  PsuMetricConfig, PsuRtsrCurve, VestingMode, DEFAULT_INTERNAL_CURVE,
} from '../../types/ltip'

const DEFAULT_RTSR_CURVE: PsuRtsrCurve = {
  threshold_gap: -10,
  threshold_payout: 0.50,
  max_gap: 15,
  max_payout: 2.00,
  threshold_percentile: 25,
  target_percentile: 50,
  max_percentile: 75,
  target_payout: 1.00,
}

const DEFAULT_PSU: PsuMetricConfig = {
  mode: 'rtsr',
  rtsr_scoring: 'gap',
  rtsr_weight: 1.0,
  internal_weight: 0.0,
  rtsr_curve: DEFAULT_RTSR_CURVE,
  internal_metrics: [
    {
      id: 'default-internal-1',
      name: 'ROIC',
      weight: 1.0,
      volatility_sigma: 0.10,
      distribution: 'lognormal',
      curve: { ...DEFAULT_INTERNAL_CURVE },
      simulation_mode: 'relative' as const,
      historical_actuals: [],
      budget_target: 0,
      eagr_sigma_override: undefined,
    },
  ],
  internal_correlation_matrix: [],
}

export default function LtipPage() {
  const [marketData, setMarketData] = useState<MarketData | null>(null)

  const [grantValue, setGrantValue]   = useState(500_000)
  const [sharePrice, setSharePrice]   = useState(20.0)
  const [rsuWeight, setRsuWeight]     = useState(0.40)
  const [psuWeight, setPsuWeight]     = useState(0.40)
  const [optionWeight, setOptionWeight] = useState(0.20)

  const [optionTerm, setOptionTerm]       = useState(5.0)
  const [riskFreeRate, setRiskFreeRate]   = useState(0.035)
  const [dividendYield, setDividendYield] = useState(0.0)
  const [strikePrice, setStrikePrice]     = useState(20.0)

  const [psuConfig, setPsuConfig] = useState<PsuMetricConfig>(DEFAULT_PSU)
  const [companyGrowthRate, setCompanyGrowthRate] = useState(0.06)
  const [useHistoricalGrowth, setUseHistoricalGrowth] = useState(false)
  const [equityRiskPremium, setEquityRiskPremium] = useState(0.05)
  const [vestingMode, setVestingMode]     = useState<VestingMode>('cliff')
  const [vestingTerm, setVestingTerm]     = useState(3)
  const [customSchedule, setCustomSchedule] = useState<number[]>([0.333, 0.333, 0.334])

  const [privateMode, setPrivateMode] = useState(false)
  const [privateSigma, setPrivateSigma] = useState(0.22)

  const [running, setRunning]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [results, setResults]   = useState<ResultsType | null>(null)
  const [exporting, setExporting] = useState(false)

  const resultsRef = useRef<HTMLDivElement>(null)

  function handleGrantChange(patch: {
    grantValue?: number; sharePrice?: number
    rsuWeight?: number; psuWeight?: number; optionWeight?: number
  }) {
    if (patch.grantValue  !== undefined) setGrantValue(patch.grantValue)
    if (patch.sharePrice  !== undefined) { setSharePrice(patch.sharePrice); setStrikePrice(patch.sharePrice) }
    if (patch.rsuWeight   !== undefined) setRsuWeight(patch.rsuWeight)
    if (patch.psuWeight   !== undefined) setPsuWeight(patch.psuWeight)
    if (patch.optionWeight !== undefined) setOptionWeight(patch.optionWeight)
  }

  function handleBsChange(patch: { optionTerm?: number; riskFreeRate?: number; dividendYield?: number; strikePrice?: number }) {
    if (patch.optionTerm    !== undefined) setOptionTerm(patch.optionTerm)
    if (patch.riskFreeRate  !== undefined) setRiskFreeRate(patch.riskFreeRate)
    if (patch.dividendYield !== undefined) setDividendYield(patch.dividendYield)
    if (patch.strikePrice   !== undefined) setStrikePrice(patch.strikePrice)
  }

  async function runSimulation() {
    if (!isReady) { setError('Enable Private Company mode or upload Excel data before running.'); return }
    setError(null)
    setRunning(true)

    try {
      const payload = {
        grant_value: grantValue,
        share_price: sharePrice,
        rsu_weight: rsuWeight,
        psu_weight: psuWeight,
        option_weight: optionWeight,
        option_term: optionTerm,
        risk_free_rate: riskFreeRate,
        dividend_yield: dividendYield,
        strike_price: strikePrice,
        psu_metric: psuConfig,
        company_growth_rate: companyGrowthRate,
        equity_risk_premium: equityRiskPremium,
        vesting_mode: vestingMode,
        vesting_term: vestingTerm,
        custom_schedule: vestingMode === 'custom_graded' ? customSchedule : undefined,
        n_simulations: 10_000,
        market_data: effectiveMarketData,
      }

      const res = await ltipApi.simulate(payload) as ResultsType
      setResults(res)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    } catch (e: any) {
      setError(e.message ?? 'Simulation failed.')
    } finally {
      setRunning(false)
    }
  }

  async function handleExport() {
    if (!results || !effectiveMarketData) return
    setExporting(true)
    try {
      await ltipApi.export({
        inputs: {
          grant_value: grantValue,
          share_price: sharePrice,
          rsu_weight: rsuWeight,
          psu_weight: psuWeight,
          option_weight: optionWeight,
          option_term: optionTerm,
          risk_free_rate: riskFreeRate,
          dividend_yield: dividendYield,
          strike_price: strikePrice,
          psu_metric: psuConfig,
          company_growth_rate: companyGrowthRate,
          equity_risk_premium: equityRiskPremium,
          vesting_mode: vestingMode,
          vesting_term: vestingTerm,
          custom_schedule: vestingMode === 'custom_graded' ? customSchedule : undefined,
          n_simulations: 10_000,
          market_data: effectiveMarketData,
        },
        results,
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setExporting(false)
    }
  }

  // In private mode, synthesise a minimal market_data object so the engine
  // can run without a real share-price upload. Peers are not needed when the
  // PSU mode is internal-metric-only.
  function buildPrivateMarketData(): MarketData {
    return {
      tickers: ['COMPANY'],
      annual_vol: { COMPANY: privateSigma },
      annual_return: { COMPANY: companyGrowthRate },
      corr_matrix: [[1.0]],
      n_trading_days: 0,
      validation_warnings: [],
      peer_names: {},
      peer_betas: {},
    }
  }

  const uploadedSigma = privateMode ? privateSigma : (marketData?.annual_vol['COMPANY'] ?? 0)
  const effectiveMarketData = privateMode ? buildPrivateMarketData() : marketData
  const isReady = privateMode || !!marketData

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.16em] text-orange font-semibold mb-1">Tools</p>
        <h1 className="text-[30px] leading-tight">LTIP Plan Design</h1>
      </div>

      {/* Private Company Mode toggle */}
      <div className="mb-6 p-4 rounded border border-lightgrey bg-white flex items-start gap-4">
        <button
          onClick={() => { setPrivateMode(p => !p); setResults(null) }}
          className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 overflow-hidden focus:outline-none mt-0.5 ${privateMode ? 'bg-orange' : 'bg-lightgrey'}`}
        >
          <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${privateMode ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-navy">Private Company Mode</span>
            {privateMode && <span className="text-xs bg-orange/10 text-orange font-semibold px-2 py-0.5 rounded">Active — no share data upload required</span>}
          </div>
          <p className="text-xs text-slate mt-0.5">
            For private companies without share price history. Enter a notional equity volatility (σ) directly — no Excel upload needed.
            Share price appreciation is still simulated using your μ (growth rate) and this σ.
          </p>
          {privateMode && (
            <div className="mt-3 flex items-center gap-3">
              <label className="text-xs font-semibold text-navy whitespace-nowrap">Notional Equity Volatility (σ)</label>
              <input type="range" min={1} max={80} step={1}
                value={Math.round(privateSigma * 100)}
                onChange={e => setPrivateSigma(parseFloat(e.target.value) / 100)}
                className="flex-1 accent-orange" />
              <span className="w-12 text-right text-navy font-bold text-sm">{Math.round(privateSigma * 100)}%</span>
            </div>
          )}
        </div>
      </div>

      {!privateMode && <ExcelUpload marketData={marketData} onUpload={setMarketData} />}

      {/* Gate: everything below is disabled until upload is done or private mode active */}
      <div className={`transition-all ${isReady ? 'opacity-100' : 'opacity-30 pointer-events-none select-none'}`}>
        {!isReady && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm font-medium">
            ⚠ Enable Private Company mode above, or upload your LTIP Excel template to unlock the inputs below.
          </div>
        )}

        <GrantSizing
          grantValue={grantValue}
          sharePrice={sharePrice}
          rsuWeight={rsuWeight}
          psuWeight={psuWeight}
          optionWeight={optionWeight}
          onChange={handleGrantChange}
        />

        <BlackScholes
          sharePrice={sharePrice}
          companySigma={uploadedSigma}
          optionTerm={optionTerm}
          riskFreeRate={riskFreeRate}
          dividendYield={dividendYield}
          strikePrice={strikePrice}
          onChange={handleBsChange}
          fairValuePct={results?.option_fair_value_pct ?? null}
        />

        <PsuCurveDesigner config={psuConfig} onChange={setPsuConfig} vestingTerm={vestingTerm} />

        {effectiveMarketData && (
          <SimulationParams
            marketData={effectiveMarketData}
            companyGrowthRate={companyGrowthRate}
            useHistoricalGrowth={useHistoricalGrowth}
            equityRiskPremium={equityRiskPremium}
            riskFreeRate={riskFreeRate}
            vestingMode={vestingMode}
            vestingTerm={vestingTerm}
            customSchedule={customSchedule}
            onChange={p => {
              if (p.companyGrowthRate   !== undefined) setCompanyGrowthRate(p.companyGrowthRate)
              if (p.useHistoricalGrowth !== undefined) setUseHistoricalGrowth(p.useHistoricalGrowth)
              if (p.equityRiskPremium   !== undefined) setEquityRiskPremium(p.equityRiskPremium)
              if (p.vestingMode         !== undefined) setVestingMode(p.vestingMode)
              if (p.vestingTerm         !== undefined) setVestingTerm(p.vestingTerm)
              if (p.customSchedule      !== undefined) setCustomSchedule(p.customSchedule)
            }}
          />
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* RUN button */}
        <button
          onClick={runSimulation}
          disabled={running || !isReady}
          className="w-full py-4 bg-orange text-white font-bold text-lg rounded
                     hover:bg-orange/90 active:scale-[0.99] transition-all
                     disabled:opacity-50 border border-gray300 shadow-orange/20
                     flex items-center justify-center gap-3"
        >
          {running ? (
            <>
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Running 10,000 Simulations…
            </>
          ) : (
            'RUN SCENARIO ANALYSIS'
          )}
        </button>
      </div>

      {/* Results */}
      {results && (
        <div ref={resultsRef} className="mt-16 pt-10 border-t-2 border-orange/20">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-1 w-8 bg-orange rounded" />
            <h2 className="text-2xl font-bold text-navy">Scenario Results</h2>
          </div>
          <LtipResults
            results={results}
            onExport={handleExport}
            exporting={exporting}
            optionTerm={optionTerm}
            vestingTerm={vestingTerm}
            optionWeight={optionWeight}
          />
        </div>
      )}
    </div>
  )
}
