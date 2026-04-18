import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchAllItems } from '../../../lib/api'
import { messagingApi } from '../api/messaging'
import type { BlockRow } from '../api/types'
import { useRealtime } from '../../../hooks/useRealtime'
import { useAuth } from '../../../hooks/useAuth'
import { messagingFeatureEnabled } from '../../../utils/messagingFeatureFlag'

/**
 * Outgoing blocks owned by the current caller.
 * Incoming blocks (members who have blocked ME) are enforced server-side on
 * every endpoint — the frontend doesn't need to know them for UI decisions.
 */
export function useBlocks() {
  const { user } = useAuth()
  const enabled = messagingFeatureEnabled() && !!user?.id
  const [rows, setRows] = useState<BlockRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const meRef = useRef<string | null>(user?.id ?? null)
  meRef.current = user?.id ?? null

  const refetch = useCallback(async () => {
    if (!enabled || !user?.id) { setRows([]); return }
    setIsLoading(true)
    try {
      const data = await fetchAllItems<BlockRow>('blocks', {
        filter: { blocker: { _eq: user.id } },
        fields: ['id', 'blocker', 'blocked', 'created_at'],
      })
      setRows(data)
    } catch { /* RBAC / network — treat as empty */ }
    finally { setIsLoading(false) }
  }, [enabled, user?.id])

  useEffect(() => { refetch() }, [refetch])

  useRealtime<BlockRow>('blocks', (e) => {
    const me = meRef.current
    if (!me) return
    if (String(e.record.blocker) !== String(me)) return
    if (e.action === 'create') {
      setRows(prev => prev.some(r => r.id === e.record.id) ? prev : [...prev, e.record])
    } else if (e.action === 'delete') {
      setRows(prev => prev.filter(r => r.id !== e.record.id))
    }
  }, undefined, !enabled)

  const block = useCallback(async (memberId: string) => {
    if (!enabled) return
    await messagingApi.block({ member: memberId })
    await refetch()   // belt-and-suspenders: covers cases where realtime lags
  }, [enabled, refetch])

  const unblock = useCallback(async (memberId: string) => {
    if (!enabled) return
    await messagingApi.unblock(memberId)
    await refetch()
  }, [enabled, refetch])

  const blockedMemberIds = useMemo(() => rows.map(r => String(r.blocked)), [rows])
  const blockedSet = useMemo(() => new Set(blockedMemberIds), [blockedMemberIds])

  return { blockedMemberIds, blockedSet, block, unblock, isLoading, refetch }
}
