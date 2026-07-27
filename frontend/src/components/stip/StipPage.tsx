import { useState, useRef } from 'react'
import { NumericInput } from '../shared/NumericInput'
import BaselineFinancials from './BaselineFinancials'
import PayoutCurveDesigner from './PayoutCurveDesigner'
import ScorecardBuilder from './ScorecardBuilder'
import CorrelationMatrix, { buildDefaultMatrix } from './CorrelationMatrix'
import PeerBenchmarking from './PeerBenchmarking'
import StipResults from './StipResults'
import ScenarioComparison from './ScenarioComparison'
import { stipApi } from '../../api/client'
import {
  CurveDesign, ScorecardMetric, PeerBenchmark, StipResults as ResultsType,
  Category, DEFAULT_CATEGORIES, ScenarioSnapshot, ScenarioPercentiles,
} from '../../types/stip'

const DEFAULT_SCENARIO_PERCENTILES: ScenarioPercentiles = { bear: 10, base: 50, bull: 90 }

const DEFAULT_CURVE: CurveDesign = {
  threshold_enabled: false,
  threshold_perf: 0.80,
  threshold_payout: 0.50,
  target_perf: 1.00,
  target_payout: 1.00,
  max_perf: 1.20,
  max_payout: 2.00,
}

const DEFAULT_PEER: PeerBenchmark = {
  median_pct: 0.55,
  p25_pct: 0.40,
  p75_pct: 0.70,
  data_source: 'Hugessen 2024 Survey',
}

