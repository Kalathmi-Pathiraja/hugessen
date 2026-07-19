import { useState } from 'react'
import SectionHeader from '../shared/SectionHeader'
import { ScorecardMetric, CORRELATION_DEFAULTS } from '../../types/stip'
import { stipApi } from '../../api/client'

interface Props {
  metrics: ScorecardMetric[]
  matrix: number[][]
  onChange: (matrix: number[][]) => void
}

function buildDefaultMatrix(metrics: ScorecardMetric[]): number[][] {
  const n = metrics.length
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 1.00
      const typeA = metrics[i].category_type
      const typeB = metrics[j].category_type
      return CORRELATION_DEFAULTS[typeA]?.[typeB] ?? 0.10
    })
  )
}

export default function CorrelationMatrix({ metrics, matrix, onChange }: Props) {
  const [validating, setValidating] = useState(false)
  const [validity, setValidity] = useState<{ valid: boolean; message: string } | null>(null)
  // Raw string values while the user is actively typing — keyed by "i-j"
  const [editMap, setEditMap] = useState<Record<string, string>>({})

  if (metrics.length < 2) {
    return (
      <section className="mb-8">
        <SectionHeader
          step={4}
          title="Correlation Matrix"
          subtitle="Add at least 2 scorecard metrics to configure correlations."
        />
        <div className="p-6 bg-offwhite rounded border border-lightgrey text-slate text-sm text-center">
          Correlation matrix appears here once you have 2+ metrics in the scorecard.
        </div>
      </section>
    )
  }

  function resetToDefaults() {
    onChange(buildDefaultMatrix(metrics))
    setValidity(null)
  }

  async function validate() {
    setValidating(true)
    try {
      const res: any = await stipApi.validateMatrix(matrix)
      setValidity({
        valid: res.valid,
        message: res.valid
          ? 'Matrix is valid — positive semi-definite. Ready for simulation.'
          : 'Matrix is invalid. Reduce extreme correlations or reset to defaults.',
      })
    } catch {
      setValidity({ valid: false, message: 'Could not validate. Check your connection.' })
    } finally {
      setValidating(false)
    }
  }

  function updateCell(i: number, j: number, value: number) {
    const clamped = Math.max(-1, Math.min(1, value))
    const next = matrix.map(row => [...row])
    next[i][j] = clamped
    next[j][i] = clamped  // keep symmetric
    onChange(next)
    setValidity(null)
  }

  // Colour-code cells by correlation strength
  function cellBg(i: number, j: number): string {
    if (i === j) return 'bg-navy'
    const v = matrix[i]?.[j] ?? 0
    if (v >= 0.5) return 'bg-orange/10'
    if (v >= 0.2) return 'bg-orange/5'
    if (v <= -0.3) return 'bg-blue-50'
    return ''
  }

  return (
    <section className="mb-8">
      <SectionHeader
        step={4}
        title="Correlation Matrix"
        subtitle="Edit pairwise correlations between metrics. Values default based on category type. Diagonal is locked at 1.00."
      />

      <div className="overflow-x-auto mb-4">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-36" />
              {metrics.map(m => (
                <th key={m.id} className="px-2 py-1.5 text-center text-navy font-semibold max-w-20 truncate"
                    title={m.name}>
                  {m.name || '—'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((rowM, i) => (
              <tr key={rowM.id}>
                <td className="pr-3 py-1 text-right text-navy font-semibold text-xs max-w-36 truncate"
                    title={rowM.name}>
                  {rowM.name || '—'}
                </td>
                {metrics.map((_, j) => (
                  <td key={j} className={`p-0.5 ${cellBg(i, j)}`}>
                    {i === j ? (
                      <div className="w-16 h-8 flex items-center justify-center text-white font-bold rounded text-xs bg-navy">
                        1.00
                      </div>
                    ) : (
                      <input
                        type="text"
                        inputMode="decimal"
                        // Show the raw typed string while editing; fall back to
                        // the committed matrix value when the cell is not focused.
                        value={editMap[`${i}-${j}`] ?? (matrix[i]?.[j] ?? 0).toFixed(2)}
                        onFocus={() =>
                          setEditMap(m => ({ ...m, [`${i}-${j}`]: (matrix[i]?.[j] ?? 0).toFixed(2) }))
                        }
                        onChange={e =>
                          setEditMap(m => ({ ...m, [`${i}-${j}`]: e.target.value }))
                        }
                        onBlur={e => {
                          // Commit the value only when the user leaves the cell
                          const parsed = parseFloat(e.target.value)
                          updateCell(i, j, isNaN(parsed) ? 0 : parsed)
                          setEditMap(m => { const next = { ...m }; delete next[`${i}-${j}`]; return next })
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        }}
                        className="w-16 h-8 text-center text-xs border border-lightgrey rounded
                                   focus:outline-none focus:ring-1 focus:ring-orange text-navy
                                   hover:border-slate transition-colors"
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={resetToDefaults}
          className="px-4 py-2 text-sm border border-lightgrey rounded text-navy hover:border-navy transition-colors"
        >
          Reset to Defaults
        </button>
        <button
          onClick={validate}
          disabled={validating}
          className="px-4 py-2 text-sm bg-navy text-white rounded hover:bg-navy/90 transition-colors disabled:opacity-50"
        >
          {validating ? 'Validating…' : 'Validate Matrix'}
        </button>

        {validity && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
            validity.valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            <span>{validity.valid ? '✓' : '✗'}</span>
            <span>{validity.message}</span>
          </div>
        )}
      </div>
    </section>
  )
}

export { buildDefaultMatrix }
