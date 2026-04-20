import { useCallback, useEffect, useRef, useState } from 'react'
import { messagingApi, type ConversationMemberRow } from '../api/messaging'

export function useConversationMembers(conversationId: string | null | undefined) {
  const [members, setMembers] = useState<ConversationMemberRow[]>([])
  // Initial mount: we know the effect will fire a refetch. Start "loading" so
  // the first render doesn't look "ready with 0 members" for a frame.
  const [loading, setLoading] = useState(!!conversationId)
  const [error, setError] = useState<string | null>(null)
  const fetchSeqRef = useRef(0)

  const refetch = useCallback(async () => {
    if (!conversationId) { setMembers([]); setLoading(false); return }
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
