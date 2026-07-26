import { useState } from 'react'
import StipPage from './components/stip/StipPage'
import LtipPage from './components/ltip/LtipPage'
import BenchmarkingModule from './components/benchmarking/BenchmarkingModule'
import BenchmarkingErrorBoundary from './components/benchmarking/BenchmarkingErrorBoundary'
import AIHubPage from './components/aihub/AIHubPage'

type Tab = 'stip' | 'ltip' | 'benchmarking' | 'aihub'

const TOOLS: { id: Tab; label: string }[] = [
  { id: 'stip', label: 'STIP' },
  { id: 'ltip', label: 'LTIP' },
  { id: 'benchmarking', label: 'Compensation Benchmarking' },
  { id: 'aihub', label: 'AI Hub' },
]

const HEADER_TITLE: Record<Tab, string> = {
  stip: 'Incentive Plan Design',
  ltip: 'Incentive Plan Design',
  benchmarking: 'Executive Compensation Benchmarking',
  aihub: 'AI Hub',
}

export default function App() {
  const [tab, setTab] = useState<Tab>('stip')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-offwhite font-sans flex">
      {/* Icon rail — always visible */}
      <div className="w-14 shrink-0 bg-white border-r border-gray300 flex flex-col items-center py-4 z-40">
        <button
          onClick={() => setSidebarOpen(o => !o)}
          aria-label="Toggle navigation"
          className={`w-9 h-9 flex items-center justify-center rounded text-sm font-semibold transition-colors ${
            sidebarOpen ? 'bg-navy text-white' : 'text-navy hover:bg-gray100'
          }`}
        >
          ☰
        </button>
      </div>

      {/* Popout sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-navy/10 z-30"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed left-14 top-0 bottom-0 w-[236px] bg-white border-r border-gray300 shadow-popover z-40 flex flex-col">
            <div className="px-[22px] pt-6 pb-5 border-b border-gray200">
              <div className="text-navy font-bold text-base tracking-wide font-display">HUGESSEN</div>
              <div className="text-[10px] uppercase tracking-[0.08em] text-charcoal mt-1">Advisory Platform</div>
            </div>
            <nav className="flex-1 px-3 py-4 overflow-y-auto">
              <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-charcoal px-2 mb-2">Workspace</div>
              {['Dashboard', 'Peer Groups'].map(label => (
                <button
                  key={label}
                  className="w-full text-left px-3 py-2 rounded text-[13px] font-medium text-charcoal hover:bg-gray100 transition-colors mb-0.5"
                >
                  {label}
                </button>
              ))}

              <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-charcoal px-2 mt-4 mb-2">Tools</div>
              {TOOLS.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setSidebarOpen(false) }}
                  className={`w-full text-left px-3 py-2 rounded text-[13px] transition-colors mb-0.5 ${
                    tab === t.id
                      ? 'font-bold text-navy bg-gray100 border-l-[3px] border-orange pl-[9px]'
                      : 'font-medium text-charcoal hover:bg-gray100'
                  }`}
                >
                  {t.label}
                </button>
              ))}

              <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-charcoal px-2 mt-4 mb-2">Analysis</div>
              {['Reports', 'Settings'].map(label => (
                <button
                  key={label}
                  className="w-full text-left px-3 py-2 rounded text-[13px] font-medium text-charcoal hover:bg-gray100 transition-colors mb-0.5"
                >
                  {label}
                </button>
              ))}
            </nav>
            <div className="px-4 py-3.5 border-t border-gray200 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-navy text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
                HC
              </div>
              <div>
                <div className="text-[12px] font-semibold text-navy leading-tight">Hugessen Consulting</div>
                <div className="text-[11px] text-charcoal leading-tight">Analyst</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <header className="bg-white sticky top-0 z-20 border-b border-gray300">
          <div className="px-6">
            <div className="flex items-center h-14">
              <span className="text-navy font-semibold text-sm tracking-wide">
                {HEADER_TITLE[tab]}
              </span>
            </div>
          </div>
        </header>

        <main>
          {tab === 'stip' && <StipPage />}
          {tab === 'ltip' && <LtipPage />}
          {tab === 'benchmarking' && (
            <BenchmarkingErrorBoundary>
              <BenchmarkingModule />
            </BenchmarkingErrorBoundary>
          )}
          {tab === 'aihub' && <AIHubPage />}
        </main>
      </div>
    </div>
  )
}
