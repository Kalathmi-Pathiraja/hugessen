import { ReactNode, useEffect, useState } from 'react'
import { authApi } from '../../api/client'

type Status = 'checking' | 'authenticated' | 'unauthenticated'

export default function LoginGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    authApi.checkSession()
      .then(({ authenticated }) => setStatus(authenticated ? 'authenticated' : 'unauthenticated'))
      .catch(() => setStatus('unauthenticated'))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await authApi.login(password)
      setStatus('authenticated')
    } catch (err: any) {
      setError(err.message ?? 'Incorrect password.')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'checking') {
    return <div className="min-h-screen bg-offwhite" />
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-offwhite flex items-center justify-center px-6">
        <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white border border-gray300 rounded p-8">
          <div className="text-center mb-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-orange font-semibold mb-1">Hugessen Consulting</p>
            <h1 className="text-[22px] font-display text-navy">Advisory Platform</h1>
          </div>
          <label className="block text-sm font-medium text-navy mb-1.5">Password</label>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray300 rounded text-navy focus:outline-none focus:ring-2 focus:ring-orange mb-3"
          />
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !password}
            className="w-full py-2.5 bg-orange text-white font-semibold rounded hover:bg-orange/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Checking…' : 'Enter'}
          </button>
        </form>
      </div>
    )
  }

  return <>{children}</>
}
