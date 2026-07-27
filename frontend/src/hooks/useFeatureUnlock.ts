import { useEffect, useState } from 'react'

/**
 * Simple client-side unlock for tools still in development. Visiting the app
 * once with ?unlock=<key> in the URL persists the unlock in localStorage (and
 * strips the param from the visible URL), so only whoever you send that link
 * to ever sees the feature — everyone else just sees the "coming soon" state.
 * Not real access control (no server-side check) — just hides work-in-progress
 * tools from a shared link, not a security boundary.
 */
export function useFeatureUnlock(key: string): boolean {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem(`unlock_${key}`) === '1')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('unlock') === key) {
      localStorage.setItem(`unlock_${key}`, '1')
      setUnlocked(true)
      params.delete('unlock')
      const next = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (next ? `?${next}` : ''))
    }
  }, [key])

  return unlocked
}
