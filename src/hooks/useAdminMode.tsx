import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { useAuth } from './useAuth'

interface AdminModeContextValue {
  isAdminMode: boolean
  toggleAdminMode: () => void
  setAdminMode: (mode: boolean) => void
  effectiveIsAdmin: boolean
  effectiveIsCoach: boolean
}

const STORAGE_KEY = 'wiedisync-admin-mode'

const AdminModeContext = createContext<AdminModeContextValue | null>(null)

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const { isAdmin, coachTeamIds } = useAuth()

  const [rawMode, setRawMode] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(rawMode))
  }, [rawMode])

  // Non-admins always get false regardless of localStorage
  const isAdminMode = isAdmin && rawMode

  // effectiveIsAdmin is true only when admin AND mode ON
  const effectiveIsAdmin = isAdminMode

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
    }),
    [isAdminMode, toggleAdminMode, setAdminMode, effectiveIsAdmin, effectiveIsCoach],
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
