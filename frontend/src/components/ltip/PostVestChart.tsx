import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer, TooltipProps,
} from 'recharts'
import { PostVestPoint } from '../../types/ltip'

interface Props {
  fan: PostVestPoint[]
  vestingTerm: number
  optionTerm: number
  grantValue: number
}

function fmt(v: number) {
  return `$${v.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const t = typeof label === 'number' ? label : parseFloat(label ?? '0')
  return (
    <div className="bg-white border border-lightgrey rounded border border-gray300 p-3 text-xs min-w-[200px]">
      <p className="font-bold text-navy mb-2">Year {t.toFixed(1)} from Grant</p>
      {payload.map(p => (
        <div key={p.name} className="flex justify-between gap-4 mb-0.5">
          <span style={{ color: p.color ?? '#464B54' }}>{p.name}</span>
          <span className="font-semibold text-navy">{fmt(p.value as number)}</span>
        </div>
      ))}
    </div>
  )
}

export default function PostVestChart({ fan, vestingTerm, optionTerm, grantValue }: Props) {
  if (!fan || fan.length === 0) return null

  // Build recharts data from fan points, keyed by absolute year from grant
  const data = fan.map(pt => ({
    t:             pt.t_abs,
    bs_p50:        pt.bs_p50,
    // Area band: encode as [p10, p90] but recharts Area needs base+value
    bs_band_lo:    pt.bs_p10,
    bs_band_hi:    pt.bs_p90,
    intrinsic_p50: pt.intrinsic_p50,
    intrinsic_lo:  pt.intrinsic_p10,
    intrinsic_hi:  pt.intrinsic_p90,
  }))

  const maxVal = Math.max(...fan.map(p => p.bs_p90)) * 1.1

  return (
    <div className="mt-10 p-6 bg-white border border-lightgrey rounded shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-base font-semibold text-navy">Post-Vest Option Holding Value</h3>
          <p className="text-xs text-slate mt-0.5">
            GBM fan from vest (Year {vestingTerm}) through expiry (Year {optionTerm}).
            Bands show P10 / P50 / P90 of BS hold value across 10,000 trials.
            Dashed line = intrinsic (exercise-now) floor at P50.
          </p>
        </div>
        <div className="flex gap-2 text-xs ml-4 flex-shrink-0">
          <span className="px-2 py-1 bg-orange/10 border border-orange/30 rounded text-navy font-medium">
            BS Hold Value
          </span>
          <span className="px-2 py-1 bg-slate/10 border border-slate/30 rounded text-navy font-medium">
            Intrinsic Floor
          </span>
        </div>
      </div>

      {/* Context chips */}
      <div className="flex gap-3 mb-5 mt-3 flex-wrap">
        {[
          { label: 'Vest Date', val: `Year ${vestingTerm}` },
          { label: 'Expiry', val: `Year ${optionTerm}` },
          { label: 'Hold Window', val: `${optionTerm - vestingTerm} yr${optionTerm - vestingTerm !== 1 ? 's' : ''}` },
          { label: 'P50 at Expiry', val: fmt(fan[fan.length - 1].bs_p50) },
          { label: 'vs Grant Value', val: `${((fan[fan.length - 1].bs_p50 / grantValue) * 100).toFixed(0)}%` },
        ].map(({ label, val }) => (
          <div key={label} className="px-3 py-1.5 bg-offwhite border border-lightgrey rounded text-xs">
            <span className="text-slate">{label}: </span>
            <span className="font-bold text-navy">{val}</span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#DFE1DF" />

          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={v => `Yr ${v}`}
            tick={{ fontSize: 11, fill: '#464B54' }}
            tickCount={optionTerm - vestingTerm <= 2 ? 5 : 7}
          />
          <YAxis
            tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 11, fill: '#464B54' }}
            domain={[0, maxVal]}
            width={60}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Vest date vertical marker */}
          <ReferenceLine
            x={vestingTerm}
            stroke="#002957"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ value: 'Vest', position: 'insideTopRight', fontSize: 10, fill: '#002957' }}
          />

          {/* P10–P90 BS band — encoded as stacked areas */}
          {/* Bottom of band (p10) — transparent fill, this is the base */}
          <Area
            dataKey="bs_band_lo"
            stroke="none"
            fill="transparent"
            legendType="none"
            isAnimationActive={false}
            name="P10 (base, hidden)"
          />
          {/* Top of band (p90) stacked on p10 — gives the shaded region */}
          <Area
            dataKey="bs_band_hi"
            stroke="#F0531E"
            strokeWidth={1}
            strokeDasharray="4 2"
            fill="#F0531E"
            fillOpacity={0.12}
            stackId="bs"
            isAnimationActive={false}
            name="P90 Hold Value"
          />

          {/* P50 BS hold value — solid orange line */}
          <Line
            dataKey="bs_p50"
            stroke="#F0531E"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
            name="P50 Hold Value (BS)"
          />

          {/* Intrinsic P50 — dashed navy floor line */}
          <Line
            dataKey="intrinsic_p50"
            stroke="#002957"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            isAnimationActive={false}
            name="P50 Intrinsic (exercise now)"
          />

          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
            formatter={(value) => <span style={{ color: '#002957' }}>{value}</span>}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Explanatory note */}
      <p className="mt-3 text-xs text-slate/70 italic">
        The gap between the orange line (BS hold value) and the dashed navy line (intrinsic) is the
        time premium — the additional value preserved by not exercising early. Both converge at
        expiry (Year {optionTerm}) where time value reaches zero.
        Post-vest stock price evolution uses the same GBM model (μ = company growth rate, σ = uploaded volatility).
      </p>
    </div>
  )
}
