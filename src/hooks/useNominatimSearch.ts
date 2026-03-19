import { useState, useEffect, useRef } from 'react'
import type { NominatimResult } from '../types'

export function useNominatimSearch(query: string, options?: { enabled?: boolean }) {
  const [results, setResults] = useState<NominatimResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const enabled = options?.enabled ?? true

  useEffect(() => {
    if (!enabled || query.length < 3) {
      setResults([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    const timer = setTimeout(async () => {
      // Abort previous request
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const params = new URLSearchParams({
          q: query,
          format: 'json',
          countrycodes: 'ch',
          limit: '5',
          addressdetails: '1',
        })
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?${params}`,
          {
            signal: controller.signal,
            headers: { 'User-Agent': 'Wiedisync/1.0 (https://wiedisync.kscw.ch)' },
          },
        )
        if (!res.ok) throw new Error('Nominatim request failed')
        const data: NominatimResult[] = await res.json()
        setResults(data)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setResults([])
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, 600)

    return () => {
      clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [query, enabled])

  return { results, isLoading }
}
