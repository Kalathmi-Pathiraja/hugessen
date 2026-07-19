import { useState, useEffect, useRef } from 'react'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Area, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import SectionHeader from '../shared/SectionHeader'
import { ScorecardMetric, MetricBehavior, MetricDirection, MilestoneOutcome, Category, CurveDesign, HistoricalDataRow, DEFAULT_CATEGORIES, METRIC_LIBRARY } from '../../types/stip'

// ── Curve chart helpers (shared with MetricCurvePanel) ─────────────────────
function calcMultiplier(perf: number, c: CurveDesign): number {
  const tPerf = c.threshold_enabled ? c.threshold_perf : 0
  const tPay  = c.threshold_enabled ? c.threshold_payout : 0
  if (perf < tPerf) return 0
  if (perf <= c.target_perf) {
    const d = c.target_perf - tPerf
    return d === 0 ? tPay : tPay + ((perf - tPerf) / d) * (c.target_payout - tPay)
  }
  if (perf <= c.max_perf) {
    const d = c.max_perf - c.target_perf
    return d === 0 ? c.target_payout : c.target_payout + ((perf - c.target_perf) / d) * (c.max_payout - c.target_payout)
  }
  return c.max_payout
}

function buildMiniCurveData(c: CurveDesign) {
  const pts = Array.from({ length: 201 }, (_, i) => ({
    x: i,
    y: parseFloat((calcMultiplier(i / 100, c) * 100).toFixed(2)),
  }))
  if (c.threshold_enabled) {
    const tX = Math.round(c.threshold_perf * 100)
    const idx = pts.findIndex(p => p.x === tX)
    if (idx > 0) pts.splice(idx, 0, { x: tX - 0.001, y: 0 })
  }
  return pts
}

const DEFAULT_CURVE: CurveDesign = {
  threshold_enabled: true,
  threshold_perf: 0.80,
  threshold_payout: 0.50,
  target_perf: 1.00,
  target_payout: 1.00,
  max_perf: 1.20,
  max_payout: 2.00,
}

interface Props {
  metrics: ScorecardMetric[]
  categories: Category[]
  globalDistribution: string
  globalCurve: CurveDesign
  onMetricsChange: (metrics: ScorecardMetric[]) => void
  onCategoriesChange: (categories: Category[]) => void
}

let nextId = 1
function uid() { return `m_${nextId++}` }

export default function ScorecardBuilder({
  metrics, categories, globalDistribution, globalCurve, onMetricsChange, onCategoriesChange,
}: Props) {
  const [editingCatIdx, setEditingCatIdx] = useState<number | null>(null)
  const [editingCatLabel, setEditingCatLabel] = useState('')
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatLabel, setNewCatLabel] = useState('')

  const totalWeight = metrics.reduce((s, m) => s + m.weight, 0)
  const weightOk = Math.abs(totalWeight - 1.0) < 0.001

  // --- Metric operations ---
  function addMetric() {
    const firstCat = categories[0]
    const newMetric: ScorecardMetric = {
      id: uid(),
      name: '',
      category_type: firstCat.type,
      category_label: firstCat.label,
      weight: 0,
      budget_target: 0,
      volatility_sigma: 0.15,
      distribution: undefined,
      metric_behavior: 'continuous',
      gate_probability: undefined,
      metric_direction: 'higher' as MetricDirection,
      simulation_mode: 'relative',
      historical_data: undefined,
      historical_actuals: undefined,
      eagr_sigma_override: undefined,
      curve: undefined,
    }
    onMetricsChange([...metrics, newMetric])
  }

  function updateMetric(id: string, patch: Partial<ScorecardMetric>) {
    onMetricsChange(metrics.map(m => m.id === id ? { ...m, ...patch } : m))
  }

  function removeMetric(id: string) {
    onMetricsChange(metrics.filter(m => m.id !== id))
  }

  // --- Category operations ---
  function startEditCat(idx: number) {
    setEditingCatIdx(idx)
    setEditingCatLabel(categories[idx].label)
  }

  function confirmEditCat() {
    if (editingCatIdx === null) return
    const oldLabel = categories[editingCatIdx].label   // capture before update
    const updated = categories.map((c, i) =>
      i === editingCatIdx ? { ...c, label: editingCatLabel } : c
    )
    onCategoriesChange(updated)
    // Update metrics using the OLD label (unique) — not category_type which may be shared
    onMetricsChange(metrics.map(m =>
      m.category_label === oldLabel
        ? { ...m, category_label: editingCatLabel }
        : m
    ))
    setEditingCatIdx(null)
  }

  function addCategory() {
    if (!newCatLabel.trim()) return
    // New custom categories map to 'individual' type for correlation defaults
    const newCat: Category = { type: 'individual', label: newCatLabel.trim() }
    onCategoriesChange([...categories, newCat])
    setNewCatLabel('')
    setShowAddCat(false)
  }

  function removeCategory(idx: number) {
    const cat = categories[idx]
    // Remove metrics in this category
    onMetricsChange(metrics.filter(m => m.category_type !== cat.type || m.category_label !== cat.label))
    onCategoriesChange(categories.filter((_, i) => i !== idx))
  }

  return (
    <section className="mb-8">
      <SectionHeader
        step={3}
        title="Balanced Scorecard"
        subtitle="Add and weight performance metrics. Weights must sum to exactly 100%."
      />

      {/* Category management */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-navy">Metric Categories</span>
          <button
            onClick={() => setShowAddCat(!showAddCat)}
            className="text-xs text-orange hover:underline font-medium"
          >
            + Add Category
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat, idx) => (
            <div key={idx} className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-lightgrey bg-offwhite">
              {editingCatIdx === idx ? (
                <input
                  autoFocus
                  value={editingCatLabel}
                  onChange={e => setEditingCatLabel(e.target.value)}
                  onBlur={confirmEditCat}
                  onKeyDown={e => e.key === 'Enter' && confirmEditCat()}
                  className="w-32 text-xs border-b border-orange outline-none bg-transparent text-navy"
                />
              ) : (
                <span
                  className="text-xs font-medium text-navy cursor-pointer hover:text-orange transition-colors"
                  onClick={() => startEditCat(idx)}
                  title="Click to rename"
                >
                  {cat.label}
                </span>
              )}
              <button
                onClick={() => removeCategory(idx)}
                className="ml-1 text-slate hover:text-orange text-xs leading-none"
                title="Remove category"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {showAddCat && (
          <div className="mt-2 flex gap-2">
            <input
              autoFocus
              placeholder="New category name..."
              value={newCatLabel}
              onChange={e => setNewCatLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCategory()}
              className="flex-1 px-3 py-1.5 text-sm border border-orange rounded outline-none text-navy"
            />
            <button onClick={addCategory} className="px-3 py-1.5 bg-orange text-white text-sm rounded font-medium">Add</button>
            <button onClick={() => setShowAddCat(false)} className="px-3 py-1.5 text-slate text-sm">Cancel</button>
          </div>
        )}
      </div>

      {/* Weight summary */}
      <div className={`flex items-center justify-between px-4 py-2 rounded mb-4 ${
        weightOk ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
      }`}>
        <span className="text-sm font-medium text-navy">Total Weight</span>
        <span className={`text-lg font-bold ${weightOk ? 'text-green-700' : 'text-red-600'}`}>
          {(totalWeight * 100).toFixed(1)}%
          {!weightOk && <span className="text-xs font-normal ml-2">— must equal 100%</span>}
        </span>
      </div>

      {/* Metric rows */}
      <div className="space-y-3">
        {metrics.map(metric => (
          <MetricRow
            key={metric.id}
            metric={metric}
            categories={categories}
            globalDistribution={globalDistribution}
            globalCurve={globalCurve}
            onUpdate={patch => updateMetric(metric.id, patch)}
            onRemove={() => removeMetric(metric.id)}
          />
        ))}
      </div>

      <button
        onClick={addMetric}
        className="mt-4 w-full py-2.5 border-2 border-dashed border-lightgrey rounded
                   text-slate text-sm font-medium hover:border-orange hover:text-orange transition-colors"
      >
        + Add Metric
      </button>
    </section>
  )
}

