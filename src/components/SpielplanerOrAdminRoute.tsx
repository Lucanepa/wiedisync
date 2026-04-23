import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export interface SpielplanerAccess {
  isAdmin: boolean
  is_spielplaner: boolean
  spielplanerTeamIds: string[]
}

export function canAccessSpielplanung(auth: SpielplanerAccess): boolean {
  return auth.isAdmin || auth.is_spielplaner || auth.spielplanerTeamIds.length > 0
}

export default function SpielplanerOrAdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin, is_spielplaner, spielplanerTeamIds, isLoading, teamsLoading } = useAuth()

  if (isLoading || teamsLoading) return null
  if (!canAccessSpielplanung({ isAdmin, is_spielplaner, spielplanerTeamIds })) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
