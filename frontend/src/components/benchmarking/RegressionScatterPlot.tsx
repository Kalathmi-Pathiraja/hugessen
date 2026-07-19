import { useState } from 'react'
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, ZAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import { CalculationResponse } from '../../types/BenchmarkingTypes'
import { BRAND } from '../../constants/brand'
import { fmtCompact } from './format'

interface Props {
  calc: CalculationResponse
  clientSize: number | null
  currency: string
  payMetricLabel: string
  sizeMetricLabel: string
}

interface HoverState {
  cx: number
  cy: number
  name: string
  pay: number
  size: number
  z: number
}

export default function RegressionScatterPlot({ calc, clientSize, currency, payMetricLabel, sizeMetricLabel }: Props) {
  const [hover, setHover] = useState<HoverState | null>(null)

  const peerPoints = calc.peers
    .filter(p => p.size_value !== null && p.size_value > 0)
    .map(p => ({ size: p.size_value as number, pay: p.pay_value, z: p.applied_weight, name: p.company_name }))

  const clientPoint = clientSize && calc.client_pay !== null
    ? [{ size: clientSize, pay: calc.client_pay, z: 1, name: 'Client' }]
    : []

  let regressionLine: { size: number; fitted: number }[] = []
  if (calc.regression.regression_valid && calc.regression.slope !== null && calc.regression.intercept !== null && peerPoints.length > 0) {
    const sizes = peerPoints.map(p => p.size).concat(clientSize ? [clientSize] : [])
    const minSize = Math.min(...sizes)
    const maxSize = Math.max(...sizes)
    const steps = 20
    regressionLine = Array.from({ length: steps + 1 }, (_, i) => {
      const logSize = Math.log(minSize) + (i / steps) * (Math.log(maxSize) - Math.log(minSize))
      const size = Math.exp(logSize)
      const fitted = Math.exp((calc.regression.intercept as number) + (calc.regression.slope as number) * logSize)
      return { size, fitted }
    })
  }

  // Custom dot renderer with its own mouse handlers — bypasses Recharts'
  // shared-Tooltip payload lookup entirely (which was losing the peer's
  // {name} because the regression Line also tracks the x-axis and kept
  // winning the shared crosshair lookup). Each dot now owns its own hover.
  function makeDot(isClient: boolean) {
    return (props: any) => {
      const { cx, cy, payload } = props
      if (cx == null || cy == null) return <g />
      const r = isClient ? 8 : 5
      const shape = isClient ? (
        <path
          d={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`}
          fill={BRAND.orange}
        />
      ) : (
        <circle cx={cx} cy={cy} r={r} fill={BRAND.navy} fillOpacity={0.65} />
      )
      return (
        <g
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => setHover({ cx, cy, name: payload.name, pay: payload.pay, size: payload.size, z: payload.z })}
          onMouseLeave={() => setHover(null)}
        >
          <circle cx={cx} cy={cy} r={r + 6} fill="transparent" />
          {shape}
        </g>
      )
    }
  }

  return (
    <div className="bg-white border border-gray300 rounded px-6 pt-[22px] pb-5 flex flex-col">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[20px] font-semibold text-navy">Pay vs. Size Regression</h3>
        <span className="text-[11.5px] text-charcoal font-display">n = {peerPoints.length} peers</span>
      </div>
      {!calc.regression.regression_valid && (
        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
          {calc.regression.regression_warning ?? 'Insufficient size data for regression — showing unweighted percentiles.'}
        </div>
      )}
      <div className="h-52 relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={BRAND.lightGrey} />
            <XAxis
              type="number" dataKey="size" name="Size" scale="log" domain={['auto', 'auto']}
              tick={{ fontSize: 10, fill: BRAND.slate }}
              tickFormatter={(v: number) => fmtCompact(v)}
            />
            <YAxis
              type="number" dataKey="pay" name="Pay" scale="log" domain={['auto', 'auto']}
              tick={{ fontSize: 10, fill: BRAND.slate }}
              tickFormatter={(v: number) => fmtCompact(v)}
            />
            <ZAxis dataKey="z" range={[16, 90]} />
            {regressionLine.length > 0 && (
              <Line
                data={regressionLine} dataKey="fitted" type="monotone"
                stroke={BRAND.navy} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={false}
                legendType="none" isAnimationActive={false}
              />
            )}
            <Scatter data={peerPoints} shape={makeDot(false)} isAnimationActive={false} />
            {clientPoint.length > 0 && (
              <Scatter data={clientPoint} shape={makeDot(true)} isAnimationActive={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
        {hover && (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap"
            style={{
              left: hover.cx, top: hover.cy,
              transform: `translate(${hover.cx > 260 ? '-100%' : '12px'}, -100%)`,
              background: BRAND.navy, borderRadius: 8, padding: '8px 10px', fontSize: 12, color: BRAND.white,
            }}
          >
            <p style={{ fontWeight: 700, marginBottom: 2 }}>{hover.name}</p>
            <p>{payMetricLabel}: {fmtCompact(hover.pay)}</p>
            <p>{sizeMetricLabel}: {fmtCompact(hover.size)}</p>
            {hover.name !== 'Client' && <p>Weight {hover.z.toFixed(2)}</p>}
          </div>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-gray200 flex items-center justify-between text-[11.5px] text-charcoal">
        {calc.regression.regression_valid && calc.regression.r_squared !== null ? (
          <span>Model fit: R² = {calc.regression.r_squared.toFixed(2)}</span>
        ) : <span />}
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rotate-45 bg-orange" />
          Selected company
        </span>
      </div>
    </div>
  )
}
