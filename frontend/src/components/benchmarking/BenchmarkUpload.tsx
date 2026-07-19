import { useState, useRef } from 'react'
import { BenchmarkData } from '../../types/BenchmarkingTypes'
import { benchmarkingApi } from '../../api/client'

interface Props {
  onSuccess: (data: BenchmarkData) => void
}

export default function BenchmarkUpload({ onSuccess }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError(null)
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xlsm')) {
      setError('Please upload an .xlsx (or .xlsm) file.')
      return
    }
    setUploading(true)
    try {
      const data = await benchmarkingApi.uploadBenchmarkFile(file)
      onSuccess(data)
    } catch (e: any) {
      setError(
        e.message ??
        'Could not parse file — ensure you are uploading the Raw Data tab in the standard Hugessen benchmarking template.'
      )
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
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-none w-8 h-8 rounded-full bg-orange text-white text-sm font-bold flex items-center justify-center">1</div>
        <div>
          <h2 className="text-xl font-semibold text-navy tracking-tight">Compensation Benchmarking Upload</h2>
          <p className="text-sm text-slate mt-0.5">Upload the completed Hugessen EC Benchmarking Excel to begin.</p>
        </div>
      </div>
      <div className="mt-3 h-px bg-gradient-to-r from-orange via-lightgrey to-transparent mb-6" />

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
            <span className="text-slate font-medium">Parsing Raw Data and Peer Group tabs…</span>
          </div>
        ) : (
          <>
            <svg className="mx-auto mb-4 w-10 h-10 text-gray300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-navy font-semibold mb-1">Drop your Benchmarking Excel here</p>
            <p className="text-slate text-sm mb-4">or click to browse — .xlsx files only</p>
            <div className="inline-block px-5 py-2 bg-orange text-white text-sm font-semibold rounded
                            group-hover:bg-orange/90 transition-colors">
              Choose File
            </div>
          </>
        )}
      </div>

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
    </div>
  )
}
