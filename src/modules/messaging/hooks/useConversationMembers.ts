import { useCallback, useEffect, useRef, useState } from 'react'
import { messagingApi, type ConversationMemberRow } from '../api/messaging'

export function useConversationMembers(conversationId: string | null | undefined) {
  const [members, setMembers] = useState<ConversationMemberRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchSeqRef = useRef(0)

  const refetch = useCallback(async () => {
    if (!conversationId) { setMembers([]); return }
    const mySeq = ++fetchSeqRef.current
    setLoading(true)
    setError(null)
    try {
      const data = await messagingApi.listConversationMembers(conversationId)
      // Stale: conversation switched or concurrent refetch — bail.
      if (fetchSeqRef.current !== mySeq) return
      setMembers(data.members)
    } catch {
      if (fetchSeqRef.current !== mySeq) return
      setError('fetch_failed')
      setMembers([])
    } finally {
      if (fetchSeqRef.current === mySeq) setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    // Clear prior members so a switch doesn't flash the old roster.
    setMembers([])
    void refetch()
  }, [refetch])

  return { members, loading, error, refetch }
}
