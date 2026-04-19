import { useCallback, useEffect, useState } from 'react'
import { messagingApi, type ConversationMemberRow } from '../api/messaging'

export function useConversationMembers(conversationId: string | null | undefined) {
  const [members, setMembers] = useState<ConversationMemberRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!conversationId) { setMembers([]); return }
    setLoading(true)
    setError(null)
    try {
      const data = await messagingApi.listConversationMembers(conversationId)
      setMembers(data.members)
    } catch {
      setError('fetch_failed')
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => { void refetch() }, [refetch])

  return { members, loading, error, refetch }
}
