import { CSSProperties, ReactNode, memo, useMemo, useState } from 'react'
import { AI_HUB_ITEMS, AIHubItem } from './aiHubData'

type Screen = 'foundations' | 'prompts'

const PROMPT_GROUPS = ['Document review', 'Meetings & email', 'Research & analysis', 'Client deliverables', 'Everyday admin']

const GROUP_SUBS: Record<string, string> = {
  'Document review': 'A matched pair: one for the substance of a draft, one for the final polish. Read the guide first.',
  'Meetings & email': 'From call transcripts and crowded inboxes to structured notes and informed replies.',
  'Research & analysis': 'Getting oriented in source material before you form a view.',
  'Client deliverables': 'Support for documents on their way to a client.',
  'Everyday admin': 'The small daily time-savers.',
}

const SURFACES = ['Copilot Chat', 'Word', 'Excel', 'PowerPoint', 'Outlook', 'Teams']

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

function Callout({ children, warn }: { children: ReactNode; warn?: boolean }) {
  return (
    <div className={`px-4 py-3 text-[13.5px] leading-relaxed border-l-[3px] rounded-r ${
      warn ? 'bg-orange/10 border-orange text-ink' : 'bg-gray100 border-charcoal text-charcoal'
    }`}>
      {children}
    </div>
  )
}

