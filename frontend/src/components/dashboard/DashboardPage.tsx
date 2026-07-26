type ToolId = 'aihub' | 'stip' | 'ltip' | 'benchmarking'

interface Tool {
  id: ToolId
  index: string
  name: string
  color: string
  description: string
}

const TOOLS: Tool[] = [
  { id: 'aihub', index: '01', name: 'AI Hub', color: '#3A1408', description: 'Copilot foundations and ready-to-run prompts.' },
  { id: 'stip', index: '02', name: 'STIP Design', color: '#F0531E', description: 'Design a scorecard and simulate bonus payouts against target.' },
  { id: 'ltip', index: '03', name: 'LTIP Design', color: '#F4A578', description: 'Size equity grants and simulate vesting outcomes.' },
  { id: 'benchmarking', index: '04', name: 'Compensation Benchmarking', color: '#5F6269', description: 'Peer pay regression and percentile positioning by role.' },
]

function ToolIcon({ id, color }: { id: ToolId; color: string }) {
  if (id === 'aihub') {
    return (
      <span style={{ width: 16, height: 16, position: 'relative' }}>
        <span style={{ position: 'absolute', inset: 0, border: `2px solid ${color}`, borderRadius: 3, transform: 'rotate(45deg)' }} />
      </span>
    )
  }
  if (id === 'stip') {
    return (
      <span style={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
        <span style={{ width: 3, height: 9, border: `2px solid ${color}`, borderBottom: 'none' }} />
        <span style={{ width: 3, height: 14, border: `2px solid ${color}`, borderBottom: 'none' }} />
        <span style={{ width: 3, height: 19, border: `2px solid ${color}`, borderBottom: 'none' }} />
      </span>
    )
  }
  if (id === 'ltip') {
    return (
      <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
        <polyline points="0,10 4,4 8,12 12,2 16,8 20,1" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    )
  }
  return (
    <span style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', border: `2px solid ${color}` }} />
    </span>
  )
}

export default function DashboardPage({ onNavigate }: { onNavigate: (id: ToolId) => void }) {
  return (
    <div className="px-[60px] pt-9 pb-12 max-w-[1180px]">
      <h1 className="font-display font-normal text-[36px] leading-tight text-orange mb-2">Our Tools</h1>
      <p className="text-[15px] italic text-[#8a8d93] leading-relaxed bg-orange/10 px-6 py-4 rounded-lg mb-8">
        A platform of tools our team uses across executive compensation mandates
      </p>

      <div className="flex mb-3.5">
        {TOOLS.map(tool => (
          <div key={tool.id} className="flex-1 flex justify-center">
            <div className="w-[34px] h-[34px] flex items-center justify-center">
              <ToolIcon id={tool.id} color={tool.color} />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[14px] overflow-hidden shadow-[0_12px_30px_-16px_rgba(0,26,64,0.25)] mb-7 bg-white">
        <div className="flex gap-1">
          {TOOLS.map(tool => (
            <button
              key={tool.id}
              onClick={() => onNavigate(tool.id)}
              style={{ backgroundColor: tool.color }}
              className="flex-1 py-4 px-[22px] flex items-center justify-center gap-2.5 transition-transform duration-150 hover:scale-105 hover:z-10"
            >
              <span className="text-[12px] font-bold text-white/80">{tool.index}</span>
              <span className="text-[13.5px] font-semibold text-white">{tool.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex">
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            onClick={() => onNavigate(tool.id)}
            className="flex-1 px-[22px] text-center"
          >
            <p className="text-[13.5px] text-[#3d4350] leading-relaxed">{tool.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
