interface Props {
  title: string
  subtitle?: string
  step?: number
}

export default function SectionHeader({ title, subtitle, step }: Props) {
  return (
    <div className="mb-5">
      <div className="flex items-start gap-0">
        {/* Orange left-accent bar */}
        <div className="w-0.5 self-stretch bg-orange flex-shrink-0 mr-4 rounded-full" />
        <div className="min-w-0">
          {step !== undefined && (
            <span className="block text-xs font-bold text-orange uppercase tracking-widest mb-0.5">
              {String(step).padStart(2, '0')}
            </span>
          )}
          <h2 className="text-lg font-semibold text-navy tracking-tight leading-snug">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-xs text-slate leading-relaxed">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  )
}
