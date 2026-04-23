import { useMemo } from 'react'
import { useCollection } from '../../../lib/query'

/**
 * Returns the sorted list of distinct `season` values seen in `games`.
 * Fetches `fields=['season']` for all rows and dedupes client-side
 * (KSCW's `useCollection` wrapper does not expose Directus `groupBy`).
 *
 * Newest season first: '2025/2026' before '2024/2025'.
 */
export function useAvailableSeasons(): { seasons: string[]; isLoading: boolean } {
  const { data, isLoading } = useCollection<{ season: string | null }>('games', {
    fields: ['season'],
    all: true,
    staleTime: 60_000,
  })

  const seasons = useMemo(() => {
    const set = new Set<string>()
    for (const row of data ?? []) {
      if (row.season) set.add(row.season)
    }
    return [...set].sort().reverse()
  }, [data])

  return { seasons, isLoading }
}