export default function StipPage() {
  const [baseSalary, setBaseSalary] = useState(400_000)
  const [targetStipPct, setTargetStipPct] = useState(0.60)
  const [distribution, setDistribution] = useState<'lognormal' | 'normal'>('lognormal')
  const [curve, setCurve] = useState<CurveDesign>(DEFAULT_CURVE)
  const [metrics, setMetrics] = useState<ScorecardMetric[]>([])
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES)
  const [corrMatrix, setCorrMatrix] = useState<number[][]>([])
  const [peer, setPeer] = useState<PeerBenchmark>(DEFAULT_PEER)

  const [boardDiscretionPct, setBoardDiscretionPct] = useState(0)   // decimal, e.g. 0.15 = ±15%
  const [scenarioPercentiles, setScenarioPercentiles] = useState<ScenarioPercentiles>(DEFAULT_SCENARIO_PERCENTILES)

  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ResultsType | null>(null)
  const [exporting, setExporting] = useState(false)

  const [scenarios, setScenarios] = useState<ScenarioSnapshot[]>([])
  const scenarioRef = useRef<HTMLDivElement>(null)

  const resultsRef = useRef<HTMLDivElement>(null)

  // Keep correlation matrix in sync with metrics
  function handleMetricsChange(newMetrics: ScorecardMetric[]) {
    setMetrics(newMetrics)
    const newMatrix = buildDefaultMatrix(newMetrics)
    // Preserve existing values if dimensions match
    if (newMetrics.length === corrMatrix.length) {
      setCorrMatrix(corrMatrix)
    } else {
      setCorrMatrix(newMatrix)
    }
  }

  function handleBaselineChange(field: string, value: number | string) {
    if (field === 'base_salary')    setBaseSalary(value as number)
    if (field === 'target_stip_pct') setTargetStipPct(value as number)
    if (field === 'distribution')   setDistribution(value as 'lognormal' | 'normal')
  }

  function buildPayload(
    bs: number, tsp: number, dist: 'lognormal' | 'normal',
    c: typeof curve, mets: typeof metrics, corr: number[][],
    p: typeof peer, disc: number, sp: ScenarioPercentiles
  ) {
    return {
      base_salary: bs,
      target_stip_pct: tsp,
      distribution: dist,
      n_simulations: 10_000,
      curve_design: c,
      scorecard_metrics: mets.map(m => {
        const histActuals = m.historical_data && m.historical_data.length >= 2
          ? m.historical_data.filter(r => r.included).sort((a, b) => a.year - b.year).map(r => r.value)
          : (m.historical_actuals ?? null)
        return {
          name: m.name,
          category_type: m.category_type,
          weight: m.weight,
          budget_target: m.budget_target,
          volatility_sigma: m.volatility_sigma,
          distribution: m.distribution ?? null,
          metric_behavior: m.metric_behavior ?? 'continuous',
          metric_direction: m.metric_direction ?? 'higher',
          gate_probability: m.gate_probability ?? 0,
          milestone_outcomes: m.milestone_outcomes ?? null,
          curve: m.curve ?? null,
          simulation_mode: m.simulation_mode ?? 'relative',
          historical_actuals: histActuals && (histActuals as number[]).length >= 2 ? histActuals : null,
          eagr_sigma_override: m.eagr_sigma_override ?? null,
          eagr_g_override: m.eagr_g_override ?? null,
        }
      }),
      correlation_matrix: corr.length ? corr : buildDefaultMatrix(mets),
      peer_benchmark: p,
      board_discretion_pct: disc,
      scenario_percentiles: sp,
    }
  }

  async function saveScenario() {
    const totalWeight = metrics.reduce((s, m) => s + m.weight, 0)
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      setError(`Scorecard weights sum to ${(totalWeight * 100).toFixed(1)}%. Must equal 100%.`)
      return
    }
    if (metrics.length === 0) {
      setError('Add at least one scorecard metric before saving a scenario.')
      return
    }

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const name = `Scenario ${letters[scenarios.length % letters.length]}`
    const id = `${Date.now()}-${Math.random()}`

    const snap: ScenarioSnapshot = {
      id, name,
      inputs: {
        baseSalary, targetStipPct, distribution,
        curve: JSON.parse(JSON.stringify(curve)),
        metrics: JSON.parse(JSON.stringify(metrics)),
        corrMatrix: JSON.parse(JSON.stringify(corrMatrix)),
        peer: JSON.parse(JSON.stringify(peer)),
        boardDiscretionPct,
      },
      results: null, running: true, error: null,
    }

    setScenarios(prev => [...prev, snap])
    setTimeout(() => scenarioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)

    try {
      const payload = buildPayload(baseSalary, targetStipPct, distribution, curve, metrics, corrMatrix, peer, boardDiscretionPct, scenarioPercentiles)
      const res = await stipApi.simulate(payload) as ResultsType
      setScenarios(prev => prev.map(s => s.id === id ? { ...s, results: res, running: false } : s))
    } catch (e: any) {
      setScenarios(prev => prev.map(s => s.id === id ? { ...s, running: false, error: e.message ?? 'Failed' } : s))
    }
  }

  async function runSimulation() {
    setError(null)

    const totalWeight = metrics.reduce((s, m) => s + m.weight, 0)
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      setError(`Scorecard weights sum to ${(totalWeight * 100).toFixed(1)}%. Must equal 100%.`)
      return
    }
    if (metrics.length === 0) {
      setError('Add at least one scorecard metric before running.')
      return
    }

    setRunning(true)
    try {
      const payload = buildPayload(baseSalary, targetStipPct, distribution, curve, metrics, corrMatrix, peer, boardDiscretionPct, scenarioPercentiles)
      const res = await stipApi.simulate(payload) as ResultsType
      setResults(res)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    } catch (e: any) {
      setError(e.message ?? 'Simulation failed. Check inputs and try again.')
    } finally {
      setRunning(false)
    }
  }

  async function handleExport() {
    if (!results) return
    setExporting(true)
    try {
      await stipApi.export({
        inputs: {
          base_salary: baseSalary,
          target_stip_pct: targetStipPct,
          distribution,
          n_simulations: 10_000,
          curve_design: curve,
          scorecard_metrics: metrics.map(m => ({
            name: m.name,
            category_type: m.category_type,
            weight: m.weight,
            budget_target: m.budget_target,
            volatility_sigma: m.volatility_sigma,
            distribution: m.distribution ?? null,
            metric_behavior: m.metric_behavior ?? 'continuous',
            curve: m.curve ?? null,
            metric_direction: m.metric_direction ?? 'higher',
            simulation_mode: m.simulation_mode ?? 'relative',
            historical_actuals: m.historical_data
              ? m.historical_data.filter(r => r.included).sort((a, b) => a.year - b.year).map(r => r.value)
              : (m.historical_actuals ?? null),
            eagr_sigma_override: m.eagr_sigma_override ?? null,
            eagr_g_override: m.eagr_g_override ?? null,
            gate_probability: m.gate_probability ?? 0,
            milestone_outcomes: m.milestone_outcomes ?? null,
          })),
          correlation_matrix: corrMatrix,
          peer_benchmark: peer,
          board_discretion_pct: boardDiscretionPct,
          // Source from the results actually being exported, not live UI state —
          // guarantees the export labels match the numbers even if the user
          // tweaks the percentile inputs after running but before exporting.
          scenario_percentiles: results.scenario_percentiles,
        },
        results,
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.16em] text-orange font-semibold mb-1">Tools</p>
        <h1 className="text-[30px] leading-tight">STIP Plan Design</h1>
      </div>

      <BaselineFinancials
        baseSalary={baseSalary}
        targetStipPct={targetStipPct}
        distribution={distribution}
        scenarioPercentiles={scenarioPercentiles}
        onChange={handleBaselineChange}
        onPercentileChange={(field, value) => setScenarioPercentiles(prev => ({ ...prev, [field]: value }))}
      />

      <PayoutCurveDesigner curve={curve} onChange={setCurve} />

      <ScorecardBuilder
        metrics={metrics}
        categories={categories}
        globalDistribution={distribution}
        globalCurve={curve}
        onMetricsChange={handleMetricsChange}
        onCategoriesChange={setCategories}
      />

      <CorrelationMatrix
        metrics={metrics}
        matrix={corrMatrix.length ? corrMatrix : buildDefaultMatrix(metrics)}
        onChange={setCorrMatrix}
      />

      <PeerBenchmarking peer={peer} onChange={setPeer} />

      {/* Board Discretion Modifier */}
      <section className="mb-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-navy text-white text-sm font-bold flex items-center justify-center">6</div>
          <div>
            <h2 className="text-lg font-bold text-navy leading-tight">Board Discretion Modifier</h2>
            <p className="text-sm text-slate mt-0.5">
              The Compensation Committee can adjust the formula payout up or down by this percentage. Set to 0 to disable.
            </p>
          </div>
        </div>

        <div className="bg-white border border-lightgrey rounded p-5">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-navy mb-1">
                Maximum Discretionary Adjustment
              </label>
              <p className="text-xs text-slate mb-3">
                Applied last as a uniform ±X% multiplier on the formula result (e.g. 20% means
                the board can move the payout anywhere from −20% to +20% of what the scorecard produced).
                Floored at zero — discretion cannot create a negative payout.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0} max={50} step={5}
                  value={Math.round(boardDiscretionPct * 100)}
                  onChange={e => setBoardDiscretionPct(Number(e.target.value) / 100)}
                  className="flex-1 accent-orange h-2 cursor-pointer"
                />
                <div className="relative w-24">
                  <NumericInput
                    value={boardDiscretionPct}
                    scale={100}
                    min={0}
                    max={50}
                    placeholder="0"
                    onChange={v => setBoardDiscretionPct(v)}
                    className="w-full text-sm px-3 py-1.5 pr-7 border border-lightgrey rounded text-navy focus:outline-none focus:ring-2 focus:ring-orange text-right"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-slate pointer-events-none">%</span>
                </div>
              </div>
            </div>

            {/* Status chip */}
            <div className={`flex-shrink-0 px-3 py-2 rounded text-center min-w-[90px] ${
              boardDiscretionPct > 0 ? 'bg-orange/10 border border-orange/30' : 'bg-lightgrey/60 border border-lightgrey'
            }`}>
              <div className={`text-lg font-bold ${boardDiscretionPct > 0 ? 'text-orange' : 'text-slate'}`}>
                {boardDiscretionPct > 0 ? `±${Math.round(boardDiscretionPct * 100)}%` : 'Off'}
              </div>
              <div className="text-xs text-slate mt-0.5">discretion</div>
            </div>
          </div>

          {boardDiscretionPct > 0 && (
            <p className="mt-3 text-xs text-slate/70 bg-offwhite rounded px-3 py-2 border border-lightgrey">
              In each trial the simulation draws a uniform random adjustment between
              −{Math.round(boardDiscretionPct * 100)}% and +{Math.round(boardDiscretionPct * 100)}%
              and multiplies it against the formula payout. This widens the bear–bull range
              and slightly lowers the median vs. formula-only output.
            </p>
          )}
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* RUN button + Save as Scenario */}
      <div className="flex gap-3">
        <button
          onClick={runSimulation}
          disabled={running}
          className="flex-1 py-4 bg-orange text-white font-bold text-lg rounded
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

        <button
          onClick={saveScenario}
          disabled={running}
          title="Snapshot current inputs and run as a named scenario for side-by-side comparison"
          className="px-5 py-4 bg-navy text-white font-semibold rounded
                     hover:bg-navy/90 active:scale-[0.99] transition-all
                     disabled:opacity-50 flex items-center gap-2 text-sm whitespace-nowrap"
        >
          + Save as Scenario
        </button>
      </div>

      {/* Results section */}
      {results && (
        <div ref={resultsRef} className="mt-16 pt-10 border-t-2 border-orange/20">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-1 w-8 bg-orange rounded" />
            <h2 className="text-2xl font-bold text-navy">Scenario Results</h2>
          </div>
          <StipResults
            results={results}
            peer={peer}
            onExport={handleExport}
            exporting={exporting}
          />
        </div>
      )}

      {/* Scenario comparison */}
      {scenarios.length > 0 && (
        <div ref={scenarioRef}>
          <ScenarioComparison
            scenarios={scenarios}
            onRename={(id, name) => setScenarios(prev => prev.map(s => s.id === id ? { ...s, name } : s))}
            onRemove={(id) => setScenarios(prev => prev.filter(s => s.id !== id))}
          />
        </div>
      )}
    </div>
  )
}
