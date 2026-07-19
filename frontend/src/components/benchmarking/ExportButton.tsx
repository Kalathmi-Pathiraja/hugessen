import { useState } from 'react'
import { BenchmarkData, CalculationResponse } from '../../types/BenchmarkingTypes'
import { benchmarkingApi } from '../../api/client'

interface Props {
  benchmarkData: BenchmarkData
  calculation: CalculationResponse | null
}

export default function ExportButton({ benchmarkData, calculation }: Props) {
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExport() {
    if (!calculation) return
    setExporting(true)
    setError(null)
    try {
      await benchmarkingApi.exportBenchmarking({ benchmark_data: benchmarkData, calculation })
    } catch (e: any) {
      setError(e.message ?? 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleExport}
        disabled={!calculation || exporting}
        className="px-4 py-2 bg-white border-[1.5px] border-gray300 text-navy font-semibold rounded hover:border-navy
                   transition-colors disabled:opacity-50 flex items-center gap-2 text-[12.5px]"
      >
        {exporting ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin" />
            Exporting…
          </>
        ) : (
          '↓ Export Analysis'
        )}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