// -----------------------------------------------------------------------
// NumericInput — controlled input that lets the user type freely without
// the "can't delete the zero" / "resets on every keystroke" problem.
//
// How it works:
//   • Maintains a LOCAL string state that follows the keyboard exactly.
//   • Calls onChange(storeValue) only when the string parses to a valid number.
//   • On blur, commits and normalises back to the canonical display string.
//   • `scale`: multiply the storeValue by this to get the displayed number.
//     e.g. scale=100 for %-inputs (store 0.25, display 25).
// -----------------------------------------------------------------------
function NumericInput({
  storeValue,
  scale = 1,
  onChange,
  className,
  min,
  max,
  step,
  disabled,
  placeholder,
}: {
  storeValue: number
  scale?: number
  onChange: (v: number) => void
  className?: string
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  placeholder?: string
}) {
  const toStr = (v: number) => (v === 0 ? '' : String(+(v * scale).toFixed(10).replace(/\.?0+$/, '')))
  const [str, setStr] = useState(() => toStr(storeValue))
  const lastCommit = useRef(storeValue)

  // Sync if parent resets the value from outside (e.g. switching to gate resets weight → 0)
  useEffect(() => {
    if (storeValue !== lastCommit.current) {
      setStr(toStr(storeValue))
      lastCommit.current = storeValue
    }
  }, [storeValue]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      type="text"
      inputMode="decimal"
      value={str}
      placeholder={placeholder ?? '0'}
      disabled={disabled}
      className={className}
      onChange={e => {
        const raw = e.target.value
        // Allow typing in-progress values (leading minus, trailing dot, etc.)
        setStr(raw)
        const n = parseFloat(raw)
        if (!isNaN(n)) {
          const clamped = min !== undefined && n < min ? min
                        : max !== undefined && n > max ? max
                        : n
          lastCommit.current = clamped / scale
          onChange(clamped / scale)
        }
      }}
      onBlur={() => {
        const n = parseFloat(str)
        const raw = isNaN(n) ? 0 : n
        const clamped = min !== undefined && raw < min ? min
                      : max !== undefined && raw > max ? max
                      : raw
        const final = clamped / scale
        lastCommit.current = final
        onChange(final)
        setStr(toStr(final))
      }}
    />
  )
}

// -----------------------------------------------------------------------
// Single metric row
// -----------------------------------------------------------------------
interface MetricRowProps {
  metric: ScorecardMetric
  categories: Category[]
  globalDistribution: string
  globalCurve: CurveDesign
  onUpdate: (patch: Partial<ScorecardMetric>) => void
  onRemove: () => void
}

const DEFAULT_MILESTONE_OUTCOMES: MilestoneOutcome[] = [
  { label: 'Miss',    probability: 0.20, achievement: 0.0 },
  { label: 'Partial', probability: 0.30, achievement: 0.7 },
  { label: 'Hit',     probability: 0.50, achievement: 1.0 },
]

// Behaviour labels shown in the dropdown
const BEHAVIOR_OPTIONS: { value: MetricBehavior; label: string; hint: string }[] = [
  { value: 'continuous',    label: 'Financial',        hint: 'Lognormal / normal continuous distribution' },
  { value: 'individual',    label: 'Individual',       hint: 'Normal with floor — board discretionary scores' },
  { value: 'safety_capped', label: 'Safety — Cap',     hint: 'Normal/lognormal capped at 100% target, no upside' },
  { value: 'safety_gate',   label: 'Safety — Gate',    hint: 'Binary: fires with set probability → zeroes entire payout' },
  { value: 'milestone',     label: 'Milestone / ESG',  hint: 'Discrete probability-weighted outcomes — no continuous variance' },
]

