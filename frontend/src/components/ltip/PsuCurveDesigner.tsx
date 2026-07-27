import { useState, useEffect } from 'react'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Area, ResponsiveContainer
} from 'recharts'
import SectionHeader from '../shared/SectionHeader'
import { NumericInput } from '../shared/NumericInput'
import { PsuMetricConfig, PsuRtsrCurve, PsuInternalCurve, InternalPsuMetric, HistoricalActualRow, DEFAULT_INTERNAL_CURVE } from '../../types/ltip'
import { BRAND } from '../../constants/brand'

interface Props {
  config: PsuMetricConfig
  onChange: (config: PsuMetricConfig) => void
  vestingTerm?: number
}

function buildDefaultInternalCorr(n: number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => i === j ? 1.0 : 0.6)
  )
}

function calcRtsrMultiplierGap(gap: number, curve: PsuRtsrCurve): number {
  const { threshold_gap: tg, threshold_payout: tp, max_gap: mg, max_payout: mp } = curve
  if (gap < tg) return 0
  if (gap <= 0) {
    const denom = 0 - tg
    const slope = denom !== 0 ? (gap - tg) / denom : 1
    return (tp + slope * (1 - tp)) * 100
  }
  if (gap <= mg) {
    const slope = mg !== 0 ? gap / mg : 1
    return (1 + slope * (mp - 1)) * 100
  }
  return mp * 100
}

function calcRtsrMultiplierPct(pct: number, curve: PsuRtsrCurve): number {
  const { threshold_percentile: tp, threshold_payout: tPay,
          target_percentile: tgt, target_payout: tgtPay,
          max_percentile: mx, max_payout: mp } = curve
  if (pct < tp) return 0
  if (pct <= tgt) {
    const slope = tgt !== tp ? (pct - tp) / (tgt - tp) : 1
    return (tPay + slope * (tgtPay - tPay)) * 100
  }
  if (pct <= mx) {
    const slope = mx !== tgt ? (pct - tgt) / (mx - tgt) : 1
    return (tgtPay + slope * (mp - tgtPay)) * 100
  }
  return mp * 100
}

function buildRtsrCurveData(curve: PsuRtsrCurve, scoring: 'gap' | 'gap_median' | 'percentile_rank') {
  if (scoring === 'percentile_rank') {
    const points = []
    for (let x = 0; x <= 100; x++) {
      points.push({ x, y: parseFloat(calcRtsrMultiplierPct(x, curve).toFixed(2)) })
    }
    // Ghost point for vertical step at threshold
    const tIdx = points.findIndex(p => p.x === Math.ceil(curve.threshold_percentile))
    if (tIdx > 0 && points[tIdx].y > 0) {
      points.splice(tIdx, 0, { x: curve.threshold_percentile - 0.001, y: 0 })
    }
    return points
  }
  const { threshold_gap: tg, max_gap: mg } = curve
  const xMin = Math.min(tg - 10, -25)
  const xMax = Math.max(mg + 10, 25)
  const points = []
  for (let x = xMin; x <= xMax; x++) {
    points.push({ x, y: parseFloat(calcRtsrMultiplierGap(x, curve).toFixed(2)) })
  }
  const tIdx = points.findIndex(p => p.x === Math.ceil(tg))
  if (tIdx > 0 && points[tIdx].y > 0) {
    points.splice(tIdx, 0, { x: tg - 0.001, y: 0 })
  }
  return points
}

function RtsrTooltip({ active, payload, label, scoring }: any) {
  if (!active || !payload?.length) return null
  const payout = payload[0]?.value ?? 0
  return (
    <div className="bg-navy text-white px-3 py-2 rounded border border-gray300 text-xs">
      {scoring === 'percentile_rank'
        ? <div className="font-semibold">Percentile Rank: {label}th</div>
        : <div className="font-semibold">Gap: {Number(label) > 0 ? '+' : ''}{label}pp vs peers</div>}
      <div className="text-orange font-bold mt-0.5">PSU Payout: {payout.toFixed(1)}%</div>
    </div>
  )
}

