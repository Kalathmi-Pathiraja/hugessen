import { useState } from 'react'
import { BenchmarkData, PeerRecord } from '../../types/BenchmarkingTypes'
import RoleTabBar from './RoleTabBar'
import YearToggle from './YearToggle'
import { fmtCurrency, fmtPct } from './format'

interface Props {
  data: BenchmarkData
  selectedRole: string
  selectedYear: number
  onRoleChange: (role: string) => void
  onYearChange: (year: number) => void
  onProceed: () => void
}

const COLUMNS: { key: keyof PeerRecord; label: string; kind: 'text' | 'currency' | 'pct' }[] = [
  { key: 'company_name', label: 'Company', kind: 'text' },
  { key: 'incumbent_name', label: 'Incumbent', kind: 'text' },
  { key: 'position_title', label: 'Title', kind: 'text' },
  { key: 'base_salary', label: 'Base Salary', kind: 'currency' },
  { key: 'stip_actual', label: 'STIP Actual', kind: 'currency' },
  { key: 'stip_target_pct', label: 'STIP Target %', kind: 'pct' },
  { key: 'target_tcc', label: 'Target TCC', kind: 'currency' },
  { key: 'ltip_total', label: 'LTIP Total', kind: 'currency' },
  { key: 'ltip_target_pct', label: 'LTIP Target %', kind: 'pct' },
  { key: 'target_tdc', label: 'Target TDC', kind: 'currency' },
  { key: 'actual_tdc', label: 'Actual TDC', kind: 'currency' },
  { key: 'pension_converted', label: 'Pension', kind: 'currency' },
  { key: 'other_converted', label: 'Other', kind: 'currency' },
  { key: 'target_total_comp', label: 'Target Total Comp', kind: 'currency' },
  { key: 'actual_total_comp', label: 'Actual Total Comp', kind: 'currency' },
]

export default function BenchmarkVerification({ data, selectedRole, selectedYear, onRoleChange, onYearChange, onProceed }: Props) {
  const [warningsOpen, setWarningsOpen] = useState(false)

  const rows = data.peers.filter(p => p.role_tags.includes(selectedRole) && p.year === selectedYear)

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {data.validation_warnings.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded overflow-hidden">
          <button
            onClick={() => setWarningsOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-amber-800"
          >
            <span>⚠ {data.validation_warnings.length} validation warning{data.validation_warnings.length > 1 ? 's' : ''} from parsing</span>
            <span>{warningsOpen ? '−' : '+'}</span>
          </button>
          {warningsOpen && (
            <div className="px-4 pb-3 space-y-1">
              {data.validation_warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700">{w}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-semibold text-navy tracking-tight">Data Verification</h2>
          <p className="text-sm text-slate mt-0.5">Confirm the data parsed correctly before proceeding to charts.</p>
        </div>
        <YearToggle years={data.available_years} selectedYear={selectedYear} onChange={onYearChange} />
      </div>

      <div className="mb-5">
        <RoleTabBar roles={data.roles} selectedRole={selectedRole} onChange={onRoleChange} />
      </div>

      <div className="bg-white border border-lightgrey rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy text-white">
              {COLUMNS.map(col => (
                <th key={col.key} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={`${row.lookup_key}-${i}`}
                className={`border-t border-lightgrey ${row.is_client ? 'bg-orange/5 border-l-2 border-l-orange' : ''}`}
              >
                {COLUMNS.map(col => {
                  const v = row[col.key]
                  let display: string
                  if (col.kind === 'currency') display = fmtCurrency(v as number | null)
                  else if (col.kind === 'pct') display = fmtPct(v as number | null)
                  else display = (v as string | null) ?? '—'
                  return (
                    <td key={col.key} className={`px-3 py-2 whitespace-nowrap ${row.is_client ? 'font-semibold text-orange' : 'text-navy'}`}>
                      {display}
                    </td>
                  )
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-slate text-sm">
                  No peers found for {selectedRole} in {selectedYear}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={onProceed}
          className="px-6 py-3 bg-orange text-white font-bold rounded hover:bg-orange/90
                     active:scale-[0.99] transition-all border border-gray300 shadow-orange/20"
        >
          Proceed to Charts →
        </button>
      </div>
    </div>
  )
}
