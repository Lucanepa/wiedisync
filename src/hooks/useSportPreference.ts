import { useState, useCallback } from 'react'
import { useAuth } from './useAuth'

export type SportView = 'vb' | 'bb' | 'all'

const STORAGE_KEY = 'wiedisync-sport'

/**
 * Sport preference hook.
 * - Reads from localStorage first (persisted across sessions for all users).
 * - Falls back to user's primary sport if no stored preference.
 * - Defaults to 'all' if nothing else applies.
 */
export function useSportPreference() {
  const { user, primarySport } = useAuth()

  const [sport, setSportRaw] = useState<SportView>(() => {
    // Check stored preference first (works for both logged-in and guests)
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'vb' || stored === 'bb' || stored === 'all') return stored
    // Fall back to user's primary sport
    if (user) {
      if (primarySport === 'volleyball') return 'vb'
      if (primarySport === 'basketball') return 'bb'
    }
    return 'all'
  })

  const setSport = useCallback((value: SportView) => {
    setSportRaw(value)
    localStorage.setItem(STORAGE_KEY, value)
  }, [])

  return { sport, setSport }
}