function MetricRow({ metric, categories, globalDistribution, globalCurve, onUpdate, onRemove }: MetricRowProps) {
  const [customName, setCustomName] = useState(!METRIC_LIBRARY[metric.category_type]?.includes(metric.name))

  const catMetrics = METRIC_LIBRARY[metric.category_type] ?? []
  const isGate = metric.metric_behavior === 'safety_gate'

  function handleCategoryChange(catLabel: string) {
    const cat = categories.find(c => c.label === catLabel)   // unique: find by label
    if (!cat) return
    onUpdate({ category_type: cat.type as ScorecardMetric['category_type'], category_label: cat.label, name: '' })
    setCustomName(false)
  }

  function handleBehaviorChange(b: MetricBehavior) {
    const patch: Partial<ScorecardMetric> = { metric_behavior: b }
    if (b === 'safety_gate') patch.weight = 0
    // Pre-populate default milestone outcomes the first time it's selected
    if (b === 'milestone' && (!metric.milestone_outcomes || metric.milestone_outcomes.length === 0)) {
      patch.milestone_outcomes = DEFAULT_MILESTONE_OUTCOMES.map(o => ({ ...o }))
    }
    onUpdate(patch)
  }

  // ── Milestone outcome helpers ──
  function updateOutcome(idx: number, field: keyof MilestoneOutcome, value: string | number) {
    const updated = (metric.milestone_outcomes ?? []).map((o, i) =>
      i === idx ? { ...o, [field]: value } : o
    )
    onUpdate({ milestone_outcomes: updated })
  }
  function addOutcome() {
    const existing = metric.milestone_outcomes ?? []
    if (existing.length >= 5) return
    onUpdate({ milestone_outcomes: [...existing, { label: '', probability: 0, achievement: 1.0 }] })
  }
  function removeOutcome(idx: number) {
    onUpdate({ milestone_outcomes: (metric.milestone_outcomes ?? []).filter((_, i) => i !== idx) })
  }

  const isMilestone = metric.metric_behavior === 'milestone'
  const isTD = metric.simulation_mode === 'target_difficulty'
  const outcomes = metric.milestone_outcomes ?? []
  const totalProb = outcomes.reduce((s, o) => s + Number(o.probability), 0)
  const probOk = Math.abs(totalProb - 1.0) < 0.011

  return (
    <div className={`bg-white border rounded hover:border-slate transition-colors ${
      isGate ? 'border-orange/40 bg-orange/5'
      : isMilestone ? 'border-teal-300/60 bg-teal-50/20'
      : 'border-lightgrey'
    }`}>

      {/* ── Main metric row ── */}
      <div className="grid grid-cols-12 gap-2 p-3 items-start">

        {/* Category — col 2 */}
        <div className="col-span-2">
          <label className="block text-xs text-slate mb-1">Category</label>
          <select
            value={metric.category_label}
            onChange={e => handleCategoryChange(e.target.value)}
            className="w-full text-xs px-2 py-1.5 border border-lightgrey rounded text-navy focus:outline-none focus:ring-1 focus:ring-orange"
          >
            {categories.map((c, i) => (
              <option key={i} value={c.label}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Metric name — col 2 */}
        <div className="col-span-2">
          <label className="block text-xs text-slate mb-1">
            Metric
            <button
              onClick={() => setCustomName(!customName)}
              className="ml-2 text-orange hover:underline"
            >
              {customName ? '← List' : 'Custom'}
            </button>
          </label>
          {customName ? (
            <input
              placeholder="e.g. EBITDA"
              value={metric.name}
              onChange={e => onUpdate({ name: e.target.value })}
              className="w-full text-xs px-2 py-1.5 border border-lightgrey rounded text-navy focus:outline-none focus:ring-1 focus:ring-orange"
            />
          ) : (
            <select
              value={metric.name}
              onChange={e => onUpdate({ name: e.target.value })}
              className="w-full text-xs px-2 py-1.5 border border-lightgrey rounded text-navy focus:outline-none focus:ring-1 focus:ring-orange"
            >
              <option value="">Select...</option>
              {catMetrics.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
        </div>

        {/* Weight — col 1 */}
        <div className="col-span-1">
          <label className="block text-xs text-slate mb-1">Weight</label>
          <div className="relative">
            <NumericInput
              storeValue={isGate ? 0 : metric.weight}
              scale={100}
              min={0} max={100} step={5}
              disabled={isGate}
              onChange={v => onUpdate({ weight: v })}
              className={`w-full text-xs px-2 py-1.5 pr-5 border border-lightgrey rounded text-navy focus:outline-none focus:ring-1 focus:ring-orange ${
                isGate ? 'opacity-40 cursor-not-allowed bg-lightgrey' : ''
              }`}
            />
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-slate pointer-events-none">%</span>
          </div>
        </div>

        {/* Budget target — col 2 */}
        <div className="col-span-2">
          <label className="block text-xs text-slate mb-1">Budget / Target</label>
          <NumericInput
            storeValue={metric.budget_target}
            scale={1}
            min={0}
            disabled={isGate}
            onChange={v => onUpdate({ budget_target: v })}
            className={`w-full text-xs px-2 py-1.5 border border-lightgrey rounded text-navy focus:outline-none focus:ring-1 focus:ring-orange ${
              isGate ? 'opacity-40 cursor-not-allowed bg-lightgrey' : ''
            }`}
          />
        </div>

        {/* Volatility σ — col 1 */}
        <div className="col-span-1">
          <label className="block text-xs text-slate mb-1" title={isTD ? 'σ is inferred from historical actuals in Target Difficulty mode. Override in the panel below.' : ''}>
            σ {isTD && <span className="text-orange text-xs">🔒</span>}
          </label>
          <div className="relative">
            <NumericInput
              storeValue={metric.volatility_sigma}
              scale={100}
              min={1} max={100} step={1}
              disabled={isGate || isMilestone || isTD}
              onChange={v => onUpdate({ volatility_sigma: v })}
              className={`w-full text-xs px-2 py-1.5 pr-5 border border-lightgrey rounded text-navy focus:outline-none focus:ring-1 focus:ring-orange ${
                (isGate || isMilestone || isTD) ? 'opacity-40 cursor-not-allowed bg-lightgrey' : ''
              }`}
            />
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-slate pointer-events-none">%</span>
          </div>
        </div>

        {/* Behavior — col 3 */}
        <div className="col-span-3">
          <label className="block text-xs text-slate mb-1">Behavior</label>
          <select
            value={metric.metric_behavior ?? 'continuous'}
            onChange={e => handleBehaviorChange(e.target.value as MetricBehavior)}
            className="w-full text-xs px-2 py-1.5 border border-lightgrey rounded text-navy focus:outline-none focus:ring-1 focus:ring-orange mb-1"
          >
            {BEHAVIOR_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Conditional sub-fields */}
          {metric.metric_behavior === 'continuous' && (
            <select
              value={metric.distribution ?? ''}
              onChange={e => onUpdate({ distribution: e.target.value || undefined })}
              className="w-full text-xs px-2 py-1 border border-lightgrey rounded text-slate focus:outline-none focus:ring-1 focus:ring-orange"
            >
              <option value="">Distribution: Global</option>
              <option value="lognormal">Log-normal</option>
              <option value="normal">Normal</option>
            </select>
          )}

          {isGate && (
            <div className="flex items-center gap-1 mt-1">
              <NumericInput
                storeValue={metric.gate_probability ?? 0}
                scale={100}
                min={0} max={100} step={0.5}
                placeholder="e.g. 3"
                onChange={v => onUpdate({ gate_probability: v })}
                className="w-16 text-xs px-2 py-1 border border-orange/60 rounded text-navy focus:outline-none focus:ring-1 focus:ring-orange"
              />
              <span className="text-xs text-slate">% annual incident prob.</span>
            </div>
          )}

          {(metric.metric_behavior === 'safety_capped' || metric.metric_behavior === 'individual') && (
            <p className="text-xs text-slate/70 mt-1 leading-snug">
              {metric.metric_behavior === 'safety_capped'
                ? 'Payout capped at 100% — no upside beyond target'
                : 'Normal dist. with floor — prevents unrealistically low tail'}
            </p>
          )}

          {isMilestone && (
            <p className="text-xs text-teal-600/80 mt-1 leading-snug">
              Define outcomes below ↓ — σ ignored
            </p>
          )}

          {/* Direction toggle — only for non-gate, non-milestone */}
          {!isGate && !isMilestone && (
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-xs text-slate mr-0.5">Direction:</span>
              {(['higher', 'lower'] as MetricDirection[]).map(d => (
                <button
                  key={d}
                  onClick={() => onUpdate({ metric_direction: d })}
                  title={d === 'higher' ? 'Higher achievement = better (revenue, EBITDA…)' : 'Lower achievement = better (costs, incidents, debt…)'}
                  className={`px-2 py-0.5 text-xs rounded border transition-all ${
                    (metric.metric_direction ?? 'higher') === d
                      ? 'bg-navy text-white border-navy font-semibold'
                      : 'bg-white text-slate border-lightgrey hover:border-navy'
                  }`}
                >
                  {d === 'higher' ? '↑ Higher' : '↓ Lower'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Remove — col 1 */}
        <div className="col-span-1 flex justify-center pt-4">
          <button
            onClick={onRemove}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate hover:bg-red-50 hover:text-red-500 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>

      {/* ── Per-metric curve editor ── */}
      {!isGate && !isMilestone && (
        <MetricCurvePanel
          curve={metric.curve}
          globalCurve={globalCurve}
          onSave={c => onUpdate({ curve: c })}
          onClear={() => onUpdate({ curve: undefined })}
        />
      )}

      {/* ── Target difficulty panel ── */}
      {!isGate && !isMilestone && (
        <TargetDifficultyPanel
          mode={metric.simulation_mode ?? 'relative'}
          historicalData={metric.historical_data ?? []}
          budgetTarget={metric.budget_target}
          sigmaOverride={metric.eagr_sigma_override}
          gOverride={metric.eagr_g_override}
          onModeChange={m => onUpdate({ simulation_mode: m })}
          onDataChange={d => onUpdate({ historical_data: d })}
          onSigmaOverrideChange={s => onUpdate({ eagr_sigma_override: s })}
          onGOverrideChange={g => onUpdate({ eagr_g_override: g })}
        />
      )}

      {/* ── Milestone outcomes editor ── */}
      {isMilestone && (
        <div className="px-3 pb-3 border-t border-teal-200/60">
          {/* Header row */}
          <div className="flex items-center justify-between mt-2 mb-2">
            <span className="text-xs font-semibold text-navy">Discrete Outcomes</span>
            <span className={`text-xs font-medium ${probOk ? 'text-green-600' : 'text-red-500'}`}>
              Probability total: {(totalProb * 100).toFixed(0)}%
              {!probOk && <span className="ml-1 font-normal">— must equal 100%</span>}
            </span>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-12 gap-2 px-1 mb-1">
            <div className="col-span-4 text-xs text-slate">Outcome label</div>
            <div className="col-span-3 text-xs text-slate text-center">Probability (%)</div>
            <div className="col-span-3 text-xs text-slate text-center">Achievement (%)</div>
            <div className="col-span-2" />
          </div>

          {/* Outcome rows */}
          <div className="space-y-1.5">
            {outcomes.map((outcome, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                {/* Label */}
                <div className="col-span-4">
                  <input
                    placeholder="e.g. Exceeded"
                    value={outcome.label}
                    onChange={e => updateOutcome(idx, 'label', e.target.value)}
                    className="w-full text-xs px-2 py-1 border border-lightgrey rounded text-navy focus:outline-none focus:ring-1 focus:ring-orange"
                  />
                </div>
                {/* Probability */}
                <div className="col-span-3">
                  <NumericInput
                    storeValue={outcome.probability}
                    scale={100}
                    min={0} max={100} step={5}
                    onChange={v => updateOutcome(idx, 'probability', v)}
                    className="w-full text-xs px-2 py-1 border border-lightgrey rounded text-navy text-center focus:outline-none focus:ring-1 focus:ring-orange"
                  />
                </div>
                {/* Achievement */}
                <div className="col-span-3">
                  <NumericInput
                    storeValue={outcome.achievement}
                    scale={100}
                    min={0} max={200} step={5}
                    onChange={v => updateOutcome(idx, 'achievement', v)}
                    className="w-full text-xs px-2 py-1 border border-lightgrey rounded text-navy text-center focus:outline-none focus:ring-1 focus:ring-orange"
                  />
                </div>
                {/* Remove */}
                <div className="col-span-2 flex justify-center">
                  {outcomes.length > 2 && (
                    <button
                      onClick={() => removeOutcome(idx)}
                      className="text-slate hover:text-red-500 text-base leading-none transition-colors"
                      title="Remove outcome"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add outcome */}
          {outcomes.length < 5 && (
            <button
              onClick={addOutcome}
              className="mt-2 text-xs text-orange hover:underline font-medium"
            >
              + Add Outcome
            </button>
          )}
        </div>
      )}

    </div>
  )
}


// -----------------------------------------------------------------------
// MetricCurvePanel — inline per-metric curve override with mini chart
// -----------------------------------------------------------------------
function MetricCurvePanel({
  curve, globalCurve, onSave, onClear,
}: {
  curve?: CurveDesign
  globalCurve: CurveDesign
  onSave: (c: CurveDesign) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  // When no override, mirror the actual global curve from Section 2
  const active = curve ?? globalCurve
  const hasOverride = !!curve
  const data = buildMiniCurveData(active)
  const yMax = Math.ceil(active.max_payout * 100 * 1.15 / 50) * 50

  function upd(patch: Partial<CurveDesign>) {
    onSave({ ...active, ...patch })
  }

  return (
    <div className="border-t border-lightgrey">
      {/* Header — div (not button) to avoid nested-button HTML warning */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate hover:text-navy transition-colors cursor-pointer select-none"
      >
        <span className="flex items-center gap-2">
          <span className={`transition-transform inline-block ${open ? 'rotate-90' : ''}`}>▶</span>
          <span className="font-medium">
            Payout Curve
            {hasOverride && <span className="ml-2 text-orange font-semibold">● Custom</span>}
            {!hasOverride && <span className="ml-2 text-slate/60">Using global curve</span>}
          </span>
        </span>
        {hasOverride && (
          <button
            onClick={e => { e.stopPropagation(); onClear() }}
            className="text-xs text-red-400 hover:text-red-600 px-1"
          >
            Reset to global
          </button>
        )}
      </div>

      {open && (
        <div className="px-3 pb-3 bg-offwhite/50 space-y-3">

          {/* ── Mini live chart ── */}
          <div className="bg-white rounded border border-lightgrey" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 14, right: 16, left: -8, bottom: 28 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DFE1DF" />
                <XAxis
                  dataKey="x" type="number" domain={[0, 200]}
                  tickFormatter={v => `${v}%`}
                  ticks={[0, 50, 80, 100, 120, 150, 200]}
                  tick={{ fontSize: 10, fill: '#464B54' }}
                  label={{ value: 'Performance Achievement (%)', position: 'insideBottom', offset: -18, fill: '#464B54', fontSize: 10 }}
                />
                <YAxis
                  domain={[0, yMax]}
                  tickFormatter={v => `${v}%`}
                  tick={{ fontSize: 10, fill: '#464B54' }}
                  label={{ value: 'Payout (%)', angle: -90, position: 'insideLeft', offset: 16, fill: '#464B54', fontSize: 10 }}
                />
                <Tooltip
                  content={({ active: a, payload, label }) =>
                    a && payload?.length ? (
                      <div className="bg-navy text-white px-2 py-1 rounded text-xs shadow">
                        {label}% perf → {(payload[0].value as number).toFixed(1)}% payout
                      </div>
                    ) : null
                  }
                  cursor={{ stroke: '#464B54', strokeWidth: 1, strokeDasharray: '3 2' }}
                />
                <Area type="linear" dataKey="y" fill="#F0531E" fillOpacity={0.08} stroke="none" isAnimationActive={false} />
                <Line type="linear" dataKey="y" stroke="#F0531E" strokeWidth={2} dot={false} isAnimationActive={false} />
                <ReferenceLine x={100} stroke="#002957" strokeWidth={1.5}
                  label={{ value: '100%', position: 'top', fill: '#002957', fontSize: 9, fontWeight: 600 }} />
                {active.threshold_enabled && (
                  <ReferenceLine
                    x={Math.round(active.threshold_perf * 100)}
                    stroke="#464B54" strokeWidth={1} strokeDasharray="5 3"
                    label={{ value: 'Thr', position: 'top', fill: '#464B54', fontSize: 9 }}
                  />
                )}
                <ReferenceLine
                  x={Math.round(active.max_perf * 100)}
                  stroke="#002957" strokeWidth={1} strokeDasharray="3 3" opacity={0.4}
                  label={{ value: 'Cap', position: 'top', fill: '#464B54', fontSize: 9 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* ── Threshold toggle ── */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={active.threshold_enabled}
              onChange={e => upd({ threshold_enabled: e.target.checked })}
              className="accent-orange"
            />
            <span className="text-xs font-medium text-navy">Zero-pay threshold enabled</span>
          </label>

          {/* ── Slider controls ── */}
          <div className="grid grid-cols-3 gap-2">

            {/* Threshold */}
            {active.threshold_enabled ? (
              <div className="p-2.5 rounded border border-lightgrey bg-white space-y-2">
                <div className="text-xs font-semibold text-navy">Threshold</div>
                <div>
                  <div className="flex justify-between text-xs text-slate mb-0.5">
                    <span>Perf</span><span className="font-bold text-navy">{Math.round(active.threshold_perf * 100)}%</span>
                  </div>
                  <input type="range" min={50} max={99} step={1}
                    value={Math.round(active.threshold_perf * 100)}
                    onChange={e => upd({ threshold_perf: +e.target.value / 100 })}
                    className="w-full accent-orange" />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate mb-0.5">
                    <span>Payout</span><span className="font-bold text-navy">{Math.round(active.threshold_payout * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={99} step={5}
                    value={Math.round(active.threshold_payout * 100)}
                    onChange={e => upd({ threshold_payout: +e.target.value / 100 })}
                    className="w-full accent-orange" />
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded border border-dashed border-lightgrey bg-white/40 flex items-center justify-center">
                <span className="text-xs text-slate/50 text-center leading-relaxed">Threshold<br/>disabled</span>
              </div>
            )}

            {/* Target — locked at 100% perf, payout editable */}
            <div className="p-2.5 rounded border border-lightgrey bg-offwhite space-y-2">
              <div className="text-xs font-semibold text-navy">Target</div>
              <div className="text-xs text-slate">Perf: <span className="font-bold text-navy">100%</span> (locked)</div>
              <div>
                <div className="flex justify-between text-xs text-slate mb-0.5">
                  <span>Payout</span><span className="font-bold text-navy">{Math.round(active.target_payout * 100)}%</span>
                </div>
                <input type="range" min={50} max={200} step={5}
                  value={Math.round(active.target_payout * 100)}
                  onChange={e => upd({ target_payout: +e.target.value / 100 })}
                  className="w-full accent-orange" />
              </div>
            </div>

            {/* Maximum */}
            <div className="p-2.5 rounded border border-lightgrey bg-white space-y-2">
              <div className="text-xs font-semibold text-navy">Maximum</div>
              <div>
                <div className="flex justify-between text-xs text-slate mb-0.5">
                  <span>Perf</span><span className="font-bold text-navy">{Math.round(active.max_perf * 100)}%</span>
                </div>
                <input type="range" min={101} max={200} step={1}
                  value={Math.round(active.max_perf * 100)}
                  onChange={e => upd({ max_perf: +e.target.value / 100 })}
                  className="w-full accent-orange" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate mb-0.5">
                  <span>Payout</span><span className="font-bold text-navy">{Math.round(active.max_payout * 100)}%</span>
                </div>
                <input type="range" min={100} max={400} step={5}
                  value={Math.round(active.max_payout * 100)}
                  onChange={e => upd({ max_payout: +e.target.value / 100 })}
                  className="w-full accent-orange" />
              </div>
            </div>
          </div>

          {!hasOverride && (
            <button
              onClick={() => onSave({ ...globalCurve })}
              className="text-xs text-orange hover:underline font-medium"
            >
              Create metric-specific curve (starts from global)
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------
// TargetDifficultyPanel — toggle + year/value table + lookback + σ override
// -----------------------------------------------------------------------
function TargetDifficultyPanel({
  mode, historicalData, budgetTarget, sigmaOverride, gOverride,
  onModeChange, onDataChange, onSigmaOverrideChange, onGOverrideChange,
}: {
  mode: 'relative' | 'target_difficulty'
  historicalData: HistoricalDataRow[]
  budgetTarget: number
  sigmaOverride?: number
  gOverride?: number
  onModeChange: (m: 'relative' | 'target_difficulty') => void
  onDataChange: (d: HistoricalDataRow[]) => void
  onSigmaOverrideChange: (s: number | undefined) => void
  onGOverrideChange: (g: number | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const isActive = mode === 'target_difficulty'
  const [sigmaStr, setSigmaStr] = useState(
    sigmaOverride != null ? (sigmaOverride * 100).toFixed(2) : ''
  )
  const [gStr, setGStr] = useState(
    gOverride != null ? (gOverride * 100).toFixed(2) : ''
  )

  useEffect(() => { if (mode === 'target_difficulty') setOpen(true) }, [mode])

  // ── Table helpers ─────────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear()

  function addRow() {
    const earliestYear = historicalData.length > 0
      ? Math.min(...historicalData.map(r => r.year))
      : currentYear + 1
    onDataChange([{ year: earliestYear - 1, value: 0, included: true }, ...historicalData])
  }

  function removeRow(idx: number) {
    onDataChange(historicalData.filter((_, i) => i !== idx))
  }

  function updateRow(idx: number, patch: Partial<HistoricalDataRow>) {
    onDataChange(historicalData.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  // Apply a lookback preset — set included flags for the most recent N rows
  function applyLookback(n: number | 'all') {
    const sorted = [...historicalData].sort((a, b) => a.year - b.year)
    const cutoff = n === 'all' ? 0 : sorted.length - n
    onDataChange(sorted.map((r, i) => ({ ...r, included: i >= cutoff })))
  }

  // ── Infer g / σ from included rows ────────────────────────────────────────
  const included = [...historicalData]
    .filter(r => r.included && r.value !== 0)
    .sort((a, b) => a.year - b.year)
  const includedValues = included.map(r => r.value)

  let inferredG: number | null = null
  let inferredSigma: number | null = null
  let impliedAch: number | null = null
  if (includedValues.length >= 2) {
    const yoy = includedValues.slice(1).map((v, i) => (v - includedValues[i]) / Math.abs(includedValues[i]))
    inferredG = yoy.reduce((a, b) => a + b, 0) / yoy.length
    const mean = inferredG
    inferredSigma = Math.sqrt(yoy.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(yoy.length - 1, 1))
    const X0 = includedValues[includedValues.length - 1]
    impliedAch = budgetTarget > 0 ? (X0 + X0 * inferredG) / budgetTarget : null
  }

  const includedCount = included.length
  const includedYears = included.length >= 2
    ? `${included[0].year}–${included[included.length - 1].year}`
    : ''

  return (
    <div className="border-t border-lightgrey">
      <div
        role="button" tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate hover:text-navy transition-colors cursor-pointer select-none"
      >
        <span className="flex items-center gap-2">
          <span className={`transition-transform inline-block ${open ? 'rotate-90' : ''}`}>▶</span>
          <span className="font-medium">
            Simulation Mode
            {isActive && includedCount >= 2 && (
              <span className="ml-2 text-teal-600 font-semibold">
                ● Target Difficulty (EAGR) — {includedCount} pts {includedYears}
              </span>
            )}
            {isActive && includedCount < 2 && (
              <span className="ml-2 text-red-500 font-semibold">⚠ Target Difficulty — add historical data below</span>
            )}
            {!isActive && <span className="ml-2 text-slate/60">Relative (σ centred at target)</span>}
          </span>
        </span>
      </div>

      {open && (
        <div className="px-3 pb-4 bg-offwhite/50 space-y-3">
          {/* Mode toggle */}
          <div className="flex gap-2">
            {(['relative', 'target_difficulty'] as const).map(opt => (
              <button key={opt} onClick={() => onModeChange(opt)}
                className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
                  mode === opt ? 'bg-navy text-white border-navy' : 'bg-white text-slate border-lightgrey hover:border-navy'
                }`}
              >
                {opt === 'relative' ? 'Relative' : 'Test Target Difficulty'}
              </button>
            ))}
          </div>

          {isActive && (
            <div className="space-y-3">

              {/* ── Historical data table ── */}
              <div className="bg-white rounded border border-lightgrey overflow-hidden">
                {/* Table header + controls */}
                <div className="flex items-center justify-between px-3 py-2 bg-navy/5 border-b border-lightgrey">
                  <span className="text-xs font-semibold text-navy">Historical Actuals</span>
                  <div className="flex items-center gap-2">
                    {/* Lookback presets */}
                    <span className="text-xs text-slate">Lookback:</span>
                    {(['all', 3, 5, 7] as const).map(n => (
                      <button key={n} onClick={() => applyLookback(n)}
                        className="px-2 py-0.5 text-xs rounded border border-lightgrey bg-white hover:border-orange hover:text-orange transition-colors"
                      >
                        {n === 'all' ? 'All' : `${n}yr`}
                      </button>
                    ))}
                    <button onClick={addRow}
                      className="ml-1 px-2 py-0.5 text-xs rounded bg-orange text-white font-semibold hover:bg-orange/90 transition-colors"
                    >
                      + Add Row
                    </button>
                  </div>
                </div>

                {historicalData.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-slate italic">
                    No data yet — click "+ Add Row" to start
                  </div>
                ) : (
                  <div>
                    {/* Column headers */}
                    <div className="grid grid-cols-12 gap-1 px-3 py-1.5 border-b border-lightgrey bg-offwhite/60 text-xs text-slate font-medium">
                      <div className="col-span-3">Year</div>
                      <div className="col-span-5">Value</div>
                      <div className="col-span-3 text-center">Use in calc</div>
                      <div className="col-span-1" />
                    </div>
                    {/* Rows in stable insertion order — sorted only for computation, not display */}
                    {historicalData.map((row, idx) => (
                          <div
                            key={idx}
                            className={`grid grid-cols-12 gap-1 px-3 py-1 items-center border-b border-lightgrey/50 last:border-0 ${
                              row.included ? 'bg-white' : 'bg-slate/5'
                            }`}
                          >
                            {/* Year */}
                            <div className="col-span-3">
                              <input
                                type="number" min={1990} max={2100} step={1}
                                value={row.year}
                                onChange={e => updateRow(idx, { year: parseInt(e.target.value) || row.year })}
                                className="w-full text-xs px-2 py-1 border border-lightgrey rounded text-navy focus:outline-none focus:ring-1 focus:ring-orange"
                              />
                            </div>
                            {/* Value */}
                            <div className="col-span-5">
                              <input
                                type="number" step="any"
                                value={row.value === 0 ? '' : row.value}
                                placeholder="0"
                                onChange={e => updateRow(idx, { value: parseFloat(e.target.value) || 0 })}
                                className="w-full text-xs px-2 py-1 border border-lightgrey rounded text-navy focus:outline-none focus:ring-1 focus:ring-orange font-mono"
                              />
                            </div>
                            {/* Include checkbox */}
                            <div className="col-span-3 flex justify-center">
                              <input
                                type="checkbox"
                                checked={row.included}
                                onChange={e => updateRow(idx, { included: e.target.checked })}
                                className="accent-orange w-4 h-4"
                              />
                            </div>
                            {/* Delete */}
                            <div className="col-span-1 flex justify-center">
                              <button
                                onClick={() => removeRow(idx)}
                                className="text-slate hover:text-red-500 transition-colors text-base leading-none"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                  </div>
                )}

                {/* Lookback summary */}
                {historicalData.length > 0 && (
                  <div className="px-3 py-1.5 bg-offwhite/60 border-t border-lightgrey text-xs text-slate">
                    {includedCount} of {historicalData.length} rows included in calculation
                    {includedYears ? ` (${includedYears})` : ''}
                  </div>
                )}
              </div>

              {/* ── Inferred parameters ── */}
              {includedCount >= 2 && inferredG !== null && inferredSigma !== null && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-white rounded border border-lightgrey text-center">
                    <div className="text-xs text-slate">Inferred growth (g)</div>
                    <div className="text-sm font-bold text-navy">{(inferredG * 100).toFixed(1)}%/yr</div>
                    {gOverride == null ? (
                      <button
                        onClick={() => {
                          setGStr((inferredG! * 100).toFixed(2))
                          onGOverrideChange(inferredG!)
                        }}
                        className="text-xs text-orange hover:underline"
                      >
                        Override →
                      </button>
                    ) : (
                      <div className="text-xs text-slate/60">{includedYears}</div>
                    )}
                  </div>
                  <div className="p-2 bg-white rounded border border-lightgrey text-center">
                    <div className="text-xs text-slate">Inferred volatility (σ)</div>
                    <div className="text-sm font-bold text-navy">{(inferredSigma * 100).toFixed(1)}%</div>
                    {sigmaOverride == null && (
                      <button
                        onClick={() => {
                          setSigmaStr((inferredSigma! * 100).toFixed(2))
                          onSigmaOverrideChange(inferredSigma!)
                        }}
                        className="text-xs text-orange hover:underline"
                      >
                        Override →
                      </button>
                    )}
                  </div>
                  <div className={`p-2 rounded border text-center ${
                    impliedAch !== null && impliedAch >= 1.0 ? 'bg-green-50 border-green-200'
                      : impliedAch !== null && impliedAch >= 0.85 ? 'bg-orange/10 border-orange/30'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="text-xs text-slate">Expected vs target</div>
                    <div className={`text-sm font-bold ${
                      impliedAch !== null && impliedAch >= 1.0 ? 'text-green-700'
                        : impliedAch !== null && impliedAch >= 0.85 ? 'text-orange'
                        : 'text-red-600'
                    }`}>
                      {impliedAch !== null ? `${(impliedAch * 100).toFixed(0)}% of target` : '—'}
                    </div>
                  </div>
                </div>
              )}
              {includedCount < 2 && (
                <p className="text-xs text-slate italic">Include at least 2 rows to infer parameters.</p>
              )}

              {/* ── σ override ── */}
              <div className="p-2.5 rounded border border-lightgrey bg-white">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-navy">Forecasted Volatility (σ)</span>
                  {sigmaOverride != null && (
                    <button onClick={() => { setSigmaStr(''); onSigmaOverrideChange(undefined) }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Clear override
                    </button>
                  )}
                </div>
                {sigmaOverride == null ? (
                  <p className="text-xs text-slate/70">
                    Using inferred σ{inferredSigma != null ? ` (${(inferredSigma * 100).toFixed(1)}%)` : ''}
                    {' '}from included rows. Click "Override →" above to customise.
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    <input type="range" min={1} max={100} step={0.5}
                      value={Math.round(sigmaOverride * 1000) / 10}
                      onChange={e => { const v = +e.target.value / 100; setSigmaStr((v * 100).toFixed(1)); onSigmaOverrideChange(v) }}
                      className="flex-1 accent-orange"
                    />
                    <div className="relative w-20">
                      <input type="text" value={sigmaStr}
                        onChange={e => { setSigmaStr(e.target.value); const n = parseFloat(e.target.value); if (!isNaN(n) && n > 0 && n <= 100) onSigmaOverrideChange(n / 100) }}
                        onBlur={() => { if (sigmaOverride != null) setSigmaStr((sigmaOverride * 100).toFixed(1)) }}
                        className="w-full text-xs px-2 py-1.5 pr-5 border border-orange rounded text-navy focus:outline-none focus:ring-1 focus:ring-orange"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate">%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── g override ── */}
              <div className="p-2.5 rounded border border-lightgrey bg-white">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-navy">Forecasted Growth Rate (g)</span>
                  {gOverride != null && (
                    <button onClick={() => { setGStr(''); onGOverrideChange(undefined) }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Clear override
                    </button>
                  )}
                </div>
                {gOverride == null ? (
                  <p className="text-xs text-slate/70">
                    Using inferred g{inferredG != null ? ` (${(inferredG * 100).toFixed(1)}%/yr)` : ''}
                    {' '}from included rows. Click "Override →" above to customise.
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    <input type="range" min={-50} max={50} step={0.5}
                      value={Math.round(gOverride * 1000) / 10}
                      onChange={e => { const v = +e.target.value / 100; setGStr((v * 100).toFixed(1)); onGOverrideChange(v) }}
                      className="flex-1 accent-orange"
                    />
                    <div className="relative w-20">
                      <input type="text" value={gStr}
                        onChange={e => { setGStr(e.target.value); const n = parseFloat(e.target.value); if (!isNaN(n) && n >= -50 && n <= 50) onGOverrideChange(n / 100) }}
                        onBlur={() => { if (gOverride != null) setGStr((gOverride * 100).toFixed(1)) }}
                        className="w-full text-xs px-2 py-1.5 pr-5 border border-orange rounded text-navy focus:outline-none focus:ring-1 focus:ring-orange"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate">%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
