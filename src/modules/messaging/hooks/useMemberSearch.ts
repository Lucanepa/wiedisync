import { useCallback, useEffect, useRef, useState } from 'react'
import { messagingApi, type SearchableMember } from '../api/messaging'

interface UseMemberSearchOptions {
  debounceMs?: number
  enabled?: boolean
}

interface UseMemberSearchResult {
  results: SearchableMember[]
  loading: boolean
  error: string | null
}

export function useMemberSearch(
  query: string,
  { debounceMs = 200, enabled = true }: UseMemberSearchOptions = {},
): UseMemberSearchResult {
  const [results, setResults] = useState<SearchableMember[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await messagingApi.searchMembers(q.trim())
      setResults(data.members)
    } catch {
      setError('search_failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!enabled || query.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    timerRef.current = setTimeout(() => { void search(query) }, debounceMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query, debounceMs, enabled, search])

  return { results, loading, error }
}
