import { useCallback, useEffect, useMemo, useState } from 'react'
import { messagingApi } from '../api/messaging'
import type { ReportRow } from '../api/types'
import { useRealtime } from '../../../hooks/useRealtime'
import { useAuth } from '../../../hooks/useAuth'

export function useReports() {
  const { user, isAdmin } = useAuth()
  const enabled = !!user?.id && isAdmin
  const [reports, setReports] = useState<ReportRow[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!enabled) { setReports([]); return }
    setIsLoading(true)
    try {
      const { reports } = await messagingApi.listReports()
      setReports(reports)
    } catch { /* ignore */ }
    finally { setIsLoading(false) }
  }, [enabled])

  useEffect(() => { refetch() }, [refetch])

  useRealtime<ReportRow>('reports', () => { refetch() }, undefined, !enabled)

  const resolve = useCallback(async (id: string) => {
    await messagingApi.resolveReport(id, { status: 'resolved' }); await refetch()
  }, [refetch])
  const dismiss = useCallback(async (id: string) => {
    await messagingApi.resolveReport(id, { status: 'dismissed' }); await refetch()
  }, [refetch])
  const resolveWithDelete = useCallback(async (id: string) => {
    await messagingApi.resolveReport(id, { status: 'resolved', delete_message: true }); await refetch()
  }, [refetch])
  const resolveWithBan = useCallback(async (id: string) => {
    await messagingApi.resolveReport(id, { status: 'resolved', ban: true }); await refetch()
  }, [refetch])

  const openCount = useMemo(() => reports.filter(r => r.status === 'open').length, [reports])
  return { reports, openCount, resolve, dismiss, resolveWithDelete, resolveWithBan, refetch, isLoading }
}
