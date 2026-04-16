import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin, isLoading, teamsLoading } = useAuth()

  if (isLoading || teamsLoading) return null
  if (!isAdmin) return <Navigate to="/" replace />

  return <>{children}</>
}
