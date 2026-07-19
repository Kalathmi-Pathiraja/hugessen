import SectionHeader from '../shared/SectionHeader'
import { NumericInput } from '../shared/NumericInput'

interface Props {
  grantValue: number
  sharePrice: number
  rsuWeight: number
  psuWeight: number
  optionWeight: number
  onChange: (patch: { grantValue?: number; sharePrice?: number; rsuWeight?: number; psuWeight?: number; optionWeight?: number }) => void
}

export default function GrantSizing({ grantValue, sharePrice, rsuWeight, psuWeight, optionWeight, onChange }: Props) {
  // When one slider changes, distribute the remainder equally between the other two
  function handleWeightChange(changed: 'rsu' | 'psu' | 'option', rawPct: number) {
    const v = Math.max(0, Math.min(100, rawPct)) / 100
    const remaining = Math.max(0, 1 - v)

    if (changed === 'rsu') {
      const total_other = psuWeight + optionWeight
      if (total_other === 0) {
        onChange({ rsuWeight: v, psuWeight: remaining / 2, optionWeight: remaining / 2 })
      } else {
        onChange({ rsuWeight: v, psuWeight: remaining * (psuWeight / total_other), optionWeight: remaining * (optionWeight / total_other) })
      }
    } else if (changed === 'psu') {
      const total_other = rsuWeight + optionWeight
      if (total_other === 0) {
        onChange({ rsuWeight: remaining / 2, psuWeight: v, optionWeight: remaining / 2 })
      } else {
        onChange({ rsuWeight: remaining * (rsuWeight / total_other), psuWeight: v, optionWeight: remaining * (optionWeight / total_other) })
      }
    } else {
      const total_other = rsuWeight + psuWeight
      if (total_other === 0) {
        onChange({ rsuWeight: remaining / 2, psuWeight: remaining / 2, optionWeight: v })
      } else {
        onChange({ rsuWeight: remaining * (rsuWeight / total_other), psuWeight: remaining * (psuWeight / total_other), optionWeight: v })
      }
    }
  }

  const vehicles = [
    { key: 'rsu' as const, label: 'RSU', color: '#002957', weight: rsuWeight },
    { key: 'psu' as const, label: 'PSU', color: '#F0531E', weight: psuWeight },
    { key: 'option' as const, label: 'Options', color: '#0E7490', weight: optionWeight },
  ]

  const totalWeight = Math.round((rsuWeight + psuWeight + optionWeight) * 100)

  return (
    <section className="mb-8">
      <SectionHeader
        step={2}
        title="Grant Sizing & Vehicle Mix"
        subtitle="Set the total grant value and allocate between RSUs, PSUs, and Options. Sliders auto-balance to maintain 100%."
      />

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Grant value */}
        <div>
          <label className="block text-sm font-medium text-navy mb-1">Total Target Grant Value ($)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate font-medium">$</span>
            <NumericInput
              value={grantValue}
              min={1}
              onChange={v => onChange({ grantValue: v })}
              className="w-full pl-7 pr-4 py-2.5 border border-lightgrey rounded text-navy font-medium
                         focus:outline-none focus:ring-2 focus:ring-orange bg-white"
            />
          </div>
        </div>

        {/* Share price */}
        <div>
          <label className="block text-sm font-medium text-navy mb-1">Current Share Price ($)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate font-medium">$</span>
            <NumericInput
              value={sharePrice}
              min={0.01}
              onChange={v => onChange({ sharePrice: v })}
              className="w-full pl-7 pr-4 py-2.5 border border-lightgrey rounded text-navy font-medium
                         focus:outline-none focus:ring-2 focus:ring-orange bg-white"
            />
          </div>
          <p className="mt-1 text-xs text-slate">Used as S and K (at-the-money) for Black-Scholes</p>
        </div>
      </div>

      {/* Vehicle mix sliders */}
      <div className="p-5 bg-offwhite rounded border border-lightgrey">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-navy">Vehicle Mix</span>
          <span className={`text-sm font-bold ${totalWeight === 100 ? 'text-green-700' : 'text-red-600'}`}>
            Total: {totalWeight}%
          </span>
        </div>

        {/* Visual bar */}
        <div className="flex h-8 rounded overflow-hidden mb-5">
          {vehicles.map(v => (
            <div
              key={v.key}
              style={{ width: `${v.weight * 100}%`, backgroundColor: v.color, transition: 'width 0.2s' }}
              className="flex items-center justify-center text-white text-xs font-bold overflow-hidden whitespace-nowrap"
            >
              {v.weight > 0.08 ? `${v.label} ${Math.round(v.weight * 100)}%` : ''}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {vehicles.map(v => (
            <div key={v.key}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: v.color }} />
                  <span className="text-sm font-medium text-navy">{v.label}</span>
                </div>
                <span className="text-sm font-bold text-navy w-10 text-right">
                  {Math.round(v.weight * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(v.weight * 100)}
                onChange={e => handleWeightChange(v.key, parseFloat(e.target.value))}
                className="w-full accent-orange"
                style={{ accentColor: v.color }}
              />
            </div>
          ))}
        </div>

        {/* Dollar breakdown */}
        <div className="mt-5 grid grid-cols-3 gap-3 pt-4 border-t border-lightgrey">
          {vehicles.map(v => (
            <div key={v.key} className="text-center">
              <div className="text-xs text-slate mb-0.5">{v.label} Value</div>
              <div className="text-sm font-bold text-navy">
                ${(grantValue * v.weight).toLocaleString('en-CA', { maximumFractionDigits: 0 })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
