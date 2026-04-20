import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchAllItems } from '../../../lib/api'
import { messagingApi } from '../api/messaging'
import type { ReactionRow } from '../api/types'
import { useRealtime } from '../../../hooks/useRealtime'
import { useAuth } from '../../../hooks/useAuth'
import { messagingFeatureEnabled } from '../../../utils/messagingFeatureFlag'

export function useReactions(messageId: string | null) {
  const { user } = useAuth()
  const enabled = messagingFeatureEnabled(user?.id) && !!user?.id && !!messageId
  const [rows, setRows] = useState<ReactionRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const msgRef = useRef<string | null>(messageId)
  msgRef.current = messageId

  const refetch = useCallback(async () => {
    if (!enabled || !messageId) { setRows([]); return }
    setIsLoading(true)
    try {
      const data = await fetchAllItems<ReactionRow>('message_reactions', {
        filter: { message: { _eq: messageId } },
        fields: ['id', 'message', 'member', 'emoji', 'created_at'],
      })
      setRows(data)
    } catch { /* ignore */ }
    finally { setIsLoading(false) }
  }, [enabled, messageId])

  useEffect(() => { refetch() }, [refetch])

  useRealtime<ReactionRow>('message_reactions', (e) => {
    const mid = msgRef.current
    if (!mid || String(e.record.message) !== String(mid)) return
    if (e.action === 'create') {
      setRows(prev => prev.some(r => r.id === e.record.id) ? prev : [...prev, e.record])
    } else if (e.action === 'delete') {
      setRows(prev => prev.filter(r => r.id !== e.record.id))
    }
  }, undefined, !enabled)

  const toggle = useCallback(async (emoji: string) => {
    if (!enabled || !messageId) return
    const userId = user?.id
    // Optimistic toggle so tap feels instant; realtime/refetch reconciles truth.
    setRows(prev => {
      const hasMine = prev.some(r => r.emoji === emoji && String(r.member) === String(userId))
      if (hasMine) {
        return prev.filter(r => !(r.emoji === emoji && String(r.member) === String(userId)))
      }
      return [...prev, {
        id: `optimistic-${Date.now()}`,
        message: messageId, member: String(userId ?? ''), emoji,
        created_at: new Date().toISOString(),
      }]
    })
    try {
      await messagingApi.react(messageId, { emoji })
    } finally {
      refetch()
    }
  }, [enabled, messageId, user?.id, refetch])

  const myReactions = useMemo(
    () => new Set(rows.filter(r => String(r.member) === String(user?.id)).map(r => r.emoji)),
    [rows, user?.id],
  )
  const groupedCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.emoji, (m.get(r.emoji) ?? 0) + 1)
    return m
  }, [rows])

  return { reactions: rows, myReactions, groupedCounts, toggle, isLoading }
}
