import SectionHeader from '../shared/SectionHeader'
import { NumericInput } from '../shared/NumericInput'
import { PeerBenchmark } from '../../types/stip'

interface Props {
  peer: PeerBenchmark
  onChange: (peer: PeerBenchmark) => void
}

export default function PeerBenchmarking({ peer, onChange }: Props) {
  const update = (patch: Partial<PeerBenchmark>) => onChange({ ...peer, ...patch })

  return (
    <section className="mb-8">
      <SectionHeader
        step={5}
        title="Peer Benchmarking Overlay"
        subtitle="Optional. Adds a translucent peer band to the output bullet charts so clients can see their design vs. market practice."
      />

      <div className="grid grid-cols-2 gap-5">
        <NumField
          label="Peer Group P25 Target STIP (%)"
          value={Math.round(peer.p25_pct * 100)}
          onChange={v => update({ p25_pct: v / 100 })}
          helper="Lower bound of peer range"
        />
        <NumField
          label="Peer Group Median Target STIP (%)"
          value={Math.round(peer.median_pct * 100)}
          onChange={v => update({ median_pct: v / 100 })}
          helper="Shown as a reference line"
        />
        <NumField
          label="Peer Group P75 Target STIP (%)"
          value={Math.round(peer.p75_pct * 100)}
          onChange={v => update({ p75_pct: v / 100 })}
          helper="Upper bound of peer range"
        />
        <div>
          <label className="block text-sm font-medium text-navy mb-1">Data Source Label</label>
          <input
            type="text"
            placeholder="e.g. Hugessen 2024 O&G Survey"
            value={peer.data_source}
            onChange={e => update({ data_source: e.target.value })}
            className="w-full px-3 py-2.5 border border-lightgrey rounded text-navy text-sm
                       focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent
                       bg-white hover:border-slate transition-colors"
          />
          <p className="mt-1 text-xs text-slate">Displayed as a footnote on output charts</p>
        </div>
      </div>
    </section>
  )
}

function NumField({
  label, value, onChange, helper,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  helper: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-navy mb-1">{label}</label>
      <div className="relative">
        <NumericInput
          value={value}
          min={0}
          max={500}
          onChange={onChange}
          className="w-full pr-8 pl-4 py-2.5 border border-lightgrey rounded text-navy font-medium
                     focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent
                     bg-white hover:border-slate transition-colors"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate">%</span>
      </div>
      <p className="mt-1 text-xs text-slate">{helper}</p>
    </div>
  )
}
