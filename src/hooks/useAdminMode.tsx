import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { useAuth } from './useAuth'

interface AdminModeContextValue {
  isAdminMode: boolean
  toggleAdminMode: () => void
  setAdminMode: (mode: boolean) => void
  effectiveIsAdmin: boolean
  effectiveIsCoach: boolean
  /** Vorstand cross-team read access (read-only, no edit powers) */
  effectiveIsVorstand: boolean
  /** True when user has any elevated role that the toggle can gate */
  hasElevatedAccess: boolean
}

const STORAGE_KEY = 'wiedisync-admin-mode'

const AdminModeContext = createContext<AdminModeContextValue | null>(null)

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const { isAdmin, isVorstand, coachTeamIds } = useAuth()

  const [rawMode, setRawMode] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(rawMode))
  }, [rawMode])

  // Anyone with elevated privileges can toggle the mode
  const hasElevatedAccess = isAdmin || isVorstand
  const isAdminMode = hasElevatedAccess && rawMode

  // effectiveIsAdmin is true only when admin AND mode ON
  const effectiveIsAdmin = isAdmin && rawMode

  // Vorstand cross-team read access — only when mode ON
  const effectiveIsVorstand = isVorstand && rawMode

  // When admin mode OFF: coachTeamIds only (no isAdmin grant)
  // When admin mode ON: coachTeamIds || isAdmin
  const effectiveIsCoach = isAdminMode
    ? coachTeamIds.length > 0 || isAdmin
    : coachTeamIds.length > 0

  const toggleAdminMode = useCallback(() => setRawMode(prev => !prev), [])
  const setAdminMode = useCallback((mode: boolean) => setRawMode(mode), [])

  const value = useMemo<AdminModeContextValue>(
    () => ({
      isAdminMode,
      toggleAdminMode,
      setAdminMode,
      effectiveIsAdmin,
      effectiveIsCoach,
      effectiveIsVorstand,
      hasElevatedAccess,
    }),
    [isAdminMode, toggleAdminMode, setAdminMode, effectiveIsAdmin, effectiveIsCoach, effectiveIsVorstand, hasElevatedAccess],
  )

  return (
    <AdminModeContext.Provider value={value}>
      {children}
    </AdminModeContext.Provider>
  )
}

export function useAdminMode() {
  const ctx = useContext(AdminModeContext)
  if (!ctx) throw new Error('useAdminMode must be used within AdminModeProvider')
  return ctx
}
