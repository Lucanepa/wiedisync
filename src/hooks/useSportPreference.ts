import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'

export type SportView = 'vb' | 'bb' | 'all'

const STORAGE_KEY = 'kscw-sport'

/**
 * Sport preference hook.
 * - Logged-in users: auto-defaults to their team's sport (locked to actual sport).
 * - Guests: reads from localStorage, defaults to 'vb' if not set.
 * - Always returns the current value and a setter.
 * - `isLocked` is true when user is logged in with a single sport — toggle still works but resets on reload.
 */
export function useSportPreference() {
  const { user, primarySport } = useAuth()

  const [sport, setSportRaw] = useState<SportView>(() => {
    if (user) {
      // Logged-in: use their sport
      if (primarySport === 'volleyball') return 'vb'
      if (primarySport === 'basketball') return 'bb'
      return 'all'
    }
    // Guest: read from localStorage
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'vb' || stored === 'bb' || stored === 'all') return stored
    return 'vb' // default for first-time visitors
  })

  // When auth state changes, update default
  useEffect(() => {
    if (user) {
      if (primarySport === 'volleyball') setSportRaw('vb')
      else if (primarySport === 'basketball') setSportRaw('bb')
      else setSportRaw('all')
    }
  }, [user, primarySport])

  const setSport = useCallback((value: SportView) => {
    setSportRaw(value)
    // Persist for guests
    if (!user) {
      localStorage.setItem(STORAGE_KEY, value)
    }
  }, [user])

  // Whether the user hasn't chosen yet (first visit, no localStorage)
  const needsChoice = !user && !localStorage.getItem(STORAGE_KEY)

  return { sport, setSport, needsChoice }
}
