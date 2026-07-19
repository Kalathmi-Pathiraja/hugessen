// Values are already in the engagement's single reporting currency end-to-end
// (the source template's Annualized/Converted columns), so a currency code/symbol
// like "CA$" is redundant — just show the dollar amount.
export function fmtCurrency(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return `$${Math.round(v).toLocaleString()}`
}

export function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return `${(v * 100).toFixed(0)}%`
}

export function fmtCompact(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  if (Math.abs(v) >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${v.toFixed(0)}`
}
