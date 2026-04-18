import { useCallback, useEffect, useRef, useState } from 'react'
import { messagingApi } from '../api/messaging'
import type { ConversationSummary, MessageRow } from '../api/types'
import { useRealtime } from '../../../hooks/useRealtime'
import { useAuth } from '../../../hooks/useAuth'
import { messagingFeatureEnabled } from '../../../utils/messagingFeatureFlag'
import { useBlocks } from './useBlocks'

type UseConversationsOptions = {
  /**
   * Sender IDs to filter out of realtime updates (used for blocks in Plan 03).
   * Defaults to useBlocks().blockedMemberIds in Plan 03; override only for tests.
   */
  blockedSenderIds?: string[]
}

/**
 * Returns the caller's non-archived conversation summaries with live unread counts.
 * Subscribes to messages.create realtime — any create bumps unread_count for the
 * relevant conversation (if not the sender and not muted) and updates the preview.
 *
 * `useAuth().user` is the member row (typed as `MemberUser = Member & { id: string }`
 * — see src/hooks/useAuth.tsx:13), so `user.id` is `members.id` and compares
 * directly against `message.sender`.
 */
export function useConversations({ blockedSenderIds }: UseConversationsOptions = {}) {
  const { user } = useAuth()
  const { blockedMemberIds } = useBlocks()
  const effectiveBlocked = blockedSenderIds ?? blockedMemberIds
  const enabled = messagingFeatureEnabled(user?.id) && !!user?.id
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const blockedRef = useRef(new Set(effectiveBlocked))
  blockedRef.current = new Set(effectiveBlocked)

  const refetch = useCallback(async () => {
    if (!enabled) { setConversations([]); return }
    setIsLoading(true)
    try {
      const list = await messagingApi.listConversations()
      setConversations(list)
      setError(null)
    } catch (e) {
      setError(e as Error)
    } finally {
      setIsLoading(false)
    }
  }, [enabled])

  useEffect(() => { refetch() }, [refetch])

  // Realtime: bump unread + preview on new messages.
  // Drop events from blocked senders outright (Plan 03 populates blockedSenderIds).
  useRealtime<MessageRow>('messages', (e) => {
    if (e.action !== 'create') return
    if (blockedRef.current.has(String(e.record.sender))) return
    setConversations(prev => prev.map(c => {
      if (c.id !== e.record.conversation) return c
      const isSelf = e.record.sender === user?.id
      const incUnread = !isSelf && !c.muted ? 1 : 0
      return {
        ...c,
        last_message_at: e.record.created_at,
        last_message_preview: (e.record.body ?? '').slice(0, 120),
        unread_count: c.unread_count + incUnread,
      }
    }))
  }, ['create'], !enabled)

  const markRead = useCallback(async (conversationId: string) => {
    if (!enabled) return
    try {
      await messagingApi.markRead(conversationId)
      setConversations(prev => prev.map(c =>
        c.id === conversationId ? { ...c, unread_count: 0 } : c,
      ))
    } catch { /* user will see error UI on thread */ }
  }, [enabled])

  const toggleMute = useCallback(async (conversationId: string) => {
    if (!enabled) return
    try {
      const { muted } = await messagingApi.toggleMute(conversationId)
      setConversations(prev => prev.map(c =>
        c.id === conversationId ? { ...c, muted } : c,
      ))
    } catch { /* noop — let the UI show a toast if needed later */ }
  }, [enabled])

  return { conversations, isLoading, error, refetch, markRead, toggleMute }
}
