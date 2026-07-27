import SectionHeader from '../shared/SectionHeader'
import { NumericInput } from '../shared/NumericInput'
import { ScenarioPercentiles } from '../../types/stip'

interface Props {
  baseSalary: number
  targetStipPct: number
  distribution: 'lognormal' | 'normal'
  scenarioPercentiles: ScenarioPercentiles
  onChange: (field: string, value: number | string) => void
  onPercentileChange: (field: keyof ScenarioPercentiles, value: number) => void
}

export default function BaselineFinancials({
  baseSalary, targetStipPct, distribution, scenarioPercentiles, onChange, onPercentileChange,
}: Props) {
  const targetOpp = baseSalary * targetStipPct

  return (
    <section className="mb-8">
      <SectionHeader
        step={1}
        title="Baseline Financials"
        subtitle="Define the executive's compensation baseline and simulation distribution assumption."
      />

      <div className="grid grid-cols-2 gap-6">
        {/* Base Salary */}
        <div>
          <label className="block text-sm font-medium text-navy mb-1">Base Salary ($)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate font-medium">$</span>
            <NumericInput
              value={baseSalary}
              min={1}
              onChange={v => onChange('base_salary', v)}
              className="w-full pl-7 pr-4 py-2.5 border border-lightgrey rounded text-navy font-medium
                         focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent
                         bg-white hover:border-slate transition-colors"
            />
          </div>
        </div>

        {/* Target STIP % */}
        <div>
          <label className="block text-sm font-medium text-navy mb-1">Target STIP (%)</label>
          <div className="relative">
            <NumericInput
              value={targetStipPct}
              scale={100}
              min={1}
              max={500}
              onChange={v => onChange('target_stip_pct', v)}
              className="w-full pr-8 pl-4 py-2.5 border border-lightgrey rounded text-navy font-medium
                         focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent
                         bg-white hover:border-slate transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate font-medium">%</span>
          </div>
        </div>

        {/* Target Opportunity — read-only */}
        <div>
          <label className="block text-sm font-medium text-navy mb-1">Target Opportunity ($)</label>
          <div className="px-4 py-2.5 bg-offwhite border border-lightgrey rounded text-navy font-semibold text-lg">
            ${targetOpp.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
          </div>
          <p className="mt-1 text-xs text-slate">Base Salary × Target STIP% — calculated automatically</p>
        </div>

        {/* Distribution */}
        <div>
          <label className="block text-sm font-medium text-navy mb-2">Distribution Assumption</label>
          <div className="flex gap-2">
            {(['lognormal', 'normal'] as const).map(d => (
              <button
                key={d}
                onClick={() => onChange('distribution', d)}
                className={`flex-1 py-2.5 rounded text-sm font-semibold border transition-all ${
                  distribution === d
                    ? 'bg-navy text-white border-navy'
                    : 'bg-white text-slate border-lightgrey hover:border-navy'
                }`}
              >
                {d === 'lognormal' ? 'Log-Normal' : 'Normal'}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate">
            {distribution === 'lognormal'
              ? 'Log-Normal prevents negative outcomes — recommended for financial metrics.'
              : 'Normal is simpler but can generate negative simulated values.'}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium text-navy mb-2">Bear / Base / Bull Percentiles</label>
        <div className="grid grid-cols-3 gap-6">
          {([
            { key: 'bear' as const, label: 'Bear (P)' },
            { key: 'base' as const, label: 'Base (P)' },
            { key: 'bull' as const, label: 'Bull (P)' },
          ]).map(({ key, label }) => (
            <div key={key} className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate font-medium text-xs">P</span>
              <NumericInput
                value={scenarioPercentiles[key]}
                min={1}
                max={99}
                onChange={v => onPercentileChange(key, v)}
                className="w-full pl-7 pr-4 py-2.5 border border-lightgrey rounded text-navy font-medium
                           focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent
                           bg-white hover:border-slate transition-colors"
              />
              <p className="mt-1 text-xs text-slate capitalize">{key} case</p>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-slate">
          Which percentiles of the simulated payout distribution are labeled Bear/Base/Bull throughout the results, saved scenarios, and Excel export.
        </p>
      </div>
    </section>
  )
}
