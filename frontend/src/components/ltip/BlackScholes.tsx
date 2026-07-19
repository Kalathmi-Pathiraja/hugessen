import { useState } from 'react'
import SectionHeader from '../shared/SectionHeader'
import { NumericInput } from '../shared/NumericInput'

interface Props {
  sharePrice: number
  companySigma: number  // from uploaded Excel (read-only)
  optionTerm: number
  riskFreeRate: number
  dividendYield: number
  strikePrice: number
  onChange: (patch: {
    optionTerm?: number
    riskFreeRate?: number
    dividendYield?: number
    strikePrice?: number
  }) => void
  fairValuePct: number | null   // computed by backend after simulate, shown read-only
}

export default function BlackScholes({
  sharePrice, companySigma, optionTerm, riskFreeRate, dividendYield, strikePrice, onChange, fairValuePct,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <section className="mb-8">
      <SectionHeader
        step={3}
        title="Black-Scholes Option Pricing"
        subtitle="Merton (1973) model with continuous dividend yield adjustment. Used to determine the number of option units granted."
      />

      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium text-navy hover:text-orange transition-colors mb-4"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        {open ? 'Collapse' : 'Expand'} Black-Scholes Parameters
      </button>

      {/* Always show fair value summary */}
      <div className="flex items-center gap-4 p-4 bg-offwhite rounded border border-lightgrey mb-4">
        <div className="flex-1 grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-slate">Share Price (S)</span>
            <div className="font-bold text-navy">${sharePrice.toFixed(2)}</div>
          </div>
          <div>
            <span className="text-slate">Company Volatility (σ)</span>
            <div className="font-bold text-navy">
              {companySigma > 0 ? `${(companySigma * 100).toFixed(1)}%` : '— upload data first'}
            </div>
          </div>
          <div>
            <span className="text-slate">Option Fair Value</span>
            <div className="font-bold text-orange text-lg">
              {fairValuePct !== null ? `${fairValuePct.toFixed(1)}% of S` : '—'}
            </div>
          </div>
        </div>
      </div>

      {open && (
        <div className="grid grid-cols-2 gap-5 p-5 bg-white border border-lightgrey rounded">
          <Field
            label="Option Term (Years) — T"
            value={optionTerm}

            min={1}
            max={10}
            suffix="yr"
            helper="Time to expiry. Typically longer than vesting period."
            onChange={v => onChange({ optionTerm: v })}
          />
          <Field
            label="Risk-Free Rate (%) — r"
            value={riskFreeRate * 100}

            min={0}
            max={15}
            suffix="%"
            helper="Use current GoC 5-yr bond yield."
            onChange={v => onChange({ riskFreeRate: v / 100 })}
          />
          <Field
            label="Dividend Yield (%) — q"
            value={dividendYield * 100}

            min={0}
            max={20}
            suffix="%"
            helper="Annual continuous dividend yield. Critical for energy companies."
            onChange={v => onChange({ dividendYield: v / 100 })}
          />
          <Field
            label="Strike Price ($) — K"
            value={strikePrice}

            min={0.01}
            prefix="$"
            helper={`Defaults to share price ($${sharePrice.toFixed(2)}). Override for premium/discount grants.`}
            onChange={v => onChange({ strikePrice: v })}
          />

          <div className="col-span-2 p-3 bg-offwhite rounded border border-lightgrey text-xs text-slate">
            <strong className="text-navy">Formula:</strong>{' '}
            d₁ = (ln(S/K) + (r − q + σ²/2) × T) / (σ × √T) &nbsp;|&nbsp;
            Call = S × e<sup>−qT</sup> × N(d₁) − K × e<sup>−rT</sup> × N(d₂)
          </div>
        </div>
      )}
    </section>
  )
}

function Field({ label, value, min, max, prefix, suffix, helper, onChange }: {
  label: string; value: number; min: number; max?: number
  prefix?: string; suffix?: string; helper: string; onChange: (v: number) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-navy mb-1">{label}</label>
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-3 text-slate text-sm">{prefix}</span>}
        <NumericInput
          value={value}
          min={min}
          max={max}
          onChange={onChange}
          className={`w-full py-2.5 border border-lightgrey rounded text-navy font-medium text-sm
                       focus:outline-none focus:ring-2 focus:ring-orange bg-white
                       ${prefix ? 'pl-7' : 'pl-4'} ${suffix ? 'pr-8' : 'pr-4'}`}
        />
        {suffix && <span className="absolute right-3 text-slate text-sm">{suffix}</span>}
      </div>
      <p className="mt-1 text-xs text-slate">{helper}</p>
    </div>
  )
}
