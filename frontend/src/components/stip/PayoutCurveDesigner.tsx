import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Area, ResponsiveContainer
} from 'recharts'
import SectionHeader from '../shared/SectionHeader'
import { CurveDesign } from '../../types/stip'
import { BRAND } from '../../constants/brand'

interface Props {
  curve: CurveDesign
  onChange: (curve: CurveDesign) => void
}

// -------------------------------------------------------------------
// JS mirror of the Python calculate_multiplier function.
// Keeps 201 sample points (every 1% from 0–200%) so the Recharts
// tooltip fires continuously across the whole chart, not only at the
// 6-7 structural break-points.
// -------------------------------------------------------------------
function calcMultiplier(perf: number, c: CurveDesign): number {
  const tPerf = c.threshold_enabled ? c.threshold_perf : 0
  const tPay  = c.threshold_enabled ? c.threshold_payout : 0

  if (perf < tPerf) return 0

  if (perf <= c.target_perf) {
    const denom = c.target_perf - tPerf
    if (denom === 0) return tPay
    return tPay + ((perf - tPerf) / denom) * (c.target_payout - tPay)
  }

  if (perf <= c.max_perf) {
    const denom = c.max_perf - c.target_perf
    if (denom === 0) return c.target_payout
    return c.target_payout + ((perf - c.target_perf) / denom) * (c.max_payout - c.target_payout)
  }

  return c.max_payout
}

function buildCurveData(c: CurveDesign) {
  // 201 evenly-spaced points from 0% to 200% performance
  const points = Array.from({ length: 201 }, (_, i) => {
    const perf = i / 100
    return {
      x: i as number,
      xRaw: perf,
      y: parseFloat((calcMultiplier(perf, c) * 100).toFixed(2)),
    }
  })

  // When threshold is enabled, inject a zero-value point at (threshold - ε)
  // so Recharts draws a vertical step instead of a slanted ramp at the jump.
  if (c.threshold_enabled) {
    const tX = Math.round(c.threshold_perf * 100)
    const idx = points.findIndex(p => p.x === tX)
    if (idx > 0) {
      points.splice(idx, 0, { x: tX - 0.001, xRaw: c.threshold_perf - 0.00001, y: 0 })
    }
  }

  return points
}

// -------------------------------------------------------------------
// Custom tooltip — appears immediately wherever the mouse is
// -------------------------------------------------------------------
function CurveTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const payout = payload[0]?.value ?? 0
  return (
    <div className="bg-navy text-white px-3 py-2 rounded border border-gray300 text-xs">
      <div className="font-semibold">Performance: {label}%</div>
      <div className="text-orange font-bold mt-0.5">Payout: {payout.toFixed(1)}%</div>
    </div>
  )
}

// -------------------------------------------------------------------
// Slider row helper
// -------------------------------------------------------------------
interface SliderRowProps {
  label: string
  perfValue: number
  payoutValue: number
  perfMin: number
  perfMax: number
  payoutMin: number
  payoutMax: number
  locked?: boolean
  onPerfChange: (v: number) => void
  onPayoutChange: (v: number) => void
}

