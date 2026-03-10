import { useAdminMode } from '../hooks/useAdminMode'
import type { ReactNode } from 'react'

export function AdminOnly({ children }: { children: ReactNode }) {
  const { effectiveIsAdmin } = useAdminMode()
  return effectiveIsAdmin ? <>{children}</> : null
}
