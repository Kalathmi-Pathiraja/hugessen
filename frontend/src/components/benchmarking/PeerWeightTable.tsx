import { useState, useEffect } from 'react'
import { PeerWeightedResult } from '../../types/BenchmarkingTypes'
import { fmtCompact } from './format'

interface Props {
  peers: PeerWeightedResult[]
  currency: string
  onApply: (weights: Record<string, number>) => void
  onResetToSuggested: () => void
  applying: boolean
}

export default function PeerWeightTable({ peers, currency, onApply, onResetToSuggested, applying }: Props) {
  const [edits, setEdits] = useState<Record<string, number>>({})

  useEffect(() => {
    setEdits(Object.fromEntries(peers.map(p => [p.ticker, p.applied_weight])))
  }, [peers])

  function clamp(v: number): number {
    if (Number.isNaN(v)) return 0.1
    return Math.min(1.0, Math.max(0.1, v))
  }

  return (
    <div className="bg-white border border-gray300 rounded overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-[22px] pb-3">
        <h3 className="text-[20px] font-semibold text-navy">Peer Weights</h3>
        <div className="flex gap-2">
          <button
            onClick={onResetToSuggested}
            className="px-3.5 py-1.5 text-[12.5px] font-semibold border-[1.5px] border-gray300 rounded text-navy bg-white hover:border-navy hover:text-navy transition-colors"
          >
            Reset to Suggested
          </button>
          <button
            onClick={() => onApply(edits)}
            disabled={applying}
            className="px-3.5 py-1.5 text-[12.5px] bg-orange text-white font-semibold rounded hover:bg-orangedeep disabled:opacity-50 transition-colors"
          >
            {applying ? 'Applying…' : 'Apply Weights'}
          </button>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-navy text-white text-[11px] uppercase tracking-[0.06em]">
            <th className="px-3 py-2.5 text-left font-semibold">Company</th>
            <th className="px-3 py-2.5 text-right font-semibold">Pay Value</th>
            <th className="px-3 py-2.5 text-right font-semibold">Size Value</th>
            <th className="px-3 py-2.5 text-right font-semibold">Suggested Wt.</th>
            <th className="px-3 py-2.5 text-right font-semibold">Applied Wt.</th>
          </tr>
        </thead>
        <tbody>
          {peers.map((p, i) => (
            <tr key={p.ticker} className={`border-t border-gray200 ${i % 2 === 1 ? 'bg-[#FAFAFA]' : 'bg-white'}`}>
              <td className="px-3 py-2 text-[12.5px] text-navy font-medium">{p.company_name}</td>
              <td className="px-3 py-2 text-right text-[12.5px] font-display text-navy">{fmtCompact(p.pay_value)}</td>
              <td className="px-3 py-2 text-right text-[12.5px] font-display text-charcoal">{p.size_value !== null ? fmtCompact(p.size_value) : '—'}</td>
              <td className="px-3 py-2 text-right text-[12.5px] font-display text-charcoal">{p.suggested_weight.toFixed(2)}</td>
              <td className="px-3 py-2 text-right">
                <input
                  type="number"
                  min={0.1} max={1.0} step={0.05}
                  value={edits[p.ticker] ?? p.applied_weight}
                  onChange={e => setEdits(prev => ({ ...prev, [p.ticker]: Number(e.target.value) }))}
                  onBlur={e => setEdits(prev => ({ ...prev, [p.ticker]: clamp(Number(e.target.value)) }))}
                  className="w-16 text-right text-[12.5px] font-display font-bold px-2 py-[5px] border border-gray300 rounded text-navy
                             focus:outline-none focus:ring-2 focus:ring-orange"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-6 py-3 text-[11px] italic text-charcoal">Applied weights determine the size-adjusted regression above. Weights are re-normalized to sum to 1.0 on apply.</p>
    </div>
  )
}
