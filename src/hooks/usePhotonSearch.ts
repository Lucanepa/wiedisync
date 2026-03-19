import { useState, useEffect, useRef } from 'react'
import type { PhotonFeature } from '../types'

export function usePhotonSearch(query: string, options?: { enabled?: boolean }) {
  const [results, setResults] = useState<PhotonFeature[]>([])
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
          lang: 'de',
          limit: '5',
          lat: '47.37',
          lon: '8.55',
        })
        const res = await fetch(
          `https://photon.komoot.io/api?${params}`,
          { signal: controller.signal },
        )
        if (!res.ok) throw new Error('Photon request failed')
        const data = await res.json()
        setResults(data.features ?? [])
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
