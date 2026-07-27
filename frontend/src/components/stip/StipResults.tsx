import { StipResults as Results, PeerBenchmark } from '../../types/stip'
import { BRAND } from '../../constants/brand'
import BulletChart from '../shared/BulletChart'

// Smart formatter: large numbers → $M/$B, small decimals → %, otherwise plain number
function formatRaw(v: number): string {
  if (v === 0) return '—'
  const abs = Math.abs(v)
  if (abs >= 1_000_000_000)
    return `$${(v / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000)
    return `$${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)
    return `$${v.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`
  if (abs < 1 && abs > 0)
    return `${(v * 100).toFixed(1)}%`   // likely a ratio like ROIC 0.12 → 12.0%
  return v.toLocaleString('en-CA', { maximumFractionDigits: 1 })
}

interface Props {
  results: Results
  peer?: PeerBenchmark
  onExport: () => void
  exporting: boolean
}

export default function StipResults({ results, peer, onExport, exporting }: Props) {
  const { bear_pct_of_target: bear, base_pct_of_target: base, bull_pct_of_target: bull } = results
  const tgt = results.target_opportunity
  const { bear: bearP, base: baseP, bull: bullP } = results.scenario_percentiles

  // Peer band in % of target terms (peer inputs are % of salary, target is also % of salary)
  // We display peer band as absolute % of target payout — direct comparison
  const peerP25 = peer ? peer.p25_pct * 100 : undefined
  const peerP75 = peer ? peer.p75_pct * 100 : undefined

  const tracks = [
    {
      label: `Bear Case (P${bearP.toFixed(0)})`,
      value: bear,
      valueLabel: `${bear.toFixed(1)}% of Target`,
      maxValue: 200,
      targetValue: 100,
      targetLabel: '100% Target',
      peerP25,
      peerP75,
      color: BRAND.slate,
    },
    {
      label: `Base Case (P${baseP.toFixed(0)})`,
      value: base,
      valueLabel: `${base.toFixed(1)}% of Target`,
      maxValue: 200,
      targetValue: 100,
      targetLabel: '100% Target',
      peerP25,
      peerP75,
      color: BRAND.orange,
    },
    {
      label: `Bull Case (P${bullP.toFixed(0)})`,
      value: bull,
      valueLabel: `${bull.toFixed(1)}% of Target`,
      maxValue: 200,
      targetValue: 100,
      targetLabel: '100% Target',
      peerP25,
      peerP75,
      color: BRAND.navy,
    },
  ]

  return (
    <div>
      {/* Bullet charts */}
      <div className="mb-8">
        <h3 className="text-base font-semibold text-navy mb-2">Scenario Payouts (% of Target)</h3>
        <div className="overflow-x-auto pb-2">
          <BulletChart tracks={tracks} />
        </div>

        {/* Dollar callout row */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          {[
            { label: `Bear (P${bearP.toFixed(0)})`, pct: bear, dollar: results.bear_dollar, color: 'text-slate' },
            { label: `Base (P${baseP.toFixed(0)})`, pct: base, dollar: results.base_dollar, color: 'text-orange' },
            { label: `Bull (P${bullP.toFixed(0)})`, pct: bull, dollar: results.bull_dollar, color: 'text-navy' },
          ].map(({ label, pct, dollar, color }) => (
            <div key={label} className="p-4 bg-offwhite rounded border border-lightgrey">
              <div className="text-xs text-slate mb-1">{label}</div>
              <div className={`text-2xl font-bold ${color}`}>{pct.toFixed(1)}%</div>
              <div className="text-sm text-slate mt-0.5 ">
                ${dollar.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
              </div>
            </div>
          ))}
        </div>

        {peer?.data_source && (
          <p className="mt-3 text-xs text-slate italic">
            Peer band: {peer.data_source} — P25: {Math.round(peer.p25_pct * 100)}% / Median: {Math.round(peer.median_pct * 100)}% / P75: {Math.round(peer.p75_pct * 100)}%
          </p>
        )}
      </div>

      {/* Per-metric breakdown table */}
      <div className="mb-8">
        <h3 className="text-base font-semibold text-navy mb-3">Per-Metric Probability Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-navy text-white">
                <th className="text-left px-3 py-2.5 font-semibold rounded-tl-lg">Metric</th>
                <th className="text-center px-3 py-2.5 font-semibold">Weight</th>
                <th className="text-center px-3 py-2.5 font-semibold">P(≥ Threshold)</th>
                <th className="text-center px-3 py-2.5 font-semibold">P(Zero Payout)</th>
                <th className="text-center px-3 py-2.5 font-semibold">P(≥ Target)</th>
                <th className="text-center px-3 py-2.5 font-semibold">P(≥ Max)</th>
                <th className="text-center px-3 py-2.5 font-semibold rounded-tr-lg">Median Mult.</th>
              </tr>
            </thead>
            <tbody>
              {results.metric_stats.map((stat, i) => {
                const isGate = stat.metric_behavior === 'safety_gate'
                const isCapped = stat.metric_behavior === 'safety_capped'
                const isIndividual = stat.metric_behavior === 'individual'
                const isEagr = stat.simulation_mode === 'target_difficulty'
                return (
                  <tr
                    key={stat.name}
                    className={`border-b border-lightgrey ${isGate
                      ? 'bg-orange/5'
                      : i % 2 === 0 ? 'bg-white' : 'bg-offwhite'}`}
                  >
                    <td className="px-3 py-2.5 font-medium text-navy">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{stat.name}</span>
                        {isGate && (
                          <span className="text-xs font-semibold text-orange bg-orange/10 px-1.5 py-0.5 rounded">GATE</span>
                        )}
                        {isCapped && (
                          <span className="text-xs font-semibold text-slate bg-slate/10 px-1.5 py-0.5 rounded">CAP</span>
                        )}
                        {isIndividual && (
                          <span className="text-xs font-semibold text-navy bg-navy/10 px-1.5 py-0.5 rounded">IND</span>
                        )}
                        {isEagr && (
                          <span className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">EAGR</span>
                        )}
                      </div>
                      {isEagr && stat.inferred_g != null && stat.inferred_sigma != null && (
                        <div className="text-xs text-slate/70 mt-0.5">
                          g={stat.inferred_g.toFixed(1)}% · σ={stat.inferred_sigma.toFixed(1)}%
                          {stat.starting_value != null && ` · X₀=${formatRaw(stat.starting_value)}`}
                        </div>
                      )}
                      {isEagr && stat.budget_target > 0 && stat.base_achievement_pct != null && (
                        <div className={`text-xs mt-0.5 font-medium ${
                          stat.base_achievement_pct >= 100 ? 'text-green-600'
                          : stat.base_achievement_pct >= 80 ? 'text-orange'
                          : 'text-red-500'
                        }`}>
                          Median achievement: {stat.base_achievement_pct.toFixed(1)}% of target
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center text-navy">
                      {isGate ? <span className="text-slate italic text-xs">modifier</span> : `${stat.weight_pct.toFixed(0)}%`}
                    </td>
                    <td className={`px-3 py-2.5 text-center font-medium ${
                      !isGate && stat.prob_above_threshold < 70 ? 'text-orange' : 'text-navy'
                    }`}>
                      {isGate ? '—' : `${stat.prob_above_threshold?.toFixed(1) ?? '—'}%`}
                    </td>
                    <td className={`px-3 py-2.5 text-center font-medium ${
                      stat.prob_zero > 20 ? 'text-red-600' : 'text-slate'
                    }`}>
                      {isGate
                        ? <span title="Annual probability gate fires">{stat.gate_probability_pct.toFixed(1)}% fires</span>
                        : `${stat.prob_zero.toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-2.5 text-center text-navy">
                      {isGate ? '—' : `${stat.prob_target.toFixed(1)}%`}
                    </td>
                    <td className={`px-3 py-2.5 text-center font-bold ${
                      stat.prob_max > 10 ? 'text-orange' : 'text-slate'
                    }`}>
                      {isGate ? '—' : isCapped
                        ? <span className="text-xs font-normal text-slate italic">always 0%</span>
                        : `${stat.prob_max.toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-navy">
                      {isGate
                        ? <span className="text-xs font-normal text-slate italic">zeroes full payout</span>
                        : isCapped
                          ? <span title="Hard cap at 100% of target">{stat.median_mult.toFixed(3)}× (cap 1.00×)</span>
                          : `${stat.median_mult.toFixed(3)}×`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-metric achievement bullet charts */}
      {(() => {
        const chartRows = results.metric_stats.filter(
          s => s.metric_behavior !== 'safety_gate'
        )
        if (chartRows.length === 0) return null

        const MAX_ACH = 180  // chart x-axis goes to 180% achievement
        const TRACK_W = 340
        const LABEL_W = 140
        const RIGHT_W = 90

        return (
          <div className="mb-8">
            <h3 className="text-base font-semibold text-navy mb-1">Per-Metric Achievement (P{bearP.toFixed(0)} / P{baseP.toFixed(0)} / P{bullP.toFixed(0)})</h3>
            <p className="text-xs text-slate mb-3">
              Horizontal bars show the simulated achievement range for each metric.
              The notch marks budget target (100%). Shaded range spans P{bearP.toFixed(0)}–P{bullP.toFixed(0)}; the filled bar is the P{baseP.toFixed(0)} case.
            </p>
            <div className="bg-white border border-lightgrey rounded overflow-hidden">
              {chartRows.map((stat, i) => {
                const p10 = Math.min(stat.bear_achievement_pct, MAX_ACH)
                const p50 = Math.min(stat.base_achievement_pct, MAX_ACH)
                const p90 = Math.min(stat.bull_achievement_pct, MAX_ACH)
                const targetX = (100 / MAX_ACH) * TRACK_W
                const threshX = stat.threshold_enabled && stat.threshold_perf
                  ? (stat.threshold_perf / MAX_ACH) * TRACK_W
                  : null
                const p10x = (p10 / MAX_ACH) * TRACK_W
                const p50x = (p50 / MAX_ACH) * TRACK_W
                const p90x = (p90 / MAX_ACH) * TRACK_W

                // Green = above target, orange = below target but above threshold, red = below threshold
                const medColor = stat.base_achievement_pct >= 100 ? '#16a34a'
                  : stat.base_achievement_pct >= (stat.threshold_perf ?? 80) ? '#f97316'
                  : '#ef4444'
                const bandColor = medColor

                return (
                  <div
                    key={stat.name}
                    className={`flex items-center px-4 py-3 gap-3 ${i % 2 === 0 ? 'bg-white' : 'bg-offwhite'} ${i < chartRows.length - 1 ? 'border-b border-lightgrey' : ''}`}
                  >
                    {/* Label */}
                    <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="flex-shrink-0">
                      <div className="text-xs font-semibold text-navy leading-tight truncate" title={stat.name}>{stat.name}</div>
                      <div className="text-xs text-slate/60">{stat.weight_pct.toFixed(0)}% weight</div>
                    </div>

                    {/* SVG bar */}
                    <svg width={TRACK_W} height={36} className="flex-shrink-0 overflow-visible">
                      {/* Background track */}
                      <rect x={0} y={10} width={TRACK_W} height={16} rx={3} fill="#e5e7eb" />

                      {/* Bear–Bull range band */}
                      <rect
                        x={Math.min(p10x, p90x)}
                        y={10}
                        width={Math.max(p90x - p10x, 2)}
                        height={16}
                        rx={2}
                        fill={bandColor}
                        opacity={0.15}
                      />

                      {/* Base case filled bar */}
                      <rect x={0} y={13} width={Math.max(p50x, 2)} height={10} rx={2} fill={medColor} />

                      {/* Bear tick */}
                      <line x1={p10x} y1={8} x2={p10x} y2={28} stroke={medColor} strokeWidth={1.5} opacity={0.5} />
                      {/* Bull tick */}
                      <line x1={p90x} y1={8} x2={p90x} y2={28} stroke={medColor} strokeWidth={1.5} opacity={0.5} />

                      {/* Threshold notch */}
                      {threshX !== null && (
                        <line x1={threshX} y1={7} x2={threshX} y2={29} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 2" />
                      )}

                      {/* Target notch (100%) */}
                      <line x1={targetX} y1={5} x2={targetX} y2={31} stroke="#0a2342" strokeWidth={2} />
                      <text x={targetX} y={3} textAnchor="middle" fontSize={7} fill="#0a2342" fontFamily="Inter,system-ui,sans-serif">100%</text>

                      {/* X-axis labels */}
                      {[0, 50, 100, 150].map(v => (
                        <text key={v} x={(v / MAX_ACH) * TRACK_W} y={34} textAnchor="middle" fontSize={7} fill="#94a3b8" fontFamily="Inter,system-ui,sans-serif">{v}%</text>
                      ))}
                    </svg>

                    {/* Right stats — stacked rows to prevent wrapping */}
                    <div style={{ width: 80, minWidth: 80 }} className="flex-shrink-0 text-xs text-right">
                      <div className="flex justify-between text-slate/50 mb-0.5">
                        <span>P{bearP.toFixed(0)}</span><span style={{ color: medColor }}>{stat.bear_achievement_pct.toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between font-bold mb-0.5">
                        <span className="text-slate/50">P{baseP.toFixed(0)}</span><span style={{ color: medColor }}>{stat.base_achievement_pct.toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between text-slate/50">
                        <span>P{bullP.toFixed(0)}</span><span style={{ color: medColor }}>{stat.bull_achievement_pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Simulated raw metric outcomes — only shown when at least one metric has a budget target */}
      {(() => {
        const rawRows = results.metric_stats.filter(
          stat => stat.metric_behavior !== 'safety_gate' && stat.budget_target > 0
        )
        if (rawRows.length === 0) return null
        return (
          <div className="mb-8">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-base font-semibold text-navy">Simulated Metric Outcomes (Raw Values)</h3>
            </div>

            {/* Normalization note */}
            <div className="mb-3 px-3 py-2.5 bg-offwhite border border-lightgrey rounded text-xs text-slate leading-relaxed">
              <span className="font-semibold text-navy">How this works: </span>
              <span className="font-semibold text-teal-600">EAGR metrics</span> simulate absolute values from historical actuals using
              the inferred growth rate and volatility — the target difficulty is directly embedded in the simulation.{' '}
              <span className="font-semibold text-navy">Relative metrics</span> are centred at 100% of budget; raw values are
              back-computed as achievement × budget target. Changing the budget on a relative metric scales the output but does not
              change the percentage distribution.
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-navy text-white">
                    <th className="text-left px-3 py-2.5 font-semibold rounded-tl-lg">Metric</th>
                    <th className="text-center px-3 py-2.5 font-semibold">Budget Target</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-slate/80">Bear (P{bearP.toFixed(0)})</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-orange/90">Base (P{baseP.toFixed(0)})</th>
                    <th className="text-center px-3 py-2.5 font-semibold rounded-tr-lg">Bull (P{bullP.toFixed(0)})</th>
                  </tr>
                </thead>
                <tbody>
                  {rawRows.map((stat, i) => (
                    <tr
                      key={stat.name}
                      className={`border-b border-lightgrey ${i % 2 === 0 ? 'bg-white' : 'bg-offwhite'}`}
                    >
                      <td className="px-3 py-2.5 font-medium text-navy">
                        <div>{stat.name}</div>
                        {stat.simulation_mode === 'target_difficulty' && (
                          <div className="mt-0.5 flex flex-col gap-0.5">
                            <span className="text-xs font-semibold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded inline-block w-fit">EAGR</span>
                            {stat.inferred_g != null && stat.inferred_sigma != null && (
                              <span className="text-xs text-slate/70">
                                g={stat.inferred_g.toFixed(1)}% · σ={stat.inferred_sigma.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center text-navy">
                        {formatRaw(stat.budget_target)}
                        {stat.simulation_mode === 'target_difficulty' && stat.starting_value != null && (
                          <div className="text-xs text-slate/70">
                            start: {formatRaw(stat.starting_value)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate">
                        <div className="font-medium">{formatRaw(stat.bear_raw)}</div>
                        <div className="text-xs text-slate/70">{stat.bear_achievement_pct.toFixed(1)}% of target</div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="font-semibold text-orange">{formatRaw(stat.base_raw)}</div>
                        <div className="text-xs text-slate/70">{stat.base_achievement_pct.toFixed(1)}% of target</div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-navy">
                        <div className="font-bold">{formatRaw(stat.bull_raw)}</div>
                        <div className="text-xs text-slate/70">{stat.bull_achievement_pct.toFixed(1)}% of target</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {/* Export row */}
      <div className="flex gap-3">
        <button
          onClick={onExport}
          disabled={exporting}
          className="flex-1 py-3.5 bg-navy text-white font-semibold rounded hover:bg-navy/90 transition-colors
                     disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
        >
          {exporting ? (
            <><span className="animate-spin">⟳</span> Generating Excel…</>
          ) : (
            <>↓ Export Results to Excel</>
          )}
        </button>

        <a
          href="/api/v1/stip/backtest"
          download="STIP_Backtest.xlsx"
          className="px-5 py-3.5 border-2 border-navy text-navy font-semibold rounded
                     hover:bg-navy hover:text-white transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
          title="Download a deterministic backtest workbook with 6 hand-verifiable test cases and Excel formulas"
        >
          ↓ Download Backtest Workbook
        </a>
      </div>
    </div>
  )
}
