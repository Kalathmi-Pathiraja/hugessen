import { useState, useRef } from 'react'
import { MarketData } from '../../types/ltip'
import { ltipApi } from '../../api/client'

interface Props {
  marketData: MarketData | null
  onUpload: (data: MarketData) => void
}

export default function ExcelUpload({ marketData, onUpload }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError(null)
    setUploading(true)
    try {
      const data = await ltipApi.uploadData(file) as MarketData
      onUpload(data)
    } catch (e: any) {
      setError(e.message ?? 'Upload failed. Check the file format and try again.')
    } finally {
      setUploading(false)
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-none w-8 h-8 rounded-full bg-orange text-white text-sm font-bold flex items-center justify-center">1</div>
        <div>
          <h2 className="text-xl font-semibold text-navy tracking-tight">Market Data Upload</h2>
          <p className="text-sm text-slate mt-0.5">Upload a completed LTIP Excel template to unlock all other inputs.</p>
        </div>
        <div className="ml-auto">
          <button
            onClick={ltipApi.downloadTemplate}
            className="px-4 py-2 text-sm border border-lightgrey rounded text-navy hover:border-orange hover:text-orange transition-colors flex items-center gap-2"
          >
            ↓ Download Template
          </button>
        </div>
      </div>
      <div className="mt-3 h-px bg-gradient-to-r from-orange via-lightgrey to-transparent mb-6" />

      {marketData ? (
        /* Uploaded state */
        <div className="p-6 bg-green-50 border border-green-200 rounded">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-600 text-xl">✓</span>
                <span className="font-semibold text-green-800">Data uploaded successfully</span>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                <div className="text-slate">Tickers:</div>
                <div className="text-navy font-medium">{marketData.tickers.join(', ')}</div>
                <div className="text-slate">Trading days:</div>
                <div className="text-navy font-medium">{marketData.n_trading_days}</div>
                <div className="text-slate">Company volatility (σ):</div>
                <div className="text-navy font-medium">{(marketData.annual_vol['COMPANY'] * 100).toFixed(1)}%</div>
              </div>
              {marketData.validation_warnings.length > 0 && (
                <div className="mt-3 space-y-1">
                  {marketData.validation_warnings.map((w, i) => (
                    <p key={i} className="text-amber-700 text-xs">⚠ {w}</p>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => inputRef.current?.click()}
              className="text-xs text-slate hover:text-orange underline"
            >
              Replace file
            </button>
          </div>

          {/* Peer volatility table */}
          <div className="mt-5">
            <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">Annualised Volatility by Ticker</p>
            <div className="flex flex-wrap gap-2">
              {marketData.tickers.map(t => (
                <div key={t} className="px-3 py-1.5 bg-white border border-green-200 rounded text-xs">
                  <span className="font-semibold text-navy">{t}</span>
                  <span className="text-slate ml-2">{(marketData.annual_vol[t] * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Upload zone */
        <div
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-lightgrey rounded p-12 text-center cursor-pointer
                     hover:border-orange hover:bg-orange/5 transition-all group"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-3 border-orange border-t-transparent rounded-full animate-spin" />
              <span className="text-slate font-medium">Processing Excel file…</span>
            </div>
          ) : (
            <>
              <svg className="mx-auto mb-4 w-10 h-10 text-gray300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-navy font-semibold mb-1">Drop your LTIP Excel file here</p>
              <p className="text-slate text-sm mb-4">or click to browse — .xlsx files only</p>
              <div className="inline-block px-5 py-2 bg-orange text-white text-sm font-semibold rounded
                              group-hover:bg-orange/90 transition-colors">
                Choose File
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xlsm"
        className="hidden"
        onChange={onInputChange}
      />
    </section>
  )
}
