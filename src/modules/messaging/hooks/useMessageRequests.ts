import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchAllItems } from '../../../lib/api'
import { messagingApi } from '../api/messaging'
import type { MessageRequestRow } from '../api/types'
import { useRealtime } from '../../../hooks/useRealtime'
import { useAuth } from '../../../hooks/useAuth'
import { messagingFeatureEnabled } from '../../../utils/messagingFeatureFlag'

export function useMessageRequests() {
  const { user } = useAuth()
  const enabled = messagingFeatureEnabled() && !!user?.id
  const [requests, setRequests] = useState<MessageRequestRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const meRef = useRef<string | null>(user?.id ?? null)
  meRef.current = user?.id ?? null

  const refetch = useCallback(async () => {
    if (!enabled || !user?.id) { setRequests([]); return }
    setIsLoading(true)
    try {
      const data = await fetchAllItems<MessageRequestRow>('message_requests', {
        filter: { _and: [{ recipient: { _eq: user.id } }, { status: { _eq: 'pending' } }] },
        fields: ['id', 'conversation', 'sender', 'recipient', 'status', 'created_at', 'resolved_at'],
        sort: ['-created_at'],
      })
      setRequests(data)
    } catch { /* ignore */ }
    finally { setIsLoading(false) }
  }, [enabled, user?.id])

  useEffect(() => { refetch() }, [refetch])

  useRealtime<MessageRequestRow>('message_requests', (e) => {
    const me = meRef.current
    if (!me) return
    const rec = e.record
    if (e.action === 'create' && String(rec.recipient) === String(me) && rec.status === 'pending') {
      setRequests(prev => prev.some(r => r.id === rec.id) ? prev : [rec, ...prev])
    }
    if (e.action === 'update' && String(rec.recipient) === String(me) && rec.status !== 'pending') {
      setRequests(prev => prev.filter(r => r.id !== rec.id))
    }
  }, undefined, !enabled)

  const accept = useCallback(async (requestId: string) => {
    await messagingApi.acceptRequest(requestId)
    setRequests(prev => prev.filter(r => r.id !== requestId))
  }, [])

  const decline = useCallback(async (requestId: string) => {
    await messagingApi.declineRequest(requestId)
    setRequests(prev => prev.filter(r => r.id !== requestId))
  }, [])

  return { requests, accept, decline, isLoading, refetch }
}