export default function PsuCurveDesigner({ config, onChange, vestingTerm = 3 }: Props) {
  const update = (patch: Partial<PsuMetricConfig>) => onChange({ ...config, ...patch })
  const updateRtsr = (patch: Partial<PsuRtsrCurve>) => update({ rtsr_curve: { ...config.rtsr_curve, ...patch } })
  const scoring = config.rtsr_scoring ?? 'gap'

  const totalPsuWeight = Math.round((config.rtsr_weight + config.internal_weight) * 100)

  return (
    <section className="mb-8">
      <SectionHeader
        step={4}
        title="PSU Performance Curve"
        subtitle="PSUs pay out based on relative TSR vs. peer group, an internal metric, or a weighted blend of both."
      />

      {/* Mode selector */}
      <div className="flex gap-2 mb-6">
        {[
          { value: 'rtsr', label: 'Relative TSR Only' },
          { value: 'internal', label: 'Internal Metric Only' },
          { value: 'both', label: 'Both (Weighted)' },
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => update({ mode: opt.value as PsuMetricConfig['mode'] })}
            className={`px-4 py-2 rounded text-sm font-semibold border transition-all ${
              config.mode === opt.value
                ? 'bg-navy text-white border-navy'
                : 'bg-white text-slate border-lightgrey hover:border-navy'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Weighting slider — only when both */}
      {config.mode === 'both' && (
        <div className="mb-6 p-4 bg-offwhite rounded border border-lightgrey">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-navy">PSU Component Weighting</span>
            <span className={`text-sm font-bold ${totalPsuWeight === 100 ? 'text-green-700' : 'text-red-600'}`}>
              Total: {totalPsuWeight}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-xs text-slate mb-1">
                <span>rTSR Weight</span>
                <span className="font-bold text-navy">{Math.round(config.rtsr_weight * 100)}%</span>
              </div>
              <input
                type="range" min={0} max={100} step={5}
                value={Math.round(config.rtsr_weight * 100)}
                onChange={e => {
                  const v = parseFloat(e.target.value) / 100
                  update({ rtsr_weight: v, internal_weight: Math.max(0, 1 - v) })
                }}
                className="w-full accent-orange"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate mb-1">
                <span>Internal Metric Weight</span>
                <span className="font-bold text-navy">{Math.round(config.internal_weight * 100)}%</span>
              </div>
              <input
                type="range" min={0} max={100} step={5}
                value={Math.round(config.internal_weight * 100)}
                onChange={e => {
                  const v = parseFloat(e.target.value) / 100
                  update({ internal_weight: v, rtsr_weight: Math.max(0, 1 - v) })
                }}
                className="w-full accent-orange"
              />
            </div>
          </div>
        </div>
      )}

      {/* rTSR Curve */}
      {(config.mode === 'rtsr' || config.mode === 'both') && (
        <div className="mb-8">
          {config.mode === 'both' && (
            <h4 className="text-sm font-semibold text-navy mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange" />
              rTSR Component
            </h4>
          )}

          {/* Scoring method toggle */}
          <div className="flex flex-wrap gap-2 mb-4">
            {([
              { value: 'gap',            label: 'Gap vs Peer Mean (pp)' },
              { value: 'gap_median',     label: 'Gap vs Peer Median (pp)' },
              { value: 'percentile_rank', label: 'Percentile Rank' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => update({ rtsr_scoring: opt.value })}
                className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
                  scoring === opt.value
                    ? 'bg-navy text-white border-navy'
                    : 'bg-white text-slate border-lightgrey hover:border-navy'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {scoring === 'gap_median' && (
            <p className="text-xs text-slate mb-3 px-3 py-2 bg-offwhite rounded border border-lightgrey">
              <span className="font-semibold text-navy">Gap vs Peer Median</span> — compares the company's annualised TSR
              against the median peer return rather than the mean. More robust to outlier peers (one peer
              with an extreme return doesn't skew the benchmark). Uses the same gap-based payout curve below.
            </p>
          )}

          {/* rTSR Chart */}
          <div className="w-full h-80 bg-white rounded border border-lightgrey p-4 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={buildRtsrCurveData(config.rtsr_curve, scoring)}
                margin={{ top: 16, right: 24, left: 8, bottom: 24 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={BRAND.lightGrey} />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={scoring === 'percentile_rank' ? [0, 100] : ['auto', 'auto']}
                  tickFormatter={v => scoring === 'percentile_rank' ? `${v}th` : `${v > 0 ? '+' : ''}${v}pp`}
                  label={{ value: scoring === 'percentile_rank' ? 'Peer Group Percentile Rank' : scoring === 'gap_median' ? 'rTSR Gap vs Peer Median (pp)' : 'rTSR Gap vs Peer Mean (pp)', position: 'insideBottom', offset: -12, fill: BRAND.slate, fontSize: 11 }}
                  tick={{ fill: BRAND.slate, fontSize: 11 }}
                />
                <YAxis
                  domain={[0, Math.max(config.rtsr_curve.max_payout * 110, 210)]}
                  tickFormatter={v => `${v}%`}
                  label={{ value: 'PSU Payout (%)', angle: -90, position: 'insideLeft', offset: 12, fill: BRAND.slate, fontSize: 11 }}
                  tick={{ fill: BRAND.slate, fontSize: 11 }}
                />
                <Tooltip
                  content={<RtsrTooltip scoring={scoring} />}
                  cursor={{ stroke: BRAND.slate, strokeWidth: 1, strokeDasharray: '4 2' }}
                />
                <Area type="linear" dataKey="y" fill={BRAND.orange} fillOpacity={0.08} stroke="none" isAnimationActive={false} />
                <Line type="linear" dataKey="y" stroke={BRAND.orange} strokeWidth={3} dot={false} isAnimationActive={false} />
                {(scoring === 'gap' || scoring === 'gap_median') && (
                  <ReferenceLine x={0} stroke={BRAND.navy} strokeWidth={2}
                    label={{ value: 'Peer Parity (Target)', position: 'insideTopRight', fill: BRAND.navy, fontSize: 11, fontWeight: 600 }} />
                )}
                {scoring === 'percentile_rank' && (
                  <ReferenceLine x={config.rtsr_curve.target_percentile} stroke={BRAND.navy} strokeWidth={2}
                    label={{ value: `Target (${config.rtsr_curve.target_percentile}th pct)`, position: 'insideTopRight', fill: BRAND.navy, fontSize: 11, fontWeight: 600 }} />
                )}
                <ReferenceLine
                  x={scoring === 'percentile_rank' ? config.rtsr_curve.threshold_percentile : config.rtsr_curve.threshold_gap}
                  stroke={BRAND.slate} strokeWidth={1.5} strokeDasharray="6 4"
                  label={{ value: 'Threshold', position: 'insideTopRight', fill: BRAND.slate, fontSize: 10 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* rTSR inputs — swap between gap-based (gap, gap_median) and percentile_rank */}
          {scoring !== 'percentile_rank' ? (
            <div className="grid grid-cols-2 gap-4">
              <SliderPair
                label="Threshold"
                gapValue={config.rtsr_curve.threshold_gap}
                payoutValue={config.rtsr_curve.threshold_payout}
                gapMin={-30} gapMax={-1} gapStep={1}
                payoutMin={0} payoutMax={0.99} payoutStep={0.05}
                gapSuffix="pp"
                onGapChange={v => updateRtsr({ threshold_gap: v })}
                onPayoutChange={v => updateRtsr({ threshold_payout: v })}
              />
              <div className="p-4 rounded border border-lightgrey bg-offwhite">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-navy">Target (Peer Parity)</span>
                  <span className="text-xs text-slate bg-lightgrey px-2 py-0.5 rounded">Locked</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-xs text-slate">Gap</span><div className="font-bold text-navy">0 pp</div></div>
                  <div><span className="text-xs text-slate">Payout</span><div className="font-bold text-navy">100%</div></div>
                </div>
              </div>
              <SliderPair
                label="Maximum"
                gapValue={config.rtsr_curve.max_gap}
                payoutValue={config.rtsr_curve.max_payout}
                gapMin={1} gapMax={40} gapStep={1}
                payoutMin={1.0} payoutMax={3.0} payoutStep={0.1}
                gapSuffix="pp"
                onGapChange={v => updateRtsr({ max_gap: v })}
                onPayoutChange={v => updateRtsr({ max_payout: v })}
              />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <SliderPair
                label="Threshold"
                gapValue={config.rtsr_curve.threshold_percentile}
                payoutValue={config.rtsr_curve.threshold_payout}
                gapMin={0} gapMax={49} gapStep={1}
                payoutMin={0} payoutMax={0.99} payoutStep={0.05}
                gapSuffix="th pct"
                onGapChange={v => updateRtsr({ threshold_percentile: v })}
                onPayoutChange={v => updateRtsr({ threshold_payout: v })}
              />
              <SliderPair
                label="Target"
                gapValue={config.rtsr_curve.target_percentile}
                payoutValue={config.rtsr_curve.target_payout}
                gapMin={1} gapMax={99} gapStep={1}
                payoutMin={0.5} payoutMax={2.0} payoutStep={0.05}
                gapSuffix="th pct"
                onGapChange={v => updateRtsr({ target_percentile: v })}
                onPayoutChange={v => updateRtsr({ target_payout: v })}
              />
              <SliderPair
                label="Maximum"
                gapValue={config.rtsr_curve.max_percentile}
                payoutValue={config.rtsr_curve.max_payout}
                gapMin={50} gapMax={100} gapStep={1}
                payoutMin={1.0} payoutMax={3.0} payoutStep={0.1}
                gapSuffix="th pct"
                onGapChange={v => updateRtsr({ max_percentile: v })}
                onPayoutChange={v => updateRtsr({ max_payout: v })}
              />
            </div>
          )}
        </div>
      )}

      {/* Internal metric list */}
      {(config.mode === 'internal' || config.mode === 'both') && (
        <InternalMetricList
          metrics={config.internal_metrics}
          corrMatrix={config.internal_correlation_matrix ?? []}
          onMetricsChange={m => update({ internal_metrics: m })}
          onCorrChange={c => update({ internal_correlation_matrix: c })}
          onBothChange={(m, c) => onChange({ ...config, internal_metrics: m, internal_correlation_matrix: c })}
          showHeader={config.mode === 'both'}
          vestingTerm={vestingTerm}
        />
      )}
    </section>
  )
}

// ── Internal metric list (multi-metric, each with its own curve) ─────────────

function defaultInternalMetric(idx: number): InternalPsuMetric {
  return {
    id: `${Date.now()}-${Math.random()}`,
    name: idx === 0 ? 'ROIC' : 'EBITDA CAGR',
    weight: 1.0,
    volatility_sigma: 0.10,
    distribution: 'lognormal',
    curve: { ...DEFAULT_INTERNAL_CURVE },
    simulation_mode: 'relative',
    historical_actuals: [],
    budget_target: 0,
    eagr_sigma_override: undefined,
  }
}

function calcInternalMultiplier(ach: number, c: PsuInternalCurve): number {
  const tPerf = c.threshold_enabled ? c.threshold_perf : 0
  const tPay  = c.threshold_enabled ? c.threshold_payout : 0
  if (ach < tPerf) return 0
  if (ach <= c.target_perf) {
    const d = c.target_perf - tPerf
    return d === 0 ? tPay : tPay + ((ach - tPerf) / d) * (c.target_payout - tPay)
  }
  if (ach <= c.max_perf) {
    const d = c.max_perf - c.target_perf
    return d === 0 ? c.target_payout : c.target_payout + ((ach - c.target_perf) / d) * (c.max_payout - c.target_payout)
  }
  return c.max_payout
}

function buildInternalCurveData(c: PsuInternalCurve) {
  const tPerf = c.threshold_enabled ? c.threshold_perf * 100 : 0
  const xMax  = Math.max(c.max_perf * 100 * 1.3, 150)

  // Use key breakpoints as explicit anchors so the curve is always exact
  const anchors = new Set([0, tPerf - 0.001, tPerf, 100, c.max_perf * 100, xMax])
  for (let x = 0; x <= xMax; x += 1) anchors.add(x)

  return Array.from(anchors)
    .filter(x => x >= 0 && x <= xMax)
    .sort((a, b) => a - b)
    .map(x => ({ x: parseFloat(x.toFixed(3)), y: parseFloat((calcInternalMultiplier(x / 100, c) * 100).toFixed(2)) }))
}

function InternalTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-navy text-white px-3 py-2 rounded border border-gray300 text-xs">
      <div className="font-semibold">Achievement: {Number(label).toFixed(0)}%</div>
      <div className="text-orange font-bold mt-0.5">PSU Payout: {Number(payload[0]?.value ?? 0).toFixed(1)}%</div>
    </div>
  )
}

function InternalCurvePanel({ curve, onChange }: { curve: PsuInternalCurve; onChange: (c: PsuInternalCurve) => void }) {
  const upd = (p: Partial<PsuInternalCurve>) => onChange({ ...curve, ...p })
  const data = buildInternalCurveData(curve)
  const yMax = Math.ceil(curve.max_payout * 100 * 1.15 / 50) * 50

  return (
    <div className="mt-3 border-t border-lightgrey pt-4">

      {/* Threshold toggle — matches STIP style */}
      <div className="flex items-center gap-4 mb-4 p-3 bg-offwhite rounded border border-lightgrey">
        <button
          type="button"
          role="switch"
          onClick={() => upd({ threshold_enabled: !curve.threshold_enabled })}
          className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 overflow-hidden focus:outline-none ${curve.threshold_enabled ? 'bg-orange' : 'bg-lightgrey'}`}
        >
          <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${curve.threshold_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
        <div>
          <span className="text-sm font-semibold text-navy">Zero-Pay Floor (Threshold)</span>
          <p className="text-xs text-slate mt-0.5">
            {curve.threshold_enabled
              ? 'Payout drops to $0 if achievement falls below threshold — shown as a dotted line.'
              : 'No floor — payout ramps from 0% achievement.'}
          </p>
        </div>
      </div>

      {/* Chart — matches STIP h-96 / styling exactly */}
      <div className="w-full h-80 mb-6 bg-white rounded border border-lightgrey p-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 20, right: 28, left: 12, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={BRAND.lightGrey} />
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, Math.max(curve.max_perf * 100 * 1.3, 150)]}
              tickFormatter={v => `${Math.round(v)}%`}
              label={{ value: 'Achievement % of Target', position: 'insideBottom', offset: -16, fill: BRAND.slate, fontSize: 12 }}
              tick={{ fill: BRAND.slate, fontSize: 11 }}
            />
            <YAxis
              domain={[0, yMax]}
              tickFormatter={v => `${v}%`}
              label={{ value: 'Payout Multiplier (%)', angle: -90, position: 'insideLeft', offset: 4, fill: BRAND.slate, fontSize: 12 }}
              tick={{ fill: BRAND.slate, fontSize: 11 }}
            />
            <Tooltip
              content={<InternalTooltip />}
              cursor={{ stroke: BRAND.slate, strokeWidth: 1, strokeDasharray: '4 2' }}
            />
            <Area type="linear" dataKey="y" fill={BRAND.orange} fillOpacity={0.08} stroke="none" isAnimationActive={false} />
            <Line type="linear" dataKey="y" stroke={BRAND.orange} strokeWidth={2.5} dot={false}
              activeDot={{ r: 5, fill: BRAND.orange, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
            <ReferenceLine x={100} stroke={BRAND.navy} strokeWidth={2}
              label={{ value: '100% Target', position: 'top', fill: BRAND.navy, fontSize: 11, fontWeight: 600 }} />
            {curve.threshold_enabled && (
              <ReferenceLine x={curve.threshold_perf * 100} stroke={BRAND.slate} strokeWidth={1.5} strokeDasharray="6 4"
                label={{ value: 'Threshold', position: 'top', fill: BRAND.slate, fontSize: 10 }} />
            )}
            <ReferenceLine x={curve.max_perf * 100} stroke={BRAND.navy} strokeWidth={1} strokeDasharray="4 3" opacity={0.5}
              label={{ value: 'Cap', position: 'top', fill: BRAND.slate, fontSize: 10 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Slider controls — matches STIP SliderRow layout */}
      <div className="grid grid-cols-1 gap-3">
        {curve.threshold_enabled && (
          <InternalSliderRow label="Threshold — Zero-Pay Floor"
            perfValue={curve.threshold_perf} payValue={curve.threshold_payout}
            perfMin={0} perfMax={0.99} payMin={0} payMax={0.99}
            onPerfChange={v => upd({ threshold_perf: Math.min(v, curve.target_perf - 0.01) })}
            onPayChange={v => upd({ threshold_payout: v })} />
        )}
        <div className="p-4 rounded border border-lightgrey bg-offwhite">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-navy">Target — 100% achievement → 100% payout</span>
            <span className="text-xs text-slate bg-lightgrey px-2 py-0.5 rounded">Locked</span>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="text-navy font-bold text-lg">100%</div>
            <div className="text-navy font-bold text-lg">100%</div>
          </div>
        </div>
        <InternalSliderRow label="Maximum — Performance cap and payout cap"
          perfValue={curve.max_perf} payValue={curve.max_payout}
          perfMin={1.01} perfMax={3.0} payMin={1.0} payMax={3.0}
          onPerfChange={v => upd({ max_perf: Math.max(v, curve.target_perf + 0.01) })}
          onPayChange={v => upd({ max_payout: v })} />
      </div>
    </div>
  )
}

function InternalSliderRow({ label, perfValue, payValue, perfMin, perfMax, payMin, payMax, onPerfChange, onPayChange }: {
  label: string; perfValue: number; payValue: number
  perfMin: number; perfMax: number; payMin: number; payMax: number
  onPerfChange: (v: number) => void; onPayChange: (v: number) => void
}) {
  return (
    <div className="p-4 rounded border border-lightgrey bg-white">
      <span className="text-sm font-semibold text-navy block mb-3">{label}</span>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate mb-1 block">Achievement (%)</label>
          <div className="flex items-center gap-2">
            <input type="range" min={perfMin * 100} max={perfMax * 100} step={1}
              value={Math.round(perfValue * 100)}
              onChange={e => onPerfChange(parseFloat(e.target.value) / 100)}
              className="flex-1 accent-orange" />
            <span className="w-12 text-right text-navy font-semibold text-sm">{Math.round(perfValue * 100)}%</span>
          </div>
        </div>
        <div>
          <label className="text-xs text-slate mb-1 block">Payout (%)</label>
          <div className="flex items-center gap-2">
            <input type="range" min={payMin * 100} max={payMax * 100} step={1}
              value={Math.round(payValue * 100)}
              onChange={e => onPayChange(parseFloat(e.target.value) / 100)}
              className="flex-1 accent-orange" />
            <span className="w-12 text-right text-navy font-semibold text-sm">{Math.round(payValue * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── PSU Target Difficulty Panel (mirrors STIP TargetDifficultyPanel) ─────────
function PsuTargetDifficultyPanel({
  mode, historicalData, budgetTarget, sigmaOverride, vestingTerm,
  onModeChange, onDataChange, onBudgetChange, onSigmaOverrideChange,
}: {
  mode: 'relative' | 'target_difficulty'
  historicalData: HistoricalActualRow[]
  budgetTarget: number
  sigmaOverride?: number
  vestingTerm: number
  onModeChange: (m: 'relative' | 'target_difficulty') => void
  onDataChange: (d: HistoricalActualRow[]) => void
  onBudgetChange: (v: number) => void
  onSigmaOverrideChange: (s: number | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const isActive = mode === 'target_difficulty'
  const [sigmaStr, setSigmaStr] = useState(
    sigmaOverride != null ? (sigmaOverride * 100).toFixed(1) : ''
  )
  const currentYear = new Date().getFullYear()

  useEffect(() => { if (mode === 'target_difficulty') setOpen(true) }, [mode])

  function addRow() {
    const lastYear = historicalData.length > 0
      ? Math.max(...historicalData.map(r => r.year))
      : currentYear - 1
    onDataChange([...historicalData, { year: lastYear + 1, value: 0, included: true }])
  }
  function removeRow(idx: number) { onDataChange(historicalData.filter((_, i) => i !== idx)) }
  function updateRow(idx: number, patch: Partial<HistoricalActualRow>) {
    onDataChange(historicalData.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }
  function applyLookback(n: number | 'all') {
    const sorted = [...historicalData].sort((a, b) => a.year - b.year)
    const cutoff = n === 'all' ? 0 : sorted.length - n
    onDataChange(sorted.map((r, i) => ({ ...r, included: i >= cutoff })))
  }

  const included = [...historicalData]
    .filter(r => r.included && r.value !== 0)
    .sort((a, b) => a.year - b.year)
  const includedValues = included.map(r => r.value)

  let inferredG: number | null = null
  let inferredSigma: number | null = null
  let impliedAch: number | null = null
  if (includedValues.length >= 2) {
    const yoy = includedValues.slice(1).map((v, i) => (v - includedValues[i]) / Math.abs(includedValues[i]))
    inferredG = yoy.reduce((a, b) => a + b, 0) / yoy.length
    const mean = inferredG
    inferredSigma = Math.sqrt(yoy.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(yoy.length - 1, 1))
    const X0 = includedValues[includedValues.length - 1]
    const T = vestingTerm
    impliedAch = budgetTarget > 0 ? (X0 + X0 * inferredG * T) / budgetTarget : null
  }

  const includedCount = included.length
  const includedYears = included.length >= 2
    ? `${included[0].year}–${included[included.length - 1].year}` : ''

  return (
    <div className="border-t border-lightgrey">
      <div
        role="button" tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate hover:text-navy transition-colors cursor-pointer select-none"
      >
        <span className="flex items-center gap-2">
          <span className={`transition-transform inline-block ${open ? 'rotate-90' : ''}`}>▶</span>
          <span className="font-medium">
            Simulation Mode
            {isActive && includedCount >= 2 && (
              <span className="ml-2 text-teal-600 font-semibold">
                ● Target Difficulty (EAGR) — {includedCount} pts {includedYears}
              </span>
            )}
            {isActive && includedCount < 2 && (
              <span className="ml-2 text-red-500 font-semibold">⚠ Target Difficulty — add historical data below</span>
            )}
            {!isActive && <span className="ml-2 text-slate/60">Relative (σ centred at target)</span>}
          </span>
        </span>
      </div>

      {open && (
        <div className="px-3 pb-4 bg-offwhite/50 space-y-3">
          {/* Mode toggle */}
          <div className="flex gap-2">
            {(['relative', 'target_difficulty'] as const).map(opt => (
              <button key={opt} onClick={() => onModeChange(opt)}
                className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
                  mode === opt ? 'bg-navy text-white border-navy' : 'bg-white text-slate border-lightgrey hover:border-navy'
                }`}
              >
                {opt === 'relative' ? 'Relative' : 'Test Target Difficulty'}
              </button>
            ))}
          </div>

          {isActive && (
            <div className="space-y-3">
              {/* Budget target */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate font-medium w-32">Budget / Target value</span>
                <input
                  type="number" step="any"
                  value={budgetTarget === 0 ? '' : budgetTarget}
                  placeholder="e.g. 1 250 000"
                  onChange={e => onBudgetChange(parseFloat(e.target.value) || 0)}
                  className="w-44 text-xs px-2 py-1.5 border border-lightgrey rounded text-navy focus:outline-none focus:ring-1 focus:ring-orange font-mono"
                />
                <span className="text-xs text-slate">(same units as actuals)</span>
              </div>

              {/* Historical data table */}
              <div className="bg-white rounded border border-lightgrey overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-navy/5 border-b border-lightgrey">
                  <span className="text-xs font-semibold text-navy">Historical Actuals</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate">Lookback:</span>
                    {(['all', 3, 5, 7] as const).map(n => (
                      <button key={n} onClick={() => applyLookback(n)}
                        className="px-2 py-0.5 text-xs rounded border border-lightgrey bg-white hover:border-orange hover:text-orange transition-colors">
                        {n === 'all' ? 'All' : `${n}yr`}
                      </button>
                    ))}
                    <button onClick={addRow}
                      className="ml-1 px-2 py-0.5 text-xs rounded bg-orange text-white font-semibold hover:bg-orange/90 transition-colors">
                      + Add Row
                    </button>
                  </div>
                </div>

                {historicalData.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-slate italic">
                    No data yet — click "+ Add Row" to start
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-12 gap-1 px-3 py-1.5 border-b border-lightgrey bg-offwhite/60 text-xs text-slate font-medium">
                      <div className="col-span-3">Year</div>
                      <div className="col-span-5">Value</div>
                      <div className="col-span-3 text-center">Use in calc</div>
                      <div className="col-span-1" />
                    </div>
                    {historicalData.map((row, idx) => (
                      <div key={idx} className={`grid grid-cols-12 gap-1 px-3 py-1 items-center border-b border-lightgrey/50 last:border-0 ${row.included ? 'bg-white' : 'bg-slate/5'}`}>
                        <div className="col-span-3">
                          <input type="number" min={1990} max={2100} step={1}
                            value={row.year}
                            onChange={e => updateRow(idx, { year: parseInt(e.target.value) || row.year })}
                            className="w-full text-xs px-2 py-1 border border-lightgrey rounded text-navy focus:outline-none focus:ring-1 focus:ring-orange"
                          />
                        </div>
                        <div className="col-span-5">
                          <input type="number" step="any"
                            value={row.value === 0 ? '' : row.value}
                            placeholder="0"
                            onChange={e => updateRow(idx, { value: parseFloat(e.target.value) || 0 })}
                            className="w-full text-xs px-2 py-1 border border-lightgrey rounded text-navy focus:outline-none focus:ring-1 focus:ring-orange font-mono"
                          />
                        </div>
                        <div className="col-span-3 flex justify-center">
                          <input type="checkbox" checked={row.included}
                            onChange={e => updateRow(idx, { included: e.target.checked })}
                            className="accent-orange w-4 h-4"
                          />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <button onClick={() => removeRow(idx)}
                            className="text-slate hover:text-red-500 transition-colors text-base leading-none">×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {historicalData.length > 0 && (
                  <div className="px-3 py-1.5 bg-offwhite/60 border-t border-lightgrey text-xs text-slate">
                    {includedCount} of {historicalData.length} rows included{includedYears ? ` (${includedYears})` : ''}
                  </div>
                )}
              </div>

              {/* Inferred parameters */}
              {includedCount >= 2 && inferredG !== null && inferredSigma !== null && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-white rounded border border-lightgrey text-center">
                    <div className="text-xs text-slate">Inferred growth (g)</div>
                    <div className="text-sm font-bold text-navy">{(inferredG * 100).toFixed(1)}%/yr</div>
                    <div className="text-xs text-slate/60">{includedYears}</div>
                  </div>
                  <div className="p-2 bg-white rounded border border-lightgrey text-center">
                    <div className="text-xs text-slate">Inferred volatility (σ)</div>
                    <div className="text-sm font-bold text-navy">{(inferredSigma * 100).toFixed(1)}%</div>
                    {sigmaOverride == null && (
                      <button
                        onClick={() => { setSigmaStr((inferredSigma! * 100).toFixed(1)); onSigmaOverrideChange(inferredSigma!) }}
                        className="text-xs text-orange hover:underline"
                      >Override →</button>
                    )}
                  </div>
                  <div className={`p-2 rounded border text-center ${
                    impliedAch !== null && impliedAch >= 1.0 ? 'bg-green-50 border-green-200'
                      : impliedAch !== null && impliedAch >= 0.85 ? 'bg-orange/10 border-orange/30'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="text-xs text-slate">Expected vs target</div>
                    <div className={`text-sm font-bold ${
                      impliedAch !== null && impliedAch >= 1.0 ? 'text-green-700'
                        : impliedAch !== null && impliedAch >= 0.85 ? 'text-orange'
                        : 'text-red-600'
                    }`}>
                      {impliedAch !== null ? `${(impliedAch * 100).toFixed(0)}% of target` : '—'}
                    </div>
                  </div>
                </div>
              )}
              {includedCount < 2 && (
                <p className="text-xs text-slate italic">Include at least 2 rows to infer parameters.</p>
              )}

              {/* σ override */}
              <div className="p-2.5 rounded border border-lightgrey bg-white">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-navy">Forecasted Volatility (σ)</span>
                  {sigmaOverride != null && (
                    <button onClick={() => { setSigmaStr(''); onSigmaOverrideChange(undefined) }}
                      className="text-xs text-red-400 hover:text-red-600">Clear override</button>
                  )}
                </div>
                {sigmaOverride == null ? (
                  <p className="text-xs text-slate/70">
                    Using inferred σ{inferredSigma != null ? ` (${(inferredSigma * 100).toFixed(1)}%)` : ''}
                    {' '}from included rows. Click "Override →" above to customise.
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    <input type="range" min={1} max={100} step={0.5}
                      value={Math.round(sigmaOverride * 1000) / 10}
                      onChange={e => { const v = +e.target.value / 100; setSigmaStr((v * 100).toFixed(1)); onSigmaOverrideChange(v) }}
                      className="flex-1 accent-orange"
                    />
                    <div className="relative w-20">
                      <input type="text" value={sigmaStr}
                        onChange={e => { setSigmaStr(e.target.value); const nv = parseFloat(e.target.value); if (!isNaN(nv) && nv > 0 && nv <= 100) onSigmaOverrideChange(nv / 100) }}
                        onBlur={() => { if (sigmaOverride != null) setSigmaStr((sigmaOverride * 100).toFixed(1)) }}
                        className="w-full text-xs px-2 py-1.5 pr-5 border border-orange rounded text-navy focus:outline-none focus:ring-1 focus:ring-orange"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate">%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InternalMetricList({ metrics, corrMatrix, onMetricsChange, onCorrChange, onBothChange, showHeader, vestingTerm = 3 }: {
  metrics: InternalPsuMetric[]
  corrMatrix: number[][]
  onMetricsChange: (m: InternalPsuMetric[]) => void
  onCorrChange: (c: number[][]) => void
  onBothChange: (m: InternalPsuMetric[], c: number[][]) => void
  showHeader: boolean
  vestingTerm?: number
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const totalWeight = Math.round(metrics.reduce((s, m) => s + m.weight, 0) * 100)
  const effectiveCorr = corrMatrix.length === metrics.length ? corrMatrix : buildDefaultInternalCorr(metrics.length)

  function addMetric() {
    const m = defaultInternalMetric(metrics.length)
    const n = metrics.length + 1
    const newMetrics = [...metrics.map(x => ({ ...x, weight: 1 / n })), { ...m, weight: 1 / n }]
    onBothChange(newMetrics, buildDefaultInternalCorr(n))
    setExpandedId(m.id)
  }

  function removeMetric(id: string) {
    const remaining = metrics.filter(m => m.id !== id)
    if (remaining.length === 0) return
    const total = remaining.reduce((s, m) => s + m.weight, 0) || 1
    const newMetrics = remaining.map(m => ({ ...m, weight: m.weight / total }))
    onBothChange(newMetrics, buildDefaultInternalCorr(remaining.length))
  }

  function updateMetric(id: string, patch: Partial<InternalPsuMetric>) {
    onMetricsChange(metrics.map(m => m.id === id ? { ...m, ...patch } : m))
  }

  function updateCorr(i: number, j: number, val: number) {
    const next = effectiveCorr.map(row => [...row])
    next[i][j] = val
    next[j][i] = val
    onCorrChange(next)
  }

  return (
    <div className="mt-6 p-5 bg-offwhite rounded border border-lightgrey">
      {showHeader && (
        <h4 className="text-sm font-semibold text-navy mb-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-navy" />
          Internal Metric Component
        </h4>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate font-medium">
            {metrics.length} metric{metrics.length !== 1 ? 's' : ''}
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${totalWeight === 100 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            Weights: {totalWeight}%
          </span>
        </div>
        <button
          onClick={addMetric}
          className="px-3 py-1.5 bg-orange text-white text-xs font-semibold rounded hover:bg-orange/90"
        >
          + Add Metric
        </button>
      </div>

      {metrics.length === 0 && (
        <div className="text-xs text-slate italic py-4 text-center">
          No internal metrics yet — click "+ Add Metric" to start.
        </div>
      )}

      <div className="space-y-3">
        {metrics.map((m, idx) => {
          const expanded = expandedId === m.id
          return (
            <div key={m.id} className="bg-white rounded border border-lightgrey overflow-hidden">
              {/* Header row */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Name */}
                <input
                  type="text"
                  value={m.name}
                  onChange={e => updateMetric(m.id, { name: e.target.value })}
                  placeholder="Metric name"
                  className="flex-1 text-sm font-semibold text-navy bg-transparent border-b border-lightgrey focus:outline-none focus:border-orange"
                />

                {/* Weight */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <NumericInput
                    value={m.weight}
                    scale={100}
                    min={1}
                    max={100}
                    onChange={v => updateMetric(m.id, { weight: v })}
                    className="w-16 text-xs px-2 py-1 border border-lightgrey rounded text-navy text-right focus:outline-none focus:ring-1 focus:ring-orange"
                  />
                  <span className="text-xs text-slate">%</span>
                </div>

                {/* σ */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs text-slate">σ</span>
                  <NumericInput
                    value={m.volatility_sigma}
                    scale={100}
                    min={1}
                    max={100}
                    onChange={v => updateMetric(m.id, { volatility_sigma: v })}
                    className="w-16 text-xs px-2 py-1 border border-lightgrey rounded text-navy text-right focus:outline-none focus:ring-1 focus:ring-orange"
                  />
                  <span className="text-xs text-slate">%</span>
                </div>

                {/* Distribution */}
                <div className="flex rounded border border-lightgrey overflow-hidden flex-shrink-0">
                  {(['lognormal', 'normal'] as const).map(d => (
                    <button key={d} onClick={() => updateMetric(m.id, { distribution: d })}
                      className={`px-2 py-1 text-xs font-medium transition-colors ${m.distribution === d ? 'bg-navy text-white' : 'bg-white text-slate hover:bg-offwhite'}`}>
                      {d === 'lognormal' ? 'LN' : 'N'}
                    </button>
                  ))}
                </div>

                {/* Curve toggle */}
                <button
                  onClick={() => setExpandedId(expanded ? null : m.id)}
                  className="text-xs font-medium text-orange hover:text-orange/80 flex-shrink-0"
                >
                  {expanded ? '▲ Curve' : '▶ Curve'}
                </button>

                {/* Delete */}
                {metrics.length > 1 && (
                  <button onClick={() => removeMetric(m.id)}
                    className="text-slate/40 hover:text-red-500 transition-colors text-base leading-none flex-shrink-0">
                    ×
                  </button>
                )}
              </div>

              {/* Expanded curve */}
              {expanded && (
                <div className="border-t border-lightgrey/60">
                  <div className="px-4 pt-2 pb-4">
                    <InternalCurvePanel
                      curve={m.curve}
                      onChange={c => updateMetric(m.id, { curve: c })}
                    />
                  </div>
                  <PsuTargetDifficultyPanel
                    mode={m.simulation_mode ?? 'relative'}
                    historicalData={m.historical_actuals ?? []}
                    budgetTarget={m.budget_target ?? 0}
                    sigmaOverride={m.eagr_sigma_override}
                    vestingTerm={vestingTerm}
                    onModeChange={v => updateMetric(m.id, { simulation_mode: v })}
                    onDataChange={d => updateMetric(m.id, { historical_actuals: d })}
                    onBudgetChange={v => updateMetric(m.id, { budget_target: v })}
                    onSigmaOverrideChange={s => updateMetric(m.id, { eagr_sigma_override: s })}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Correlation matrix — only shown when ≥2 metrics */}
      {metrics.length >= 2 && (
        <div className="mt-4 pt-4 border-t border-lightgrey">
          <div className="mb-2">
            <span className="text-xs font-semibold text-navy">Internal Metric Correlations</span>
            <p className="text-xs text-slate mt-0.5">
              How much do these metrics move together? 1.0 = perfectly correlated, 0 = independent.
              Default 0.60 reflects that financial metrics are typically driven by the same business cycle.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="w-24" />
                  {metrics.map(m => (
                    <th key={m.id} className="px-2 py-1 text-center text-slate font-medium max-w-[80px] truncate"
                      title={m.name}>{m.name.length > 8 ? m.name.slice(0, 8) + '…' : m.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map((mi, i) => (
                  <tr key={mi.id}>
                    <td className="pr-2 py-1 text-right text-slate font-medium truncate max-w-[96px]"
                      title={mi.name}>{mi.name.length > 10 ? mi.name.slice(0, 10) + '…' : mi.name}</td>
                    {metrics.map((mj, j) => (
                      <td key={mj.id} className="px-1 py-1 text-center">
                        {i === j ? (
                          <span className="inline-block w-16 text-center text-navy font-bold bg-navy/5 rounded py-1">1.00</span>
                        ) : j > i ? (
                          <input
                            type="number" min={-1} max={1} step={0.05}
                            value={effectiveCorr[i]?.[j] ?? 0.6}
                            onChange={e => updateCorr(i, j, Math.min(1, Math.max(-1, parseFloat(e.target.value) || 0)))}
                            className="w-16 text-center text-xs px-1 py-1 border border-lightgrey rounded text-navy focus:outline-none focus:ring-1 focus:ring-orange"
                          />
                        ) : (
                          <span className="inline-block w-16 text-center text-slate/60 bg-offwhite rounded py-1">
                            {(effectiveCorr[i]?.[j] ?? 0.6).toFixed(2)}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function SliderPair({ label, gapValue, payoutValue, gapMin, gapMax, gapStep, payoutMin, payoutMax, payoutStep, gapSuffix, onGapChange, onPayoutChange }: {
  label: string; gapValue: number; payoutValue: number
  gapMin: number; gapMax: number; gapStep: number
  payoutMin: number; payoutMax: number; payoutStep: number
  gapSuffix: string
  onGapChange: (v: number) => void; onPayoutChange: (v: number) => void
}) {
  return (
    <div className="p-4 rounded border border-lightgrey bg-white">
      <span className="text-sm font-semibold text-navy block mb-3">{label}</span>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate mb-1 block">Gap ({gapSuffix})</label>
          <div className="flex items-center gap-2">
            <input type="range" min={gapMin} max={gapMax} step={1}
              value={gapValue} onChange={e => onGapChange(parseFloat(e.target.value))}
              className="flex-1 accent-orange" />
            <span className="w-12 text-right text-navy font-semibold text-xs">
              {gapValue > 0 ? '+' : ''}{gapValue}{gapSuffix}
            </span>
          </div>
        </div>
        <div>
          <label className="text-xs text-slate mb-1 block">Payout (%)</label>
          <div className="flex items-center gap-2">
            <input type="range" min={payoutMin * 100} max={payoutMax * 100} step={1}
              value={Math.round(payoutValue * 100)} onChange={e => onPayoutChange(parseFloat(e.target.value) / 100)}
              className="flex-1 accent-orange" />
            <span className="w-12 text-right text-navy font-semibold text-xs">
              {Math.round(payoutValue * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
