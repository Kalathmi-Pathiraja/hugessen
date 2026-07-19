import SectionHeader from '../shared/SectionHeader'
import { NumericInput } from '../shared/NumericInput'
import { MarketData, VestingMode } from '../../types/ltip'

interface Props {
  marketData: MarketData
  companyGrowthRate: number
  useHistoricalGrowth: boolean
  equityRiskPremium: number
  riskFreeRate: number
  vestingMode: VestingMode
  vestingTerm: number
  customSchedule: number[]
  onChange: (patch: {
    companyGrowthRate?: number
    useHistoricalGrowth?: boolean
    equityRiskPremium?: number
    vestingMode?: VestingMode
    vestingTerm?: number
    customSchedule?: number[]
  }) => void
}

function displayName(ticker: string, names: Record<string, string>): string {
  if (ticker === 'COMPANY') return names['COMPANY'] ?? 'Your Company'
  return names[ticker] ? `${names[ticker]} (${ticker})` : ticker
}

const MODE_OPTIONS: { value: VestingMode; label: string; hint: string }[] = [
  { value: 'cliff',         label: 'Cliff Vest',      hint: '100% vests in a single lump sum at end of term' },
  { value: 'graded_thirds', label: 'Graded — Thirds', hint: 'Equal 1/N per year over the vesting term' },
  { value: 'custom_graded', label: 'Custom Graded',   hint: 'You define the % vesting in each year' },
]

