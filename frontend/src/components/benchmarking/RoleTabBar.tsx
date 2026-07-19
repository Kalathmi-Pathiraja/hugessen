import { useState, useRef, useEffect } from 'react'

interface Props {
  roles: string[]
  selectedRole: string
  onChange: (role: string) => void
}

export default function RoleTabBar({ roles, selectedRole, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <label className="block text-[11px] font-semibold text-charcoal uppercase tracking-wide mb-1">Role</label>
      <button
        onClick={() => setOpen(o => !o)}
        className="min-w-[190px] flex items-center justify-between gap-3 bg-white border border-gray300 rounded px-3 py-2 text-[12.5px] font-semibold text-navy"
      >
        {selectedRole}
        <span className={`text-charcoal text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[190px] bg-white border border-gray300 rounded shadow-popover max-h-80 overflow-y-auto">
          {roles.map(role => (
            <button
              key={role}
              onClick={() => { onChange(role); setOpen(false) }}
              className={`block w-full text-left px-3 py-2 text-[12.5px] transition-colors ${
                role === selectedRole ? 'font-bold text-navy bg-gray100' : 'font-medium text-charcoal hover:bg-gray100'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
