import { useCallback, useEffect, useRef, useState } from 'react'
import { messagingApi } from '../api/messaging'
import type { MessageRow } from '../api/types'
import { useRealtime } from '../../../hooks/useRealtime'
import { useAuth } from '../../../hooks/useAuth'
import { messagingFeatureEnabled } from '../../../utils/messagingFeatureFlag'

type UseConversationOptions = {
  /** Sender IDs whose messages must not appear in the thread. Plan 02 passes []; Plan 03 populates from blocks. */
  blockedSenderIds?: string[]
}

/**
 * Fetch + keep up-to-date the messages in one conversation.
 * Realtime appends new messages sent to this conversation, minus blocked senders.
 */
export function useConversation(
  conversationId: string | null,
  { blockedSenderIds = [] }: UseConversationOptions = {},
) {
  const { user } = useAuth()
  const enabled = messagingFeatureEnabled() && !!user?.id && !!conversationId
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sendError, setSendError] = useState<Error | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const convIdRef = useRef(conversationId)
  convIdRef.current = conversationId
  const blockedRef = useRef(new Set(blockedSenderIds))
  blockedRef.current = new Set(blockedSenderIds)

  const refetch = useCallback(async () => {
    if (!enabled || !conversationId) { setMessages([]); return }
    setIsLoading(true)
    try {
      const { messages, has_more } = await messagingApi.listMessages(conversationId, { limit: 50 })
      // Client-side filter: blocked senders never show up (server-side filter arrives in Plan 03).
      setMessages(messages.filter(m => !blockedRef.current.has(String(m.sender))))
      setHasMore(has_more)
    } finally {
      setIsLoading(false)
    }
  }, [conversationId, enabled])

  useEffect(() => { refetch() }, [refetch])

  useRealtime<MessageRow>('messages', (e) => {
    if (convIdRef.current !== e.record.conversation) return
    if (blockedRef.current.has(String(e.record.sender))) return
    if (e.action === 'create') {
      setMessages(prev => {
        if (prev.some(m => m.id === e.record.id)) return prev   // idempotent on self-echo
        return [...prev, e.record]
      })
    } else if (e.action === 'update') {
      setMessages(prev => prev.map(m => m.id === e.record.id ? e.record : m))
    } else if (e.action === 'delete') {
      setMessages(prev => prev.filter(m => m.id !== e.record.id))
    }
  }, undefined, !enabled)

  const send = useCallback(async (body: string) => {
    if (!enabled || !conversationId) return
    const trimmed = body.trim()
    if (!trimmed) return
    setSendError(null)
    try {
      const row = await messagingApi.send({ conversation: conversationId, type: 'text', body: trimmed })
      // Optimistic: append immediately; the realtime echo is deduped by id above
      setMessages(prev => prev.some(m => m.id === row.id) ? prev : [...prev, row])
    } catch (e) {
      setSendError(e as Error)
      throw e
    }
  }, [conversationId, enabled])

  return { messages, isLoading, sendError, hasMore, refetch, send }
}