function SliderRow({
  label, perfValue, payoutValue,
  perfMin, perfMax, payoutMin, payoutMax,
  locked, onPerfChange, onPayoutChange,
}: SliderRowProps) {
  return (
    <div className={`p-4 rounded border ${locked ? 'bg-offwhite border-lightgrey' : 'bg-white border-lightgrey'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-navy">{label}</span>
        {locked && <span className="text-xs text-slate bg-lightgrey px-2 py-0.5 rounded">Locked</span>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate mb-1 block">Performance (%)</label>
          {locked ? (
            <div className="text-navy font-bold text-lg">{Math.round(perfValue * 100)}%</div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={perfMin * 100}
                max={perfMax * 100}
                step={1}
                value={Math.round(perfValue * 100)}
                onChange={e => onPerfChange(parseFloat(e.target.value) / 100)}
                disabled={locked}
                className="flex-1 accent-orange"
              />
              <span className="w-12 text-right text-navy font-semibold text-sm">
                {Math.round(perfValue * 100)}%
              </span>
            </div>
          )}
        </div>
        <div>
          <label className="text-xs text-slate mb-1 block">Payout (%)</label>
          {locked ? (
            <div className="text-navy font-bold text-lg">{Math.round(payoutValue * 100)}%</div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={payoutMin * 100}
                max={payoutMax * 100}
                step={5}
                value={Math.round(payoutValue * 100)}
                onChange={e => onPayoutChange(parseFloat(e.target.value) / 100)}
                disabled={locked}
                className="flex-1 accent-orange"
              />
              <span className="w-12 text-right text-navy font-semibold text-sm">
                {Math.round(payoutValue * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PayoutCurveDesigner({ curve, onChange }: Props) {
  const update = (patch: Partial<CurveDesign>) => onChange({ ...curve, ...patch })
  const data = buildCurveData(curve)

  const yMax = Math.ceil(curve.max_payout * 100 * 1.15 / 50) * 50  // round up to nearest 50

  return (
    <section className="mb-8">
      <SectionHeader
        step={2}
        title="Payout Curve Designer"
        subtitle="Design the piecewise linear payout curve. The chart updates live as you move the sliders. Hover anywhere on the chart to read exact payout values."
      />

      {/* ── Threshold toggle ── */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-offwhite rounded border border-lightgrey">
        {/*
          The toggle pill is self-contained: overflow-hidden clips the moving
          circle so it can never bleed outside the pill boundary.
        */}
        <button
          type="button"
          role="switch"
          aria-checked={curve.threshold_enabled}
          onClick={() => update({ threshold_enabled: !curve.threshold_enabled })}
          className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-orange ${
            curve.threshold_enabled ? 'bg-orange' : 'bg-lightgrey'
          }`}
        >
          <span
            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              curve.threshold_enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>

        <div className="min-w-0">
          <span className="text-sm font-semibold text-navy">Add Zero-Pay Floor (Threshold)</span>
          <p className="text-xs text-slate mt-0.5 leading-relaxed">
            {curve.threshold_enabled
              ? 'Payout drops to $0 if performance falls below the threshold — shown as a dotted line on the chart.'
              : 'No floor — payout ramps from 0% performance. Toggle on to add a zero-pay floor.'}
          </p>
        </div>
      </div>

      {/* ── Live chart ── */}
      <div className="w-full h-96 mb-8 bg-white rounded border border-lightgrey p-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 20, right: 28, left: 12, bottom: 28 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={BRAND.lightGrey} />

            <XAxis
              dataKey="x"
              type="number"
              domain={[0, 200]}
              ticks={[0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200]}
              tickFormatter={v => `${v}%`}
              label={{
                value: 'Performance Achievement (%)',
                position: 'insideBottom',
                offset: -16,
                fill: BRAND.slate,
                fontSize: 12,
              }}
              tick={{ fill: BRAND.slate, fontSize: 11 }}
            />

            <YAxis
              domain={[0, yMax]}
              tickFormatter={v => `${v}%`}
              label={{
                value: 'Payout Multiplier (%)',
                angle: -90,
                position: 'insideLeft',
                offset: 4,
                fill: BRAND.slate,
                fontSize: 12,
              }}
              tick={{ fill: BRAND.slate, fontSize: 11 }}
            />

            <Tooltip
              content={<CurveTooltip />}
              cursor={{ stroke: BRAND.slate, strokeWidth: 1, strokeDasharray: '4 2' }}
            />

            {/* Shaded fill under curve */}
            <Area
              type="linear"
              dataKey="y"
              fill={BRAND.orange}
              fillOpacity={0.08}
              stroke="none"
              isAnimationActive={false}
            />

            {/* Payout curve line */}
            <Line
              type="linear"
              dataKey="y"
              stroke={BRAND.orange}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: BRAND.orange, stroke: BRAND.white, strokeWidth: 2 }}
              isAnimationActive={false}
            />

            {/* Target reference — 100% performance */}
            <ReferenceLine
              x={100}
              stroke={BRAND.navy}
              strokeWidth={2}
              label={{
                value: '100% Target',
                position: 'top',
                fill: BRAND.navy,
                fontSize: 11,
                fontWeight: 600,
              }}
            />

            {/* Threshold dotted line — only when enabled */}
            {curve.threshold_enabled && (
              <ReferenceLine
                x={Math.round(curve.threshold_perf * 100)}
                stroke={BRAND.slate}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                label={{
                  value: 'Threshold',
                  position: 'top',
                  fill: BRAND.slate,
                  fontSize: 10,
                }}
              />
            )}

            {/* Cap line */}
            <ReferenceLine
              x={Math.round(curve.max_perf * 100)}
              stroke={BRAND.navy}
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.5}
              label={{
                value: 'Cap',
                position: 'top',
                fill: BRAND.slate,
                fontSize: 10,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Slider controls ── */}
      <div className="grid grid-cols-1 gap-4">
        {curve.threshold_enabled && (
          <SliderRow
            label="Threshold — Zero-Pay Floor"
            perfValue={curve.threshold_perf}
            payoutValue={curve.threshold_payout}
            perfMin={0.5}
            perfMax={0.99}
            payoutMin={0}
            payoutMax={0.99}
            onPerfChange={v => update({ threshold_perf: Math.min(v, curve.target_perf - 0.01) })}
            onPayoutChange={v => update({ threshold_payout: v })}
          />
        )}

        <SliderRow
          label="Target — Hardlocked at 100% performance → 100% payout"
          perfValue={1.0}
          payoutValue={1.0}
          perfMin={1}
          perfMax={1}
          payoutMin={1}
          payoutMax={1}
          locked
          onPerfChange={() => {}}
          onPayoutChange={() => {}}
        />

        <SliderRow
          label="Maximum — Performance cap and payout cap"
          perfValue={curve.max_perf}
          payoutValue={curve.max_payout}
          perfMin={1.01}
          perfMax={2.0}
          payoutMin={1.0}
          payoutMax={3.0}
          onPerfChange={v => update({ max_perf: Math.max(v, curve.target_perf + 0.01) })}
          onPayoutChange={v => update({ max_payout: v })}
        />
      </div>
    </section>
  )
}
