import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { LtipResults as Results, YearByYearRow } from '../../types/ltip'
import { BRAND } from '../../constants/brand'
import BulletChart from '../shared/BulletChart'
import PostVestChart from './PostVestChart'

interface Props {
  results: Results
  onExport: () => void
  exporting: boolean
  optionTerm: number
  vestingTerm: number
  optionWeight: number
}

export default function LtipResults({ results, onExport, exporting, optionTerm, vestingTerm, optionWeight }: Props) {
  const { bear, base, bull, grant_value } = results
  const maxVal = Math.max(bull.total, grant_value * 2.5)

  const tracks = [
    {
      label: 'Bear Case (P10)',
      value: bear.total,
      valueLabel: `$${bear.total.toLocaleString('en-CA', { maximumFractionDigits: 0 })} — ${results.bear_multiple.toFixed(2)}×`,
      maxValue: maxVal,
      targetValue: grant_value,
      targetLabel: 'Grant-Date Value',
      color: BRAND.slate,
    },
    {
      label: 'Base Case (P50)',
      value: base.total,
      valueLabel: `$${base.total.toLocaleString('en-CA', { maximumFractionDigits: 0 })} — ${results.base_multiple.toFixed(2)}×`,
      maxValue: maxVal,
      targetValue: grant_value,
      targetLabel: 'Grant-Date Value',
      color: BRAND.orange,
    },
    {
      label: 'Bull Case (P90)',
      value: bull.total,
      valueLabel: `$${bull.total.toLocaleString('en-CA', { maximumFractionDigits: 0 })} — ${results.bull_multiple.toFixed(2)}×`,
      maxValue: maxVal,
      targetValue: grant_value,
      targetLabel: 'Grant-Date Value',
      color: BRAND.navy,
    },
  ]

  // Stacked bar data
  const barData = [
    { name: 'Bear (P10)', RSU: bear.rsu, PSU: bear.psu, Options: bear.option },
    { name: 'Base (P50)', RSU: base.rsu, PSU: base.psu, Options: base.option },
    { name: 'Bull (P90)', RSU: bull.rsu, PSU: bull.psu, Options: bull.option },
  ]

  return (
    <div>
      {/* Grant info chips */}
      <div className="flex flex-wrap gap-3 mb-6">
        {[
          { label: 'Grant Value', val: `$${grant_value.toLocaleString('en-CA', { maximumFractionDigits: 0 })}` },
          { label: 'RSU Units', val: results.units.rsu_units.toFixed(0) },
          { label: 'PSU Units', val: results.units.psu_units.toFixed(0) },
          { label: 'Option Units', val: results.units.option_units.toFixed(0) },
          { label: 'Option Fair Value', val: `${results.option_fair_value_pct.toFixed(1)}% of S` },
        ].map(({ label, val }) => (
          <div key={label} className="px-3 py-1.5 bg-offwhite border border-lightgrey rounded text-xs">
            <span className="text-slate">{label}: </span>
            <span className="font-bold text-navy">{val}</span>
          </div>
        ))}
      </div>

      {/* Bullet charts */}
      <div className="mb-8">
        <h3 className="text-base font-semibold text-navy mb-3">
          {results.vesting_mode === 'cliff'
            ? `Realized Value at Vest (Cliff — Year ${results.year_by_year[results.year_by_year.length - 1]?.year ?? results.year_by_year.length})`
            : 'Realized Value at Vest'}
        </h3>
        <div className="overflow-x-auto pb-2">
          <BulletChart tracks={tracks} unit="$" />
        </div>

        {/* Multiple callout */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          {[
            { label: 'Bear (P10)', case: bear, mult: results.bear_multiple, color: 'text-slate' },
            { label: 'Base (P50)', case: base, mult: results.base_multiple, color: 'text-orange' },
            { label: 'Bull (P90)', case: bull, mult: results.bull_multiple, color: 'text-navy' },
          ].map(({ label, case: c, mult, color }) => (
            <div key={label} className="p-4 bg-offwhite rounded border border-lightgrey">
              <div className="text-xs text-slate mb-1">{label}</div>
              <div className={`text-2xl font-bold ${color}`}>{mult.toFixed(2)}×</div>
              <div className="text-sm text-slate mt-0.5 ">
                ${c.total.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
              </div>
              <div className="mt-2 text-xs text-slate space-y-0.5">
                <div>RSU: ${c.rsu.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</div>
                <div>PSU: ${c.psu.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</div>
                <div>Options: ${c.option.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stacked bar chart */}
      <div className="mb-8">
        <h3 className="text-base font-semibold text-navy mb-3">Vehicle Composition by Scenario</h3>
        <div className="w-full h-64 bg-white rounded border border-lightgrey p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ left: 80, right: 40, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BRAND.lightGrey} horizontal={false} />
              <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: BRAND.slate, fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: BRAND.navy, fontSize: 12, fontWeight: 600 }} />
              <Tooltip
                formatter={(v: number, name: string) => [
                  `$${v.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`, name
                ]}
                contentStyle={{ borderColor: BRAND.lightGrey, borderRadius: 8, fontSize: 12 }}
              />
              <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="RSU" stackId="a" fill={BRAND.rsuBar} />
              <Bar dataKey="PSU" stackId="a" fill={BRAND.psuBar} />
              <Bar dataKey="Options" stackId="a" fill={BRAND.optionBar} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Year-by-year base case table */}
      <div className="mb-8">
        <h3 className="text-base font-semibold text-navy mb-1">Year-by-Year Base Case Value</h3>
        <p className="text-xs text-slate mb-3">
          {results.vesting_mode === 'cliff'
            ? `Cliff vesting at Year ${results.year_by_year[results.year_by_year.length - 1]?.year}. Earlier years show estimated unrealised intrinsic value (indicative only).`
            : `Graded vesting — each row shows the tranche that actually vests in that year. PSUs cliff-vest at Year ${results.year_by_year[results.year_by_year.length - 1]?.year} using full-period TSR.`
          }
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-navy text-white">
                <th className="text-left px-4 py-2.5 font-semibold rounded-tl-lg">Vehicle</th>
                {results.year_by_year.map((y: YearByYearRow) => (
                  <th key={y.year} className="text-center px-4 py-2.5 font-semibold">
                    <div>Year {y.year}</div>
                    <div className="text-xs font-normal opacity-70">
                      {y.indicative
                        ? 'Indicative'
                        : results.vesting_mode === 'cliff'
                          ? 'Realized'
                          : `${y.frac.toFixed(0)}% vests`}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(['RSU', 'PSU', 'Options', 'Total'] as const).map((vehicle, vi) => {
                const dataKey = vehicle === 'Options' ? 'option' : vehicle.toLowerCase() as 'rsu' | 'psu' | 'total'
                return (
                  <tr key={vehicle} className={`border-b border-lightgrey ${vi % 2 === 0 ? 'bg-white' : 'bg-offwhite'} ${vehicle === 'Total' ? 'font-bold border-t-2 border-navy' : ''}`}>
                    <td className="px-4 py-2.5 text-navy">{vehicle}</td>
                    {results.year_by_year.map((y: YearByYearRow) => {
                      const val = (y as any)[dataKey] ?? 0
                      const isEmpty = val === 0 && vehicle === 'PSU' && !y.indicative && results.vesting_mode !== 'cliff' && y.year < results.year_by_year[results.year_by_year.length - 1]?.year
                      return (
                        <td key={y.year} className={`px-4 py-2.5 text-center ${y.indicative ? 'text-slate italic' : 'text-navy'}`}>
                          {isEmpty
                            ? <span className="text-slate/40 text-xs">—</span>
                            : `$${val.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Post-vest option fan chart — only when options are in the mix */}
      {optionWeight > 0 && results.post_vest_fan?.length > 0 && (
        <PostVestChart
          fan={results.post_vest_fan}
          vestingTerm={vestingTerm}
          optionTerm={optionTerm}
          grantValue={results.grant_value}
        />
      )}

      {/* Export */}
      <button
        onClick={onExport}
        disabled={exporting}
        className="w-full py-3.5 bg-navy text-white font-semibold rounded hover:bg-navy/90 transition-colors
                   disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
      >
        {exporting ? (
          <><span className="animate-spin">⟳</span> Generating Excel…</>
        ) : (
          <>↓ Export to Excel</>
        )}
      </button>
    </div>
  )
}
