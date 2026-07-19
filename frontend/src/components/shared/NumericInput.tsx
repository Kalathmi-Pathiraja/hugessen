import { useState, useEffect, useRef } from 'react'

/**
 * NumericInput — a well-behaved controlled number field.
 *
 * Why type="text" instead of type="number":
 *   Browser number inputs silently rewrite values on blur (normalising to step,
 *   clamping to min/max, dropping partial decimals like "0.0"). This causes the
 *   "can't type 0.05" / "jumps to 0" / "resets mid-keystroke" class of bugs.
 *   Using type="text" + inputMode="decimal" gives us a numeric keyboard on mobile
 *   while keeping full control over the displayed string.
 *
 * Props:
 *   value      — the stored number (in "store units", e.g. 0.05 for 5%)
 *   scale      — multiply value by this to get the displayed number (default 1)
 *                e.g. scale=100 → stores 0.05, displays "5"
 *   onChange   — called with the new store-unit value whenever input is valid
 *   min / max  — enforced on blur (not during typing, so mid-delete works)
 *   className  — forwarded to <input>
 *   placeholder, disabled — forwarded to <input>
 */
export function NumericInput({
  value,
  scale = 1,
  onChange,
  min,
  max,
  className,
  placeholder,
  disabled,
}: {
  value: number
  scale?: number
  onChange: (v: number) => void
  min?: number
  max?: number
  className?: string
  placeholder?: string
  disabled?: boolean
}) {
  // Convert store value → display string, stripping trailing zeros
  const toDisplay = (v: number): string => {
    if (v === 0) return ''
    const displayed = v * scale
    // Use toPrecision(10) to avoid float artifacts like 20.000000000000004
    const clean = parseFloat(displayed.toPrecision(10))
    return String(clean)
  }

  const [str, setStr] = useState(() => toDisplay(value))
  const lastCommit = useRef(value)

  // Sync when parent changes the value externally (e.g. reset, tab switch)
  useEffect(() => {
    if (value !== lastCommit.current) {
      setStr(toDisplay(value))
      lastCommit.current = value
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (raw: string) => {
    const n = parseFloat(raw)
    const num = isNaN(n) ? 0 : n
    const clamped =
      min !== undefined && num < min ? min :
      max !== undefined && num > max ? max :
      num
    const stored = clamped / scale
    lastCommit.current = stored
    onChange(stored)
    setStr(toDisplay(stored))
  }

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
        setStr(raw)
        // Commit immediately on valid parses so live calculations stay fresh
        const n = parseFloat(raw)
        if (!isNaN(n)) {
          const stored = n / scale
          lastCommit.current = stored
          onChange(stored)
        }
      }}
      onBlur={() => commit(str)}
    />
  )
}
