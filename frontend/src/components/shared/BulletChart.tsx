import { BRAND } from '../../constants/brand'

interface BulletTrack {
  label: string        // e.g. 'Bear Case (P10)'
  value: number        // % of target or $ value
  valueLabel: string   // e.g. '72% of Target' or '$361,000 — 0.72×'
  maxValue: number     // full track width (e.g. 200 for % or 2× grant value)
  targetValue: number  // where the notch sits (e.g. 100 for % or grant value)
  targetLabel: string  // e.g. '100% Target' or 'Grant-Date Value'
  peerP25?: number     // optional peer band
  peerP75?: number
  color?: string
}

interface Props {
  tracks: BulletTrack[]
  unit?: string
}

export default function BulletChart({ tracks, unit = '%' }: Props) {
  const trackHeight = 44
  const labelW = 160
  const valueLabelW = 180
  const chartW = 520
  const totalW = labelW + chartW + valueLabelW
  const totalH = tracks.length * (trackHeight + 16) + 24

  return (
    <svg width={totalW} height={totalH} className="overflow-visible">
      {tracks.map((track, i) => {
        const y = i * (trackHeight + 16) + 8
        const barY = y + 8
        const barH = trackHeight - 16

        const pct = Math.min(track.value / track.maxValue, 1)
        const targetPct = Math.min(track.targetValue / track.maxValue, 1)
        const filledW = pct * chartW
        const targetX = targetPct * chartW

        return (
          <g key={track.label}>
            {/* Row label */}
            <text
              x={labelW - 12}
              y={barY + barH / 2 + 5}
              textAnchor="end"
              fontSize={13}
              fontWeight="600"
              fill={BRAND.navy}
              fontFamily="Calibri, 'Open Sans', system-ui, sans-serif"
            >
              {track.label}
            </text>

            {/* Background track */}
            <rect
              x={labelW}
              y={barY}
              width={chartW}
              height={barH}
              rx={3}
              fill={BRAND.lightGrey}
            />

            {/* Orange fill bar */}
            <rect
              x={labelW}
              y={barY + 3}
              width={Math.max(filledW, 0)}
              height={barH - 6}
              rx={2}
              fill={track.color ?? BRAND.orange}
            />

            {/* Peer band (P25–P75) — rendered on top of fill so it's always visible */}
            {track.peerP25 !== undefined && track.peerP75 !== undefined && (
              <>
                <rect
                  x={labelW + (track.peerP25 / track.maxValue) * chartW}
                  y={barY}
                  width={((track.peerP75 - track.peerP25) / track.maxValue) * chartW}
                  height={barH}
                  rx={0}
                  fill={BRAND.peerBand}
                  opacity={0.4}
                />
                {/* P25 edge tick */}
                <line
                  x1={labelW + (track.peerP25 / track.maxValue) * chartW}
                  y1={barY - 3}
                  x2={labelW + (track.peerP25 / track.maxValue) * chartW}
                  y2={barY + barH + 3}
                  stroke={BRAND.slate}
                  strokeWidth={1}
                  strokeDasharray="3 2"
                />
                {/* P75 edge tick */}
                <line
                  x1={labelW + (track.peerP75 / track.maxValue) * chartW}
                  y1={barY - 3}
                  x2={labelW + (track.peerP75 / track.maxValue) * chartW}
                  y2={barY + barH + 3}
                  stroke={BRAND.slate}
                  strokeWidth={1}
                  strokeDasharray="3 2"
                />
              </>
            )}

            {/* Target notch */}
            <line
              x1={labelW + targetX}
              y1={barY - 4}
              x2={labelW + targetX}
              y2={barY + barH + 4}
              stroke={BRAND.navy}
              strokeWidth={2}
            />
            <text
              x={labelW + targetX}
              y={barY - 7}
              textAnchor="middle"
              fontSize={9}
              fill={BRAND.navy}
              fontFamily="Calibri, 'Open Sans', system-ui, sans-serif"
            >
              {track.targetLabel}
            </text>

            {/* Value label */}
            <text
              x={labelW + chartW + 12}
              y={barY + barH / 2 + 5}
              textAnchor="start"
              fontSize={13}
              fontWeight="700"
              fill={BRAND.navy}
              fontFamily="Calibri, 'Open Sans', system-ui, sans-serif"
            >
              {track.valueLabel}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
