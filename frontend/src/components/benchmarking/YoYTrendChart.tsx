import { useEffect, useRef, useState } from 'react'
import {
  ComposedChart, Bar, Cell, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from 'recharts'
import { BenchmarkData, YoYResponse, YoYYearStats } from '../../types/BenchmarkingTypes'
import { benchmarkingApi } from '../../api/client'
import { BRAND } from '../../constants/brand'
import { fmtCompact } from './format'

const LIGHT = '#3B5070'
const DARK = BRAND.navy

interface Props {
  benchmarkData: BenchmarkData
  role: string
}

interface YearRow {
  label: string
  aged: boolean
  base: number      // transparent, up to P25
  lowSeg: number    // P25 -> P50
  highSeg: number   // P50 -> P75
  stats: YoYYearStats
  client: number | null
}

function ClientDiamond(props: any) {
  const { cx, cy } = props
  if (cx == null || cy == null) return null
  const r = 7
  return (
    <path
      d={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`}
      fill={BRAND.orange}
      stroke="#fff"
      strokeWidth={1}
    />
  )
}

function YoYTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  // Hovering the client diamond hands us the Scatter's point ({label, clientY})
  // instead of the bar row — find the entry that actually carries stats.
  const row: YearRow | undefined = payload.map((p: any) => p?.payload).find((p: any) => p?.stats)
  if (!row) return null
  const s = row.stats
  return (
    <div style={{ background: BRAND.navy, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: BRAND.white }}>
      <p style={{ fontWeight: 700, marginBottom: 4 }}>
        {row.label}{row.aged ? ' (projection)' : ''} · Target TDC
      </p>
      <p>P25 {fmtCompact(s.p25)} · P50 {fmtCompact(s.p50)} · P75 {fmtCompact(s.p75)}</p>
      <p>Average {fmtCompact(s.avg)} · {s.n_peers} peers</p>
      {s.client != null && (
        <p style={{ color: BRAND.orange }}>
          Client {fmtCompact(s.client)}{s.client_percentile != null ? ` (${s.client_percentile.toFixed(1)}th)` : ''}
        </p>
      )}
    </div>
  )
}

// Prior-year hardcode fields, entered in $000s to match the Excel convention.
type OverrideField = 'p25' | 'p50' | 'p75' | 'avg' | 'client'
const OVERRIDE_FIELDS: { key: OverrideField; label: string }[] = [
  { key: 'p25', label: 'P25' },
  { key: 'p50', label: 'P50' },
  { key: 'p75', label: 'P75' },
  { key: 'avg', label: 'Average' },
  { key: 'client', label: 'Client' },
]

export default function YoYTrendChart({ benchmarkData, role }: Props) {
  const [agingPct, setAgingPct] = useState(() => benchmarkData.aging_factor * 100)
  const [overrides, setOverrides] = useState<Partial<Record<OverrideField, string>>>({})
  const [overrideResetKey, setOverrideResetKey] = useState(0)
  const [excludedTickers, setExcludedTickers] = useState<string[]>([])
  const [yoy, setYoy] = useState<YoYResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Guards against out-of-order responses when the role or aging factor
  // changes quickly — only the latest request may commit state.
  const seqRef = useRef(0)

  // Reset manual exclusions when switching roles — they're specific to the
  // peer set of the role being viewed.
  useEffect(() => { setExcludedTickers([]) }, [role])

  useEffect(() => {
    const seq = ++seqRef.current
    setLoading(true)
    setError(null)
    const entries = OVERRIDE_FIELDS
      .map(({ key }) => [key, overrides[key]] as const)
      .filter(([, v]) => v !== undefined && v !== '' && !Number.isNaN(Number(v)))
      .map(([k, v]) => [k, Number(v) * 1000])   // $000s -> dollars
    const prior_year_override = entries.length ? Object.fromEntries(entries) : null
    benchmarkingApi
      .getYoY({
        benchmark_data: benchmarkData, role, aging_factor: agingPct / 100, prior_year_override,
        excluded_tickers: excludedTickers.length ? excludedTickers : null,
      })
      .then(r => { if (seqRef.current === seq) setYoy(r) })
      .catch(e => { if (seqRef.current === seq) setError(e.message ?? 'Could not compute YoY trend.') })
      .finally(() => { if (seqRef.current === seq) setLoading(false) })
  }, [benchmarkData, role, agingPct, overrides, excludedTickers])

  function toggleExcluded(ticker: string) {
    setExcludedTickers(prev => prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker])
  }

  const priorYearLabel = yoy?.years.find(y => !y.aged)?.label ?? 'prior year'

  if (error) {
    return <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
  }
  if (!yoy) {
    return <div className="p-4 text-sm text-slate">Loading YoY trend…</div>
  }

  const rows: YearRow[] = yoy.years
    .filter(y => y.p25 != null && y.p50 != null && y.p75 != null)
    .map(y => ({
      label: y.label,
      aged: y.aged,
      base: y.p25 as number,
      lowSeg: (y.p50 as number) - (y.p25 as number),
      highSeg: (y.p75 as number) - (y.p50 as number),
      stats: y,
      client: y.client,
    }))

  const clientPoints = rows
    .filter(r => r.client != null)
    .map(r => ({ label: r.label, clientY: r.client as number }))

  return (
    <div className="bg-white border border-lightgrey rounded p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <p className="text-sm font-semibold text-navy">
          {role} · Target TDC — Year-over-Year{loading && <span className="ml-2 text-slate font-normal">updating…</span>}
        </p>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-slate">
            Aging factor
            <input
              type="number" min={0} max={25} step={0.5}
              value={agingPct}
              onChange={e => setAgingPct(Number(e.target.value))}
              className="w-16 text-right text-sm px-2 py-1 border border-lightgrey rounded text-navy
                         focus:outline-none focus:ring-2 focus:ring-orange"
            />
            %
          </label>
          <div className="flex items-center gap-4 text-xs text-slate">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: DARK }} /> P50–P75</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: LIGHT }} /> P25–P50</span>
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 0 L12 6 L6 12 L0 6 Z" fill={BRAND.orange} /></svg>
              Client
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-3 p-2.5 bg-offwhite border border-lightgrey rounded">
        <span className="text-xs font-semibold text-slate uppercase tracking-wide">
          Hardcode {priorYearLabel} values ($000s)
        </span>
        {OVERRIDE_FIELDS.map(({ key, label }) => (
          <label key={`${key}-${overrideResetKey}`} className="flex items-center gap-1.5 text-xs text-slate">
            {label}
            <input
              type="number"
              placeholder="auto"
              defaultValue={overrides[key] ?? ''}
              onBlur={e => setOverrides(prev => ({ ...prev, [key]: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              className="w-20 text-right text-sm px-2 py-1 border border-lightgrey rounded text-navy
                         focus:outline-none focus:ring-2 focus:ring-orange"
            />
          </label>
        ))}
        {Object.values(overrides).some(v => v !== undefined && v !== '') && (
          <button
            onClick={() => { setOverrides({}); setOverrideResetKey(k => k + 1) }}
            className="text-xs text-orange underline hover:no-underline"
          >
            Clear
          </button>
        )}
      </div>
      {yoy.aged_peers.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3 p-2.5 bg-offwhite border border-lightgrey rounded">
          <span className="text-xs font-semibold text-slate uppercase tracking-wide">
            Exclude from {yoy.years.find(y => y.aged)?.label ?? 'projected'} calc
          </span>
          {yoy.aged_peers.map(p => (
            <label key={p.ticker} className="flex items-center gap-1.5 text-xs text-slate cursor-pointer">
              <input
                type="checkbox"
                checked={excludedTickers.includes(p.ticker)}
                onChange={() => toggleExcluded(p.ticker)}
                className="accent-orange"
              />
              <span className={excludedTickers.includes(p.ticker) ? 'line-through text-slate/60' : ''}>
                {p.company_name}
              </span>
            </label>
          ))}
        </div>
      )}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 16, right: 16, bottom: 8, left: 8 }} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke={BRAND.lightGrey} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: BRAND.slate, fontWeight: 600 }} />
            <YAxis tick={{ fontSize: 11, fill: BRAND.slate }} tickFormatter={(v: number) => fmtCompact(v)} />
            <Tooltip content={<YoYTooltip />} />
            <Bar dataKey="base" stackId="a" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="lowSeg" stackId="a" isAnimationActive={false} barSize={96}>
              {rows.map((r, i) => <Cell key={i} fill={LIGHT} fillOpacity={r.aged ? 0.55 : 1} />)}
            </Bar>
            <Bar dataKey="highSeg" stackId="a" isAnimationActive={false} barSize={96} radius={[4, 4, 0, 0]}>
              {rows.map((r, i) => <Cell key={i} fill={DARK} fillOpacity={r.aged ? 0.55 : 1} />)}
            </Bar>
            <Scatter data={clientPoints} dataKey="clientY" shape={<ClientDiamond />} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-4 mt-3 text-xs" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}>
        {rows.map(r => (
          <div key={r.label} className="text-center">
            <p className="font-semibold text-navy mb-1">
              {r.label}
              {r.aged && <span className="ml-1 text-slate font-normal">(projected)</span>}
            </p>
            <p className="text-slate">
              P25 {fmtCompact(r.stats.p25)} · P50 <span className="font-semibold text-navy">{fmtCompact(r.stats.p50)}</span> · P75 {fmtCompact(r.stats.p75)}
            </p>
            {r.stats.client != null && (
              <p className="text-orange font-medium mt-0.5">
                Client {fmtCompact(r.stats.client)}
                {r.stats.client_percentile != null && ` (${r.stats.client_percentile.toFixed(1)}th)`}
              </p>
            )}
          </div>
        ))}
      </div>
      {rows.some(r => r.aged) && (
        <p className="mt-2 text-xs text-slate/80 flex items-center gap-1">
          <span className="text-orange">ⓘ</span>
          {rows.find(r => r.aged)?.label} is a projection: peer salaries aged {agingPct}% (or the disclosed next-year
          salary where available) with current target STI/LTI percentages carried forward. The client&apos;s own value
          is never aged.
        </p>
      )}
    </div>
  )
}
