import { useMemo, useState } from 'react'
import { AI_HUB_ITEMS, AIHubItem } from './aiHubData'

type Screen = 'foundations' | 'prompts'

const PROMPT_GROUPS = ['Document review', 'Meetings & email', 'Research & analysis', 'Client deliverables', 'Everyday admin']

function matchesSearch(item: AIHubItem, query: string): boolean {
  if (!query) return true
  const hay = [item.title, item.summary, item.prompt, item.steps, item.surface, item.inputs, item.payoff, item.group]
    .filter(Boolean).join(' ').toLowerCase()
  return hay.includes(query.toLowerCase())
}

function SurfaceBadges({ surface }: { surface: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {surface.split(',').map(s => s.trim()).filter(Boolean).map(s => (
        <span key={s} className="text-[10.5px] font-semibold uppercase tracking-wide text-navy bg-gray100 border border-gray300 rounded px-2 py-0.5">
          {s}
        </span>
      ))}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="text-[12px] font-semibold text-white bg-navy hover:bg-navydeep rounded px-3 py-1.5 transition-colors shrink-0"
    >
      {copied ? 'Copied!' : 'Copy prompt'}
    </button>
  )
}

function StepsList({ steps }: { steps: string }) {
  const lines = steps.split('\n').filter(Boolean)
  return (
    <ol className="space-y-1.5 list-decimal list-inside">
      {lines.map((line, i) => (
        <li key={i} className="text-[13.5px] text-ink leading-relaxed">{line}</li>
      ))}
    </ol>
  )
}

