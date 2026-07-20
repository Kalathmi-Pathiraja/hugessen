import { useState, useCallback, useRef } from 'react'
import { BenchmarkData, CalculationResponse, PayMetric, SizeMetric } from '../../types/BenchmarkingTypes'
import { benchmarkingApi } from '../../api/client'
import BenchmarkUpload from './BenchmarkUpload'
import BenchmarkVerification from './BenchmarkVerification'
import RoleTabBar from './RoleTabBar'
import YearToggle from './YearToggle'
import RoleHangingChart from './RoleHangingChart'
import RegressionPanel from './RegressionPanel'
import YoYTrendChart from './YoYTrendChart'
import ExportButton from './ExportButton'

type Screen = 'upload' | 'verify' | 'charts' | 'regression' | 'yoy'
const PAY_METRICS: PayMetric[] = ['base', 'tcc', 'tdc', 'total_comp']

function defaultRole(roles: string[]): string {
  if (roles.includes('CEO')) return 'CEO'
  return roles[0] ?? ''
}

export default function BenchmarkingModule() {
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(null)
  const [currentScreen, setCurrentScreen] = useState<Screen>('upload')
  const [selectedRole, setSelectedRole] = useState('')
  const [selectedYear, setSelectedYear] = useState(0)
  const [sizeMetric, setSizeMetric] = useState<SizeMetric>('market_cap')
  const [analysisMetric, setAnalysisMetric] = useState<PayMetric>('tdc')
  const [viewMode, setViewMode] = useState<'raw' | 'adjusted'>('raw')
  const [appliedWeights, setAppliedWeights] = useState<Record<string, number>>({})
  const [calculationResults, setCalculationResults] = useState<Partial<Record<PayMetric, CalculationResponse>>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Monotonic request counter: every recalculation claims a new sequence
  // number, and only the response holding the latest number may commit state.
  // Without this, two quick selector clicks race — the older (slower) batch of
  // responses can land last and silently overwrite the newer weights and
  // percentiles, which looks exactly like "the selector does nothing".
  const calcSeqRef = useRef(0)

  const recalcAll = useCallback(async (
    data: BenchmarkData, role: string, year: number, size: SizeMetric, weights: Record<string, number>,
    seq?: number,
  ) => {
    const mySeq = seq ?? ++calcSeqRef.current
    setIsLoading(true)
    setError(null)
    try {
      const responses = await Promise.all(
        PAY_METRICS.map(metric =>
          benchmarkingApi.calculateBenchmarking({
            benchmark_data: data, role, year, pay_metric: metric, size_metric: size, peer_weights: weights,
          }).then(r => [metric, r] as const)
        )
      )
      if (calcSeqRef.current !== mySeq) return   // superseded by a newer request
      setCalculationResults(Object.fromEntries(responses))
    } catch (e: any) {
      if (calcSeqRef.current !== mySeq) return
      setError(e.message ?? 'Calculation failed.')
    } finally {
      if (calcSeqRef.current === mySeq) setIsLoading(false)
    }
  }, [])

  const refreshSuggestedAndCalc = useCallback(async (
    data: BenchmarkData, role: string, year: number, size: SizeMetric,
  ) => {
    const mySeq = ++calcSeqRef.current
    setIsLoading(true)
    setError(null)
    try {
      const suggested = await benchmarkingApi.suggestWeights({ benchmark_data: data, role, year, size_metric: size })
      if (calcSeqRef.current !== mySeq) return   // superseded by a newer request
      setAppliedWeights(suggested)
      await recalcAll(data, role, year, size, suggested, mySeq)
    } catch (e: any) {
      if (calcSeqRef.current !== mySeq) return
      setError(e.message ?? 'Could not compute peer weights.')
      setIsLoading(false)
    }
  }, [recalcAll])

  function handleUploadSuccess(data: BenchmarkData) {
    setBenchmarkData(data)
    setCurrentScreen('verify')
    const role = defaultRole(data.roles)
    setSelectedRole(role)
    setSelectedYear(data.default_year)
  }

  function handleRoleChange(role: string) {
    setSelectedRole(role)
    if (benchmarkData && currentScreen !== 'verify') {
      refreshSuggestedAndCalc(benchmarkData, role, selectedYear, sizeMetric)
    }
  }

  function handleYearChange(year: number) {
    setSelectedYear(year)
    if (benchmarkData && currentScreen !== 'verify') {
      refreshSuggestedAndCalc(benchmarkData, selectedRole, year, sizeMetric)
    }
  }

  function handleSizeMetricChange(size: SizeMetric) {
    setSizeMetric(size)
    if (benchmarkData) {
      refreshSuggestedAndCalc(benchmarkData, selectedRole, selectedYear, size)
    }
  }

  function handleProceedToCharts() {
    if (!benchmarkData) return
    setCurrentScreen('charts')
    refreshSuggestedAndCalc(benchmarkData, selectedRole, selectedYear, sizeMetric)
  }

  function handleApplyWeights(weights: Record<string, number>) {
    if (!benchmarkData) return
    setAppliedWeights(weights)
    recalcAll(benchmarkData, selectedRole, selectedYear, sizeMetric, weights)
  }

  function handleResetToSuggested() {
    if (!benchmarkData) return
    refreshSuggestedAndCalc(benchmarkData, selectedRole, selectedYear, sizeMetric)
  }

  if (currentScreen === 'upload' || !benchmarkData) {
    return <BenchmarkUpload onSuccess={handleUploadSuccess} />
  }

  if (currentScreen === 'verify') {
    return (
      <BenchmarkVerification
        data={benchmarkData}
        selectedRole={selectedRole}
        selectedYear={selectedYear}
        onRoleChange={setSelectedRole}
        onYearChange={setSelectedYear}
        onProceed={handleProceedToCharts}
      />
    )
  }

  const clientSizeRec = benchmarkData.peer_sizes.find(ps => ps.ticker === benchmarkData.client_ticker)
  const clientSize = clientSizeRec ? clientSizeRec[sizeMetric] : null

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <button onClick={() => setCurrentScreen('verify')} className="text-[12.5px] text-charcoal hover:text-navy mb-2 block">
            ← Back to Verification
          </button>
          <p className="text-[11px] uppercase tracking-[0.16em] text-orange font-semibold mb-1">Tools</p>
          <h1 className="text-[30px] leading-tight">Compensation Benchmarking</h1>
        </div>
        <ExportButton benchmarkData={benchmarkData} calculation={calculationResults[analysisMetric] ?? null} />
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
      )}

      <div className="mb-4 h-5 flex items-center gap-2 text-sm text-charcoal">
        {isLoading && (
          <>
            <span className="inline-block w-4 h-4 border-2 border-orange border-t-transparent rounded-full animate-spin" />
            Calculating…
          </>
        )}
      </div>

      <div className="bg-white border border-gray300 rounded px-[18px] py-3.5 flex items-center justify-between gap-6 mb-5">
        <RoleTabBar roles={benchmarkData.roles} selectedRole={selectedRole} onChange={handleRoleChange} />
        <YearToggle years={benchmarkData.available_years} selectedYear={selectedYear} onChange={handleYearChange} />
      </div>

      <div className="flex gap-7 border-b border-gray300 mb-5">
        {(['charts', 'regression', 'yoy'] as Screen[]).map(s => (
          <button
            key={s}
            onClick={() => setCurrentScreen(s)}
            className={`pb-2.5 text-[14px] font-semibold transition-colors border-b-[2.5px] -mb-px ${
              currentScreen === s ? 'text-navy border-orange' : 'text-charcoal border-transparent hover:text-navy'
            }`}
          >
            {s === 'charts' ? 'Hanging Bar Charts' : s === 'regression' ? 'Size-Adjusted Analysis' : 'YoY Trend'}
          </button>
        ))}
      </div>

      {currentScreen === 'charts' && (
        <div>
          <div className="flex bg-gray100 rounded p-[3px] gap-0.5 w-fit mb-5">
            {(['raw', 'adjusted'] as const).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                disabled={v === 'adjusted' && !Object.values(calculationResults).some(r => r?.regression.regression_valid)}
                className={`px-4 py-1.5 rounded text-[12.5px] font-semibold transition-colors disabled:opacity-40 ${
                  viewMode === v ? 'bg-navy text-white' : 'text-charcoal hover:text-navy'
                }`}
              >
                {v === 'raw' ? 'Raw Market' : 'Size-Adjusted'}
              </button>
            ))}
          </div>
          <RoleHangingChart results={calculationResults} weighted={viewMode === 'adjusted'} />
        </div>
      )}

      {currentScreen === 'yoy' && (
        <YoYTrendChart benchmarkData={benchmarkData} role={selectedRole} />
      )}

      {currentScreen === 'regression' && (
        <RegressionPanel
          results={calculationResults}
          analysisMetric={analysisMetric}
          onAnalysisMetricChange={setAnalysisMetric}
          sizeMetric={sizeMetric}
          onSizeMetricChange={handleSizeMetricChange}
          clientSize={clientSize}
          currency={benchmarkData.reporting_currency}
          onApplyWeights={handleApplyWeights}
          onResetToSuggested={handleResetToSuggested}
          applying={isLoading}
        />
      )}
    </div>
  )
}
