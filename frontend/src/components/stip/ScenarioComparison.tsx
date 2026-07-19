import { useState } from 'react'
import { ScenarioSnapshot, StipResults } from '../../types/stip'

interface Props {
  scenarios: ScenarioSnapshot[]
  onRename: (id: string, name: string) => void
  onRemove: (id: string) => void
}

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`
}

function pct(n: number) {
  return `${n.toFixed(1)}%`
}

// Comparison summary table
function ComparisonTable({ scenarios }: { scenarios: ScenarioSnapshot[] }) {
  const done = scenarios.filter(s => s.results)
  if (done.length === 0) return null

  // Collect all unique metric names across scenarios
  const allMetrics = Array.from(new Set(
    done.flatMap(s => s.results!.metric_stats
      .filter(m => m.metric_behavior !== 'safety_gate')
      .map(m => m.name))
  ))

  const colClass = 'px-3 py-2.5 text-center'
  const headCol = 'px-3 py-2.5 text-left text-xs font-semibold text-slate uppercase tracking-wide'

  return (
    <div className="overflow-x-auto mb-8">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-navy text-white">
            <th className="px-3 py-2.5 text-left font-semibold rounded-tl-lg w-40">Metric</th>
            {done.map((s, i) => (
              <th key={s.id} className={`px-3 py-2.5 text-center font-semibold ${i === done.length - 1 ? 'rounded-tr-lg' : ''}`}>
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Payout rows */}
          <tr className="bg-offwhite border-b border-lightgrey">
            <td colSpan={done.length + 1} className={headCol}>Payout (% of Target)</td>
          </tr>
          {[
            { label: 'Bear (P10)', key: 'bear_pct_of_target' as keyof StipResults, dollarKey: 'bear_dollar' as keyof StipResults },
            { label: 'Base (P50)', key: 'base_pct_of_target' as keyof StipResults, dollarKey: 'base_dollar' as keyof StipResults },
            { label: 'Bull (P90)', key: 'bull_pct_of_target' as keyof StipResults, dollarKey: 'bull_dollar' as keyof StipResults },
          ].map(({ label, key, dollarKey }, ri) => (
            <tr key={label} className={`border-b border-lightgrey ${ri % 2 === 0 ? 'bg-white' : 'bg-offwhite/50'}`}>
              <td className="px-3 py-2 font-medium text-navy">{label}</td>
              {done.map(s => {
                const v = s.results![key] as number
                const d = s.results![dollarKey] as number
                return (
                  <td key={s.id} className={`${colClass} text-navy`}>
                    <div className="font-bold">{pct(v)}</div>
                    <div className="text-xs text-slate">{fmt(d)}</div>
                  </td>
                )
              })}
            </tr>
          ))}

          {/* Plan-level stats */}
          <tr className="bg-offwhite border-b border-lightgrey">
            <td colSpan={done.length + 1} className={headCol}>Plan Statistics</td>
          </tr>
          <tr className="border-b border-lightgrey bg-white">
            <td className="px-3 py-2 font-medium text-navy">Target Opportunity</td>
            {done.map(s => (
              <td key={s.id} className={`${colClass} text-navy`}>{fmt(s.results!.target_opportunity)}</td>
            ))}
          </tr>

          {/* Per-metric median achievement */}
          {allMetrics.length > 0 && (
            <>
              <tr className="bg-offwhite border-b border-lightgrey">
                <td colSpan={done.length + 1} className={headCol}>Median Achievement by Metric</td>
              </tr>
              {allMetrics.map((name, mi) => (
                <tr key={name} className={`border-b border-lightgrey ${mi % 2 === 0 ? 'bg-white' : 'bg-offwhite/50'}`}>
                  <td className="px-3 py-2 font-medium text-navy text-xs">{name}</td>
                  {done.map(s => {
                    const stat = s.results!.metric_stats.find(m => m.name === name)
                    if (!stat) return <td key={s.id} className={`${colClass} text-slate text-xs`}>—</td>
                    const ach = stat.base_achievement_pct
                    const color = ach >= 100 ? 'text-green-600' : ach >= (stat.threshold_perf ?? 80) ? 'text-orange' : 'text-red-500'
                    return (
                      <td key={s.id} className={`${colClass} text-xs font-semibold ${color}`}>
                        {pct(ach)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}

// Compact self-contained bullet chart — fits inside a grid column without overflow
function CompactBulletChart({ scenario }: { scenario: ScenarioSnapshot }) {
  const r = scenario.results!
  const peer = scenario.inputs.peer

  const MAX = 200
  const TRACK_W = 320   // fits comfortably in a ~560px column alongside labels
  const LABEL_W = 80
  const BAR_H = 14
  const ROW_H = 36

  const rows = [
    { label: 'Bear (P10)', value: r.bear_pct_of_target, dollar: r.bear_dollar, color: '#64748b' },
    { label: 'Base (P50)', value: r.base_pct_of_target, dollar: r.base_dollar, color: '#f97316' },
    { label: 'Bull (P90)', value: r.bull_pct_of_target, dollar: r.bull_dollar, color: '#0a2342' },
  ]

  const targetX = (100 / MAX) * TRACK_W
  const peerP25x = peer ? (peer.p25_pct * 100 / MAX) * TRACK_W : null
  const peerP75x = peer ? (peer.p75_pct * 100 / MAX) * TRACK_W : null
  const totalH = rows.length * ROW_H + 20

  return (
    <div className="bg-white border border-lightgrey rounded p-5">
      <svg width={LABEL_W + TRACK_W} height={totalH} className="overflow-visible w-full">
        {rows.map((row, i) => {
          const barY = i * ROW_H + 10
          const fillW = Math.min(Math.max((row.value / MAX) * TRACK_W, 2), TRACK_W)

          return (
            <g key={row.label}>
              {/* Label */}
              <text x={LABEL_W - 8} y={barY + BAR_H / 2 + 4} textAnchor="end"
                fontSize={11} fontWeight="600" fill={row.color}
                fontFamily="Inter,system-ui,sans-serif">
                {row.label}
              </text>

              {/* Track */}
              <rect x={LABEL_W} y={barY} width={TRACK_W} height={BAR_H} rx={3} fill="#e5e7eb" />

              {/* Fill bar */}
              <rect x={LABEL_W} y={barY + 2} width={fillW} height={BAR_H - 4} rx={2} fill={row.color} />

              {/* Peer band — rendered on top of fill so always visible */}
              {peerP25x !== null && peerP75x !== null && (
                <>
                  <rect x={LABEL_W + peerP25x} y={barY}
                    width={peerP75x - peerP25x} height={BAR_H}
                    fill="#94a3b8" opacity={0.35} />
                  <line x1={LABEL_W + peerP25x} y1={barY - 2} x2={LABEL_W + peerP25x} y2={barY + BAR_H + 2}
                    stroke="#64748b" strokeWidth={1} strokeDasharray="2 2" />
                  <line x1={LABEL_W + peerP75x} y1={barY - 2} x2={LABEL_W + peerP75x} y2={barY + BAR_H + 2}
                    stroke="#64748b" strokeWidth={1} strokeDasharray="2 2" />
                </>
              )}

              {/* 100% target notch */}
              <line x1={LABEL_W + targetX} y1={barY - 3} x2={LABEL_W + targetX} y2={barY + BAR_H + 3}
                stroke="#0a2342" strokeWidth={2} />

              {/* Value label to the right */}
              <text x={LABEL_W + TRACK_W + 8} y={barY + BAR_H / 2 + 4} textAnchor="start"
                fontSize={11} fontWeight="700" fill={row.color}
                fontFamily="Inter,system-ui,sans-serif">
                {row.value.toFixed(1)}%
              </text>
              <text x={LABEL_W + TRACK_W + 8} y={barY + BAR_H / 2 + 16} textAnchor="start"
                fontSize={9} fill="#94a3b8"
                fontFamily="Inter,system-ui,sans-serif">
                {fmt(row.dollar)}
              </text>
            </g>
          )
        })}

        {/* 100% label at top */}
        <text x={LABEL_W + targetX} y={6} textAnchor="middle"
          fontSize={8} fill="#0a2342" fontFamily="Inter,system-ui,sans-serif">
          100%
        </text>
      </svg>
      {peer?.data_source && (
        <p className="mt-1 text-xs text-slate/60 italic">{peer.data_source}</p>
      )}
    </div>
  )
}

export default function ScenarioComparison({ scenarios, onRename, onRemove }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const done = scenarios.filter(s => s.results)

  return (
    <div className="mt-16 pt-10 border-t-2 border-navy/20">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-1 w-8 bg-navy rounded" />
        <h2 className="text-2xl font-bold text-navy">Scenario Comparison</h2>
        <span className="text-sm text-slate ml-1">{scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Scenario name chips + status */}
      <div className="flex flex-wrap gap-3 mb-6">
        {scenarios.map(s => (
          <div key={s.id} className={`flex items-center gap-2 px-3 py-1.5 rounded border text-sm ${
            s.results ? 'bg-navy/5 border-navy/20' : s.running ? 'bg-orange/5 border-orange/30' : 'bg-offwhite border-lightgrey'
          }`}>
            {editingId === s.id ? (
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={() => { onRename(s.id, editName || s.name); setEditingId(null) }}
                onKeyDown={e => { if (e.key === 'Enter') { onRename(s.id, editName || s.name); setEditingId(null) } }}
                className="text-sm font-semibold text-navy bg-transparent border-b border-orange outline-none w-32"
              />
            ) : (
              <button
                onClick={() => { setEditingId(s.id); setEditName(s.name) }}
                className="font-semibold text-navy hover:text-orange transition-colors"
                title="Click to rename"
              >
                {s.name}
              </button>
            )}
            {s.running && <span className="w-3 h-3 border-2 border-orange border-t-transparent rounded-full animate-spin" />}
            {s.error && <span className="text-red-500 text-xs">Error</span>}
            {s.results && <span className="text-xs text-slate">✓</span>}
            <button
              onClick={() => onRemove(s.id)}
              className="text-slate/50 hover:text-red-500 transition-colors text-base leading-none ml-1"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Comparison table */}
      {done.length >= 2 && <ComparisonTable scenarios={scenarios} />}
      {done.length === 1 && (
        <p className="text-sm text-slate mb-6 italic">Save a second scenario to see the comparison table.</p>
      )}

      {/* Per-scenario bullet charts */}
      {done.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-navy mb-4">Payout Distributions by Scenario</h3>
          <div className={`grid gap-6 ${done.length === 2 ? 'grid-cols-2' : done.length >= 3 ? 'grid-cols-3' : 'grid-cols-1'}`}>
            {done.map(s => (
              <div key={s.id}>
                <div className="text-sm font-bold text-navy mb-2 px-1">{s.name}</div>
                <CompactBulletChart scenario={s} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