export default function SimulationParams({
  marketData, companyGrowthRate, useHistoricalGrowth, equityRiskPremium, riskFreeRate,
  vestingMode, vestingTerm, customSchedule, onChange,
}: Props) {
  const historicalReturn = marketData.annual_return?.['COMPANY'] ?? null
  const names = marketData.peer_names ?? {}

  // ── Custom schedule helpers ──────────────────────────────────────────────
  function setCustomYears(nYears: number) {
    const clamped = Math.max(1, Math.min(7, nYears))
    const even = Array(clamped).fill(0).map((_, i) =>
      i < clamped - 1 ? parseFloat((1 / clamped).toFixed(3)) : 0
    )
    // Last year picks up the rounding remainder so sum = 1.0
    even[clamped - 1] = parseFloat((1 - even.slice(0, -1).reduce((a, b) => a + b, 0)).toFixed(3))
    onChange({ customSchedule: even, vestingTerm: clamped })
  }

  function updateCustomFrac(idx: number, pct: number) {
    const updated = customSchedule.map((f, i) => i === idx ? pct / 100 : f)
    onChange({ customSchedule: updated })
  }

  const customTotal = customSchedule.reduce((a, b) => a + b, 0)
  const customOk    = Math.abs(customTotal - 1.0) < 0.011

  // Graded-thirds preview fractions
  const gradedFrac  = vestingMode === 'graded_thirds'
    ? Array(Math.max(1, vestingTerm)).fill(1 / Math.max(1, vestingTerm))
    : []

  return (
    <section className="mb-8">
      <SectionHeader
        step={5}
        title="Simulation Parameters"
        subtitle="Set the vesting structure and company growth rate. Volatility and correlation data come from your uploaded Excel file."
      />

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Growth rate */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-navy">
              Company Expected Annual Growth Rate μ (%)
            </label>
            {historicalReturn !== null && (
              <button
                onClick={() => onChange({
                  useHistoricalGrowth: !useHistoricalGrowth,
                  companyGrowthRate: !useHistoricalGrowth ? historicalReturn : companyGrowthRate,
                })}
                className={`text-xs px-2.5 py-1 rounded-full border font-semibold transition-all ${
                  useHistoricalGrowth
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-slate border-lightgrey hover:border-teal-600 hover:text-teal-600'
                }`}
              >
                {useHistoricalGrowth
                  ? `✓ Use Historical (${(historicalReturn * 100).toFixed(1)}%)`
                  : `Use Historical (${(historicalReturn * 100).toFixed(1)}%)`}
              </button>
            )}
          </div>
          <div className="relative">
            <NumericInput
              value={companyGrowthRate}
              scale={100}
              min={-50}
              max={100}
              onChange={v => onChange({ companyGrowthRate: v, useHistoricalGrowth: false })}
              disabled={useHistoricalGrowth}
              className={`w-full pr-8 pl-4 py-2.5 border rounded text-navy font-medium
                         focus:outline-none focus:ring-2 focus:ring-orange
                         ${useHistoricalGrowth ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-white border-lightgrey'}`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate">%</span>
          </div>
          <p className="mt-1 text-xs text-slate">
            {useHistoricalGrowth
              ? `Derived from uploaded price history (mean annualised return). Edit disabled — toggle off to enter manually.`
              : 'Management long-range plan CAGR. Used as GBM drift for the company.'}
          </p>
        </div>

        {/* Equity Risk Premium */}
        <div>
          <label className="block text-sm font-medium text-navy mb-1">
            Equity Risk Premium (ERP) (%)
          </label>
          <div className="relative">
            <NumericInput
              value={equityRiskPremium}
              scale={100}
              min={0}
              max={20}
              onChange={v => onChange({ equityRiskPremium: v })}
              className="w-full pr-8 pl-4 py-2.5 border border-lightgrey rounded text-navy font-medium
                         focus:outline-none focus:ring-2 focus:ring-orange bg-white"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate">%</span>
          </div>
          <p className="mt-1 text-xs text-slate">
            {Object.keys(marketData.peer_betas ?? {}).length > 0
              ? 'Used with uploaded peer betas to set CAPM drift per peer: rf + β × ERP.'
              : 'No betas uploaded — all peers use company growth rate. Add a Beta column to Peer Config to enable CAPM drift.'}
          </p>
        </div>

        {/* Cliff term (only relevant for cliff mode) */}
        {vestingMode === 'cliff' && (
          <div>
            <label className="block text-sm font-medium text-navy mb-1">
              Cliff Vesting Term (Years)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={1} max={7} step={1}
                value={vestingTerm}
                onChange={e => onChange({ vestingTerm: parseInt(e.target.value) })}
                className="flex-1 accent-orange"
              />
              <span className="w-16 text-center font-bold text-navy text-lg bg-offwhite border border-lightgrey rounded py-1">
                {vestingTerm} yr{vestingTerm !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate">
              100% of RSUs, PSUs, and Options vest in a single lump sum at year {vestingTerm}.
            </p>
          </div>
        )}

        {/* Graded thirds term */}
        {vestingMode === 'graded_thirds' && (
          <div>
            <label className="block text-sm font-medium text-navy mb-1">
              Total Vesting Period (Years)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={2} max={5} step={1}
                value={vestingTerm}
                onChange={e => onChange({ vestingTerm: parseInt(e.target.value) })}
                className="flex-1 accent-orange"
              />
              <span className="w-16 text-center font-bold text-navy text-lg bg-offwhite border border-lightgrey rounded py-1">
                {vestingTerm} yrs
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {gradedFrac.map((f, i) => (
                <span key={i} className="text-xs bg-orange/10 border border-orange/30 text-navy px-2 py-0.5 rounded-full">
                  Yr {i + 1}: {(f * 100).toFixed(1)}%
                </span>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate">
              RSUs and Options vest equally each year. PSUs cliff-vest at year {vestingTerm} using full-period TSR.
            </p>
          </div>
        )}
      </div>

      {/* Vesting mode selector */}
      <div className="mb-6">
        <p className="text-sm font-medium text-navy mb-3">Vesting Structure</p>
        <div className="flex flex-col gap-2">
          {MODE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onChange({ vestingMode: opt.value })}
              className={`flex items-start gap-3 p-4 rounded border text-left transition-all ${
                vestingMode === opt.value
                  ? 'bg-navy/5 border-navy'
                  : 'bg-white border-lightgrey hover:border-slate'
              }`}
            >
              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                vestingMode === opt.value ? 'border-navy' : 'border-lightgrey'
              }`}>
                {vestingMode === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-navy" />
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-navy">{opt.label}</div>
                <div className="text-xs text-slate mt-0.5">{opt.hint}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom graded schedule editor */}
      {vestingMode === 'custom_graded' && (
        <div className="mb-6 p-5 bg-offwhite rounded border border-lightgrey">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-navy">Custom Vesting Schedule</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate">Years:</span>
              <div className="flex gap-1">
                {[2, 3, 4, 5].map(y => (
                  <button
                    key={y}
                    onClick={() => setCustomYears(y)}
                    className={`w-8 h-8 rounded text-xs font-semibold border transition-colors ${
                      customSchedule.length === y
                        ? 'bg-navy text-white border-navy'
                        : 'bg-white text-navy border-lightgrey hover:border-navy'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2 mb-3">
            {customSchedule.map((frac, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-xs text-slate w-10 text-right">Yr {idx + 1}</span>
                <input
                  type="range" min={0} max={100} step={1}
                  value={Math.round(frac * 100)}
                  onChange={e => updateCustomFrac(idx, parseFloat(e.target.value))}
                  className="flex-1 accent-orange"
                />
                <div className="relative w-20">
                  <NumericInput
                    value={frac}
                    scale={100}
                    min={0}
                    max={100}
                    onChange={v => updateCustomFrac(idx, v * 100)}
                    className="w-full text-xs px-2 py-1.5 pr-6 border border-lightgrey rounded text-navy text-right
                               focus:outline-none focus:ring-1 focus:ring-orange"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate">%</span>
                </div>
              </div>
            ))}
          </div>

          <div className={`flex items-center justify-between px-3 py-2 rounded ${
            customOk ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <span className="text-xs font-medium text-navy">Total</span>
            <span className={`text-sm font-bold ${customOk ? 'text-green-700' : 'text-red-600'}`}>
              {(customTotal * 100).toFixed(1)}%
              {!customOk && <span className="text-xs font-normal ml-2">— must equal 100%</span>}
            </span>
          </div>

          <p className="mt-3 text-xs text-slate">
            RSUs and Options follow this schedule. PSUs cliff-vest at year {customSchedule.length} using full-period TSR.
          </p>
        </div>
      )}

      {/* Market data summary */}
      <div className="p-5 bg-offwhite rounded border border-lightgrey">
        <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-4">
          Market Data — Sourced from Uploaded Excel (Read-Only)
        </p>

        <div className="mb-4">
          <p className="text-xs text-slate mb-2">Annualised Volatility & GBM Drift per Ticker</p>
          <div className="flex flex-wrap gap-2">
            {marketData.tickers.map(t => {
              const beta = (marketData.peer_betas ?? {})[t]
              const hasBeta = beta !== undefined
              // Drift shown: company uses mu_co, peers use CAPM if beta present else mu_co
              // We show the beta and implied CAPM drift so the user can verify
              return (
                <div key={t} className={`px-3 py-1.5 rounded text-xs border ${
                  t === 'COMPANY' ? 'bg-orange/10 border-orange/30' : 'bg-white border-lightgrey'
                }`}>
                  <span className="font-semibold text-navy">{displayName(t, names)}</span>
                  <span className="text-slate ml-2">σ {(marketData.annual_vol[t] * 100).toFixed(1)}%</span>
                  {t !== 'COMPANY' && hasBeta && (
                    <span className="text-teal-600 ml-2 font-medium">
                      β {beta.toFixed(2)} → μ {((riskFreeRate + beta * equityRiskPremium) * 100).toFixed(1)}%
                    </span>
                  )}
                  {t !== 'COMPANY' && !hasBeta && (
                    <span className="text-slate/60 ml-2">μ = company rate</span>
                  )}
                </div>
              )
            })}
          </div>
          {Object.keys(marketData.peer_betas ?? {}).length > 0 && (
            <p className="text-xs text-slate/60 mt-1">
              CAPM drift = rf ({(riskFreeRate * 100).toFixed(1)}%) + β × ERP ({(equityRiskPremium * 100).toFixed(1)}%)
            </p>
          )}
        </div>

        <div className="overflow-x-auto">
          <p className="text-xs text-slate mb-2">Pearson Correlation Matrix (log returns)</p>
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="w-16 min-w-[4rem]" />
                {marketData.tickers.map(t => (
                  <th key={t} className="px-1 py-1 text-center text-navy font-semibold min-w-[2.75rem]"
                      title={displayName(t, names)}>
                    {t === 'COMPANY' ? 'CO' : t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {marketData.tickers.map((rowT, i) => (
                <tr key={rowT}>
                  <td className="pr-2 text-right text-navy font-semibold text-xs whitespace-nowrap"
                      title={displayName(rowT, names)}>
                    {rowT === 'COMPANY' ? 'CO' : rowT}
                  </td>
                  {marketData.corr_matrix[i]?.map((v, j) => (
                    <td key={j} className="p-0.5">
                      <div
                        className="w-10 h-6 flex items-center justify-center rounded text-xs font-medium"
                        style={{
                          backgroundColor: i === j ? '#002957' :
                            v >= 0.5 ? 'rgba(240,83,30,0.18)' :
                            v >= 0.2 ? 'rgba(240,83,30,0.07)' : '#F2F2F2',
                          color: i === j ? '#FFFFFF' : '#002957',
                        }}
                      >
                        {v.toFixed(2)}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