function FoundationCard({ item }: { item: AIHubItem }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white border border-gray300 rounded mb-3 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray100/60 transition-colors"
      >
        <div className="min-w-0">
          <h3 className="text-[15.5px] font-semibold text-navy leading-snug">{item.title}</h3>
          <p className="text-[13.5px] text-charcoal mt-1 leading-relaxed">{item.summary}</p>
          <div className="mt-2"><SurfaceBadges surface={item.surface} /></div>
        </div>
        <span className={`text-orange font-bold text-[13px] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-gray200">
          {item.steps && (
            <div className="mt-3">
              <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-orange mb-2">Steps</div>
              <StepsList steps={item.steps} />
            </div>
          )}
          {item.image && (
            <div className="mt-4 border border-gray300 rounded overflow-hidden bg-gray100">
              <img src={item.image} alt={`${item.title} — screenshot`} className="w-full h-auto block" />
            </div>
          )}
          {item.payoff && (
            <div className="mt-4 bg-orange/5 border-l-2 border-orange rounded-r px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-orange mb-1">Why it matters</div>
              <p className="text-[13.5px] text-ink leading-relaxed">{item.payoff}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PromptCard({ item }: { item: AIHubItem }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white border border-gray300 rounded mb-3 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray100/60 transition-colors"
      >
        <div className="min-w-0">
          <h3 className="text-[15.5px] font-semibold text-navy leading-snug">{item.title}</h3>
          <p className="text-[13.5px] text-charcoal mt-1 leading-relaxed">{item.summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SurfaceBadges surface={item.surface} />
            {item.contributor && item.contributor !== 'John' && (
              <span className="text-[11px] text-slate italic">Contributed by {item.contributor}</span>
            )}
          </div>
        </div>
        <span className={`text-orange font-bold text-[13px] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-gray200 space-y-4">
          {item.inputs && (
            <div>
              <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-orange mb-1.5">Inputs</div>
              <p className="text-[13.5px] text-ink leading-relaxed">{item.inputs}</p>
            </div>
          )}
          {item.prompt && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-orange">Prompt</div>
                <CopyButton text={item.prompt} />
              </div>
              <pre className="text-[12px] leading-relaxed text-ink bg-gray100 border border-gray300 rounded p-4 overflow-x-auto whitespace-pre-wrap font-mono max-h-[420px] overflow-y-auto">
                {item.prompt}
              </pre>
            </div>
          )}
          {item.payoff && (
            <div className="bg-orange/5 border-l-2 border-orange rounded-r px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-orange mb-1">Payoff</div>
              <p className="text-[13.5px] text-ink leading-relaxed">{item.payoff}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AIHubPage() {
  const [screen, setScreen] = useState<Screen>('foundations')
  const [query, setQuery] = useState('')
  const [activeGroup, setActiveGroup] = useState<string | null>(null)

  const foundations = useMemo(
    () => AI_HUB_ITEMS.filter(i => i.section === 'foundations' && matchesSearch(i, query)),
    [query]
  )
  const prompts = useMemo(
    () => AI_HUB_ITEMS.filter(i =>
      i.section === 'prompts' &&
      matchesSearch(i, query) &&
      (!activeGroup || i.group === activeGroup)
    ),
    [query, activeGroup]
  )

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-orange font-semibold mb-1">Resources</p>
        <h1 className="text-[30px] leading-tight text-navy font-display">AI Hub</h1>
        <p className="text-[14px] text-charcoal mt-1.5 max-w-2xl leading-relaxed">
          How we're using AI at Hugessen — foundations and prompts shared across the firm.
        </p>
      </div>

      <div className="mb-5">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search foundations and prompts…"
          className="w-full border border-gray300 rounded px-4 py-2.5 text-[14px] text-ink focus:outline-none focus:border-orange"
        />
      </div>

      <div className="flex gap-7 border-b border-gray300 mb-6">
        {([
          { id: 'foundations' as Screen, label: 'Foundations' },
          { id: 'prompts' as Screen, label: 'Prompt Library' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setScreen(t.id)}
            className={`pb-2.5 text-[14px] font-semibold transition-colors border-b-[2.5px] -mb-px ${
              screen === t.id ? 'text-navy border-orange' : 'text-charcoal border-transparent hover:text-navy'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {screen === 'foundations' && (
        <div>
          <p className="text-[13.5px] text-charcoal mb-5 max-w-2xl leading-relaxed">
            Baseline skills that make everything else work better. Start here.
          </p>
          {foundations.length === 0 && (
            <p className="text-[13.5px] text-slate italic">No foundations items match "{query}".</p>
          )}
          {foundations.map(item => <FoundationCard key={item.key} item={item} />)}
        </div>
      )}

      {screen === 'prompts' && (
        <div>
          <p className="text-[13.5px] text-charcoal mb-4 max-w-2xl leading-relaxed">
            Full, detailed prompts built for our work. Copy, paste into Copilot, attach your document, and fill in the bracketed inputs.
          </p>
          <div className="flex flex-wrap gap-2 mb-5">
            <button
              onClick={() => setActiveGroup(null)}
              className={`text-[13px] px-3 py-1.5 rounded border transition-colors ${
                activeGroup === null ? 'bg-navy text-white border-navy' : 'bg-white text-charcoal border-gray300 hover:border-navy'
              }`}
            >
              All
            </button>
            {PROMPT_GROUPS.map(g => (
              <button
                key={g}
                onClick={() => setActiveGroup(g)}
                className={`text-[13px] px-3 py-1.5 rounded border transition-colors ${
                  activeGroup === g ? 'bg-navy text-white border-navy' : 'bg-white text-charcoal border-gray300 hover:border-navy'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          {prompts.length === 0 && (
            <p className="text-[13.5px] text-slate italic">No prompts match{activeGroup ? ` "${activeGroup}"` : ''}{query ? ` and "${query}"` : ''}.</p>
          )}
          {PROMPT_GROUPS.filter(g => !activeGroup || g === activeGroup).map(group => {
            const groupItems = prompts.filter(i => i.group === group)
            if (groupItems.length === 0) return null
            return (
              <div key={group} className="mb-7">
                <h2 className="text-[12px] uppercase tracking-[0.14em] font-semibold text-orange mb-3">{group}</h2>
                {groupItems.map(item => <PromptCard key={item.key} item={item} />)}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