const FoundationCard = memo(function FoundationCard({ item }: { item: AIHubItem }) {
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
            <div className="mt-4">
              <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-orange mb-1">Why it matters</div>
              <Callout>{item.payoff}</Callout>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

const PromptCard = memo(function PromptCard({ item }: { item: AIHubItem }) {
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
              <pre
                className="text-[12px] leading-relaxed text-ink bg-gray100 border border-gray300 rounded p-4 overflow-x-auto whitespace-pre-wrap font-mono max-h-[420px] overflow-y-auto"
                style={{ contentVisibility: 'auto', containIntrinsicSize: '0 420px' } as CSSProperties}
              >
                {item.prompt}
              </pre>
            </div>
          )}
          {item.payoff && (
            <div>
              <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-orange mb-1">Payoff</div>
              <Callout>{item.payoff}</Callout>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

function BuildPromptGuideCard() {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white border border-gray300 rounded mb-6 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray100/60 transition-colors"
      >
        <div className="min-w-0">
          <h3 className="text-[15.5px] font-semibold text-navy leading-snug">How to build a good prompt</h3>
          <p className="text-[13.5px] text-charcoal mt-1 leading-relaxed">
            The anatomy of a strong prompt: the GCSE structure we use across the firm, and the five markers that separate strong prompts from weak ones.
          </p>
        </div>
        <span className={`text-orange font-bold text-[13px] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-gray200 space-y-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-orange mb-2">
              The GCSE structure — build every substantive prompt in four parts
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] border border-gray300">
                <thead>
                  <tr className="bg-charcoal text-white">
                    <th className="text-left px-3 py-2 font-bold w-[14%]"></th>
                    <th className="text-left px-3 py-2 font-bold w-[38%]">What to cover</th>
                    <th className="text-left px-3 py-2 font-bold">Example</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray300 align-top">
                    <td className="px-3 py-2 font-bold text-ink">Goal</td>
                    <td className="px-3 py-2 text-ink">The specific thing to produce and what "done" looks like — a precise action verb plus a clear output</td>
                    <td className="px-3 py-2 text-charcoal">"Summarize the CD&amp;A into 5 bullets highlighting risks and year-over-year changes" — not "help with this document"</td>
                  </tr>
                  <tr className="border-t border-gray300 align-top">
                    <td className="px-3 py-2 font-bold text-ink">Context</td>
                    <td className="px-3 py-2 text-ink">Who it's for, the situation, and what matters about it</td>
                    <td className="px-3 py-2 text-charcoal">"Pre-read for a comp committee chair ahead of Thursday's meeting; client is under say-on-pay pressure"</td>
                  </tr>
                  <tr className="border-t border-gray300 align-top">
                    <td className="px-3 py-2 font-bold text-ink">Source</td>
                    <td className="px-3 py-2 text-ink">The material to work from — attach files or reference them with "/" so the output is grounded in real content, not Copilot's guesses (see Foundations)</td>
                    <td className="px-3 py-2 text-charcoal">"/ClientX-2026-circular.pdf, the CD&amp;A section"</td>
                  </tr>
                  <tr className="border-t border-gray300 align-top">
                    <td className="px-3 py-2 font-bold text-ink">Expectation</td>
                    <td className="px-3 py-2 text-ink">Format, tone, and length of the output</td>
                    <td className="px-3 py-2 text-charcoal">"One-page table — topic, disclosure, change vs. prior year; formal tone, board-ready"</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-orange mb-2">
              Strong vs. weak prompts — five markers of a strong one
            </div>
            <ul className="list-disc list-inside space-y-1 text-[13.5px] text-charcoal leading-relaxed">
              <li><strong className="text-ink">Clear goal:</strong> defines exactly what to produce and what "done" looks like</li>
              <li><strong className="text-ink">Relevant context:</strong> specifies audience, situation, and inputs</li>
              <li><strong className="text-ink">Explicit output control:</strong> sets format, tone, and length (e.g., bullets, board-ready)</li>
              <li><strong className="text-ink">Focused scope:</strong> identifies key areas to cover (avoids generic responses)</li>
              <li><strong className="text-ink">Optional constraints/examples:</strong> adds precision for complex or high-stakes outputs</li>
            </ul>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-orange mb-2">
              Don't want to build it by hand? Have Copilot write it
            </div>
            <ul className="list-disc list-inside space-y-1 text-[13.5px] text-charcoal leading-relaxed">
              <li><strong className="text-ink">Ask Copilot to draft the prompt:</strong> describe your task in plain language and ask "write me a strong Copilot prompt for this, structured as Goal, Context, Source, Expectation" — then fill in the specifics and run it</li>
              <li><strong className="text-ink">Or use the Prompt Coach agent:</strong> found in Copilot's agent store — paste a rough prompt and it critiques it against the same principles and suggests a stronger rewrite</li>
              <li>Either way, test the result on real work before trusting it — and if it earns a place in your routine, share it here</li>
            </ul>
          </div>

          <Callout>
            First outputs are drafts, not verdicts. Refine — add context, tighten the scope, adjust the format — and when a prompt consistently works, save it and share it here so others get the benefit.
          </Callout>

          <p className="text-[12.5px] text-slate">
            From the firm's M365 Copilot training session (early 2026). GCSE — Goal, Context, Source, Expectation — is Microsoft's recommended prompt structure for Copilot, and the standard we use in this library.
          </p>
        </div>
      )}
    </div>
  )
}

function ReviewGuideCard() {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white border border-gray300 rounded mb-4 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray100/60 transition-colors"
      >
        <div className="min-w-0">
          <h3 className="text-[15.5px] font-semibold text-navy leading-snug">Which review prompt do I run?</h3>
          <p className="text-[13.5px] text-charcoal mt-1 leading-relaxed">
            Two prompts, two different jobs. Thirty seconds here saves you running the wrong one.
          </p>
        </div>
        <span className={`text-orange font-bold text-[13px] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-gray200 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] border border-gray300">
              <thead>
                <tr className="bg-charcoal text-white">
                  <th className="text-left px-3 py-2 font-bold w-[24%]"></th>
                  <th className="text-left px-3 py-2 font-bold">"Beat-up" Document Review</th>
                  <th className="text-left px-3 py-2 font-bold">Proofreading &amp; Consistency</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray300 align-top">
                  <td className="px-3 py-2 font-bold text-ink">The question it answers</td>
                  <td className="px-3 py-2 text-ink">Is this the <em>right</em> document?</td>
                  <td className="px-3 py-2 text-ink">Is this document <em>ready</em>?</td>
                </tr>
                <tr className="border-t border-gray300 align-top">
                  <td className="px-3 py-2 font-bold text-ink">What it reviews</td>
                  <td className="px-3 py-2 text-charcoal">Argument, audience calibration, structure, tone, actionability</td>
                  <td className="px-3 py-2 text-charcoal">Spelling, grammar, defined terms, math, cross-references, remnants of prior drafts, light clarity</td>
                </tr>
                <tr className="border-t border-gray300 align-top">
                  <td className="px-3 py-2 font-bold text-ink">When to use it</td>
                  <td className="px-3 py-2 text-charcoal">Early to mid-draft — content still evolving</td>
                  <td className="px-3 py-2 text-charcoal">Near-final — content is stable, polishing before it goes out</td>
                </tr>
                <tr className="border-t border-gray300 align-top">
                  <td className="px-3 py-2 font-bold text-ink">What you'll get back</td>
                  <td className="px-3 py-2 text-charcoal">A verdict, prioritized substantive edits, rewrite examples, structural moves</td>
                  <td className="px-3 py-2 text-charcoal">An issue log by location, math check, consistency check, top clarity flags</td>
                </tr>
              </tbody>
            </table>
          </div>

          <Callout>
            Going to a committee, chair, or client and it has to be right? Run both, in order — the "Beat-up" review first, action the substantive edits, then Proofreading as the final pass.
          </Callout>
          <Callout warn>
            <strong>Don't:</strong> run Proofreading on a draft you're still meaningfully changing · run both in parallel or in the same session · default to the biggest prompt on the whole document because it feels safer. Scope down to the section you're worried about, and for short documents tell the prompt "top 5 only."
          </Callout>

          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-orange mb-1">30-second self-check before you run either</div>
            <p className="text-[13.5px] text-charcoal leading-relaxed">
              Audience? (Board / HRCC / Chair / Management / Internal) · Purpose? (decision paper / commentary / benchmarking / other) · Stage? (early / mid / near-final) · Sensitivities? (contested topic, prior pushback, ISS angle) · Scope? (whole document or a section). If you can't answer these, the output will be generic.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AIHubPage() {
  const [screen, setScreen] = useState<Screen>('foundations')
  const [query, setQuery] = useState('')
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [surfFilter, setSurfFilter] = useState<string>('All')

  const foundations = useMemo(
    () => AI_HUB_ITEMS.filter(i =>
      i.section === 'foundations' &&
      matchesSearch(i, query) &&
      (surfFilter === 'All' || (i.surface || '').includes(surfFilter))
    ),
    [query, surfFilter]
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
          <p className="text-[13.5px] text-charcoal mb-4 max-w-2xl leading-relaxed">
            Before the prompts and workflows: a handful of baseline skills that make everything else work better. Start here.
          </p>
          <div className="flex flex-wrap gap-2 mb-5">
            <button
              onClick={() => setSurfFilter('All')}
              className={`text-[13px] px-3 py-1.5 rounded border transition-colors ${
                surfFilter === 'All' ? 'bg-charcoal text-white border-charcoal' : 'bg-white text-charcoal border-gray300 hover:border-navy'
              }`}
            >
              All
            </button>
            {SURFACES.map(s => (
              <button
                key={s}
                onClick={() => setSurfFilter(s)}
                className={`text-[13px] px-3 py-1.5 rounded border transition-colors ${
                  surfFilter === s ? 'bg-charcoal text-white border-charcoal' : 'bg-white text-charcoal border-gray300 hover:border-navy'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {foundations.length === 0 && (
            <p className="text-[13.5px] text-slate italic">Nothing here matches your filter or search.</p>
          )}
          {foundations.map(item => <FoundationCard key={item.key} item={item} />)}
        </div>
      )}

      {screen === 'prompts' && (
        <div>
          <p className="text-[13.5px] text-charcoal mb-4 max-w-2xl leading-relaxed">
            Full, detailed prompts built for our work. Copy, paste into Copilot, attach your document, and fill in the bracketed inputs.
          </p>

          <BuildPromptGuideCard />

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
            if (groupItems.length === 0 && group !== 'Document review') return null
            return (
              <div key={group} className="mb-7">
                <h2 className="text-[12px] uppercase tracking-[0.14em] font-semibold text-orange mb-1">{group}</h2>
                <p className="text-[13px] text-slate mb-3">{GROUP_SUBS[group]}</p>
                {group === 'Document review' && <ReviewGuideCard />}
                {groupItems.length > 0
                  ? groupItems.map(item => <PromptCard key={item.key} item={item} />)
                  : <p className="text-[13.5px] text-slate italic">Nothing here matches your search.</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
