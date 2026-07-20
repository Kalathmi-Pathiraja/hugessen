import { BarChart, Bar, XAxis, YAxis, ReferenceLine, ReferenceDot, ResponsiveContainer, Tooltip } from 'recharts'
import { BRAND } from '../../constants/brand'
import { fmtCompact } from './format'

const NAVY_LIGHT = '#3B5070'

// Client marker: diamond, matching the scatter plot's visual language so the
// client reads the same way on every chart (spec §3.5).
function ClientDiamondDot(props: any) {
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

interface Props {
  label: string
  p25: number
  p50: number
  p75: number
  avg: number
  clientPay: number | null
  clientPercentile: number | null
  currency: string
  weighted: boolean
}

function PositioningTooltip({ active, p25, p50, p75, avg, clientPay, clientPercentile }: any) {
  if (!active) return null
  return (
    <div style={{ background: BRAND.navy, borderRadius: 8, padding: '8px 10px', fontSize: 12, color: BRAND.white }}>
      <p>P25–P50 {fmtCompact(p25)} – {fmtCompact(p50)}</p>
      <p>P50–P75 {fmtCompact(p50)} – {fmtCompact(p75)}</p>
      <p>Average {fmtCompact(avg)}</p>
      {clientPay !== null && (
        <p style={{ color: BRAND.orange }}>
          Client {fmtCompact(clientPay)}{clientPercentile !== null ? ` (${clientPercentile.toFixed(1)}th percentile)` : ''}
        </p>
      )}
    </div>
  )
}

export default function HangingBarChart({ label, p25, p50, p75, avg, clientPay, clientPercentile, currency, weighted }: Props) {
  const data = [{ name: label, base: p25, lowSeg: p50 - p25, highSeg: p75 - p50 }]
  const rangeLo = Math.min(p25, clientPay ?? p25)
  const rangeHi = Math.max(p75, clientPay ?? p75)
  const pad = (rangeHi - rangeLo) * 0.35 || rangeHi * 0.1
  const domainMin = Math.max(0, rangeLo - pad)
  const domainMax = rangeHi + pad

  return (
    <div className="bg-white border border-gray300 rounded px-6 pt-[22px] pb-5 flex flex-col">
      <div className="flex items-center gap-4 text-[11.5px] text-charcoal mb-2">
        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 bg-navy" />P50–P75</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5" style={{ background: NAVY_LIGHT }} />P25–P50</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rotate-45 bg-orange" />Client</span>
      </div>
      <h3 className="text-[20px] font-semibold text-navy">Size-Adjusted Positioning</h3>
      <p className="text-[12.5px] text-charcoal mb-1">{label}</p>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 40, bottom: 8, left: 8 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: BRAND.slate }} />
            <YAxis
              tick={{ fontSize: 11, fill: BRAND.slate }}
              tickFormatter={(v: number) => fmtCompact(v)}
              domain={[domainMin, domainMax]}
            />
            <Tooltip content={<PositioningTooltip p25={p25} p50={p50} p75={p75} avg={avg} clientPay={clientPay} clientPercentile={clientPercentile} />} />
            <Bar dataKey="base" stackId="a" fill="transparent" />
            <Bar dataKey="lowSeg" stackId="a" fill={NAVY_LIGHT} barSize={64} />
            <Bar dataKey="highSeg" stackId="a" fill={BRAND.navy} barSize={64} radius={[4, 4, 0, 0]} />
            <ReferenceLine y={p50} stroke={BRAND.lightGrey} strokeWidth={2} />
            {clientPay !== null && (
              <ReferenceDot
                x={label}
                y={clientPay}
                shape={<ClientDiamondDot />}
                label={{
                  value: clientPercentile !== null ? `${clientPercentile.toFixed(1)}th` : undefined,
                  position: 'right',
                  fill: BRAND.orange,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 divide-x divide-gray200 border-t border-gray200 pt-3 mt-1 text-center">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-charcoal font-semibold">P25</p>
          <p className="text-[16px] font-display text-ink mt-0.5">{fmtCompact(p25)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-charcoal font-semibold">P50 · Median</p>
          <p className="text-[16px] font-display font-bold text-navy mt-0.5">{fmtCompact(p50)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-charcoal font-semibold">P75</p>
          <p className="text-[16px] font-display text-ink mt-0.5">{fmtCompact(p75)}</p>
        </div>
      </div>
      {weighted && (
        <p className="mt-3 text-[11px] text-charcoal">Size-adjusted view — peer weights applied below.</p>
      )}
    </div>
  )
}
