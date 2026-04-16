import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function AuthRoute({ children }: { children: ReactNode }) {
  const { user, isApproved, isLoading, teamsLoading } = useAuth()

  // Block until both auth AND team/role context are fully loaded.
  // Prevents pages from rendering with incomplete role data (memberTeamIds,
  // coachTeamIds, etc.) which causes a visible flash then re-render.
  if (isLoading || teamsLoading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!isApproved) return <Navigate to="/pending" replace />

  return <>{children}</>
}
