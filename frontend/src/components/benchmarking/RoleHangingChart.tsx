import { ComposedChart, Bar, Cell, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { CalculationResponse, PayMetric } from '../../types/BenchmarkingTypes'
import { BRAND } from '../../constants/brand'
import { fmtCompact } from './format'
import { buildBarSegments } from './buildBarSegments'

const LIGHT = '#3B5070'
const DARK = BRAND.navy

interface Props {
  results: Partial<Record<PayMetric, CalculationResponse>>
  weighted: boolean
}

interface ChartRow {
  metric: string
  p25: number; p50: number; p75: number
  avg: number | null
  client: number | null; pct: number | null
  colors: string[]
  [segmentKey: string]: any
}

// Metric set and order mirror the source model's per-role chart tabs
// (e.g. "CEO - Charts"): Base Salary / Target TCC / Target TDC.
const METRICS: { key: PayMetric; label: string }[] = [
  { key: 'base', label: 'Base Salary' },
  { key: 'tcc', label: 'Target TCC' },
  { key: 'tdc', label: 'Target TDC' },
]

function ClientDiamond(props: any) {
  const { cx, cy } = props
  if (cx == null || cy == null) return null
  const r = 8
  return (
    <path
      d={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`}
      fill={BRAND.orange}
      stroke="#fff"
      strokeWidth={1}
    />
  )
}

function AverageDash(props: any) {
  const { cx, cy } = props
  if (cx == null || cy == null) return null
  return <rect x={cx - 26} y={cy - 1.25} width={52} height={2.5} fill={BRAND.teal} />
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null
  // The client-diamond / average-dash Scatter points don't carry the full row —
  // pick the payload entry that does.
  const row: ChartRow | undefined = payload.map((p: any) => p?.payload).find((p: any) => p?.colors)
  if (!row) return null
  return (
    <div style={{ background: BRAND.navy, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: BRAND.white }}>
      <p style={{ fontWeight: 700, marginBottom: 4 }}>{row.metric}</p>
      <p>P25 {fmtCompact(row.p25)} · P50 {fmtCompact(row.p50)} · P75 {fmtCompact(row.p75)}</p>
      {row.avg != null && <p>Average {fmtCompact(row.avg)}</p>}
      {row.client != null && <p style={{ color: BRAND.orange }}>Client {fmtCompact(row.client)} ({row.pct?.toFixed(0)}th percentile)</p>}
    </div>
  )
}

export default function RoleHangingChart({ results, weighted }: Props) {
  const chartData: ChartRow[] = METRICS.map(({ key, label }) => {
    const calc = results[key]
    if (!calc) {
      const segs = buildBarSegments(0, 0, 0, null, LIGHT, DARK, BRAND.orange)
      const row: ChartRow = { metric: label, p25: 0, p50: 0, p75: 0, avg: null, client: null, pct: null, colors: segs.map(s => s.color) }
      segs.forEach(s => { row[s.key] = s.value })
      return row
    }
    const result = weighted ? calc.weighted : calc.unweighted
    const pct = weighted ? calc.client_percentile_weighted : calc.client_percentile_unweighted
    // Diamond overlays replace the in-stack client tick (client = null here).
    const segs = buildBarSegments(result.p25, result.p50, result.p75, null, LIGHT, DARK, BRAND.orange)
    const peerPays = calc.peers.map(p => p.pay_value)
    const avg = peerPays.length ? peerPays.reduce((a, b) => a + b, 0) / peerPays.length : null
    const row: ChartRow = {
      metric: label, p25: result.p25, p50: result.p50, p75: result.p75,
      avg, client: calc.client_pay, pct, colors: segs.map(s => s.color),
    }
    segs.forEach(s => { row[s.key] = s.value })
    return row
  })

  const segmentSlots = [0, 1, 2, 3, 4, 5]
  const clientPoints = chartData.filter(r => r.client != null).map(r => ({ metric: r.metric, clientY: r.client }))
  const avgPoints = chartData.filter(r => r.avg != null).map(r => ({ metric: r.metric, avgY: r.avg }))

  return (
    <div className="bg-white border border-lightgrey rounded p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-navy">Base Salary · Target TCC · Target TDC</p>
        <div className="flex items-center gap-4 text-xs text-slate">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: DARK }} /> P50–P75</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: LIGHT }} /> P25–P50</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 inline-block" style={{ background: BRAND.teal }} /> Average</span>
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 0 L12 6 L6 12 L0 6 Z" fill={BRAND.orange} /></svg>
            Client
          </span>
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 16, right: 16, bottom: 8, left: 8 }} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke={BRAND.lightGrey} vertical={false} />
            <XAxis dataKey="metric" allowDuplicatedCategory={false} tick={{ fontSize: 12, fill: BRAND.slate, fontWeight: 600 }} />
            <YAxis tick={{ fontSize: 11, fill: BRAND.slate }} tickFormatter={(v: number) => fmtCompact(v)} />
            <Tooltip content={<CustomTooltip />} />
            {segmentSlots.map(i => (
              <Bar key={`seg${i}`} dataKey={`seg${i}`} stackId="a" isAnimationActive={false} barSize={120}>
                {chartData.map((row, idx) => (
                  <Cell key={idx} fill={row.colors?.[i] ?? 'transparent'} />
                ))}
              </Bar>
            ))}
            <Scatter data={avgPoints} dataKey="avgY" shape={<AverageDash />} isAnimationActive={false} />
            <Scatter data={clientPoints} dataKey="clientY" shape={<ClientDiamond />} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-3 text-xs">
        {chartData.map(row => (
          <div key={row.metric} className="text-center">
            <p className="font-semibold text-navy mb-1">{row.metric}</p>
            <p className="text-slate">P25 {fmtCompact(row.p25)} · P50 <span className="font-semibold text-navy">{fmtCompact(row.p50)}</span> · P75 {fmtCompact(row.p75)}</p>
            {row.avg != null && <p className="text-slate">Avg {fmtCompact(row.avg)}</p>}
            {row.client != null && (
              <p className="text-orange font-medium mt-0.5">Client {fmtCompact(row.client)} ({row.pct?.toFixed(0)}th)</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
