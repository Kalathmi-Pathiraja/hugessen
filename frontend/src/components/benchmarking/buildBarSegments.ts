export interface BarSegment {
  key: string
  value: number
  color: string
}

/**
 * Decomposes a P25/P50/P75 floating bar (transparent base + two colored bands)
 * into a fixed 5-slot stack, inserting a thin orange "tick" band at the client's
 * exact value wherever it falls — including outside the P25-P75 range. A fixed
 * slot count (rather than a variable one) is required because Recharts assigns
 * one fill color per dataKey across the whole series, not per data row.
 */
export function buildBarSegments(
  p25: number, p50: number, p75: number, clientValue: number | null,
  lightColor: string, darkColor: string, tickColor: string,
): BarSegment[] {
  const span = Math.max(p75 - p25, 1)
  const tickHalf = span * 0.012

  let cuts = [p25, p50, p75]
  let tickLo: number | null = null
  let tickHi: number | null = null
  if (clientValue !== null) {
    tickLo = clientValue - tickHalf
    tickHi = clientValue + tickHalf
    cuts = [...cuts, tickLo, tickHi]
  }
  cuts = Array.from(new Set(cuts)).sort((a, b) => a - b)
  const points = [0, ...cuts]

  const segments: BarSegment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const lo = points[i]
    const hi = points[i + 1]
    if (hi <= lo) continue
    let color = 'transparent'
    if (tickLo !== null && tickHi !== null && lo < tickHi && hi > tickLo) {
      color = tickColor
    } else if (lo >= p25 && hi <= p50) {
      color = lightColor
    } else if (lo >= p50 && hi <= p75) {
      color = darkColor
    }
    segments.push({ key: `seg${segments.length}`, value: hi - lo, color })
  }
  while (segments.length < 6) {
    segments.push({ key: `seg${segments.length}`, value: 0, color: 'transparent' })
  }
  return segments.slice(0, 6)
}
