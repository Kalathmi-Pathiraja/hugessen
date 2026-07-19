interface Props {
  years: number[]
  selectedYear: number
  onChange: (year: number) => void
}

export default function YearToggle({ years, selectedYear, onChange }: Props) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-charcoal uppercase tracking-wide mb-1 text-right">Fiscal Year</label>
      <div className="flex bg-gray100 rounded p-[3px] gap-0.5">
        {years.map(year => (
          <button
            key={year}
            onClick={() => onChange(year)}
            className={`px-3.5 py-1.5 rounded text-[12.5px] font-semibold transition-colors ${
              year === selectedYear
                ? 'bg-navy text-white'
                : 'text-charcoal hover:text-navy'
            }`}
          >
            {year}
          </button>
        ))}
      </div>
    </div>
  )
}
