import { useMemo } from 'react'
import type { ExplorerEntity } from '../components/explorerHelpers'

interface Ranked extends ExplorerEntity {
  score: number
}

/**
 * Rank entities against a query.
 * - prefix match on label → 100
 * - substring on label    → 60
 * - substring on sublabel → 30
 * - fuzzy (all chars present in order) → 10
 * Returns top `maxResults` sorted by score desc. Empty query returns all unchanged (capped).
 */
export function rankEntities(
  entities: ExplorerEntity[],
  query: string,
  maxResults = 50,
): ExplorerEntity[] {
  const q = query.trim().toLowerCase()
  if (!q) return entities.slice(0, maxResults)

  const scored: Ranked[] = []
  for (const e of entities) {
    const label = (e.label ?? '').toLowerCase()
    const sub = (e.sublabel ?? '').toLowerCase()
    let score = 0
    if (label.startsWith(q)) score = 100
    else if (label.includes(q)) score = 60
    else if (sub.includes(q)) score = 30
    else if (fuzzy(label, q) || fuzzy(sub, q)) score = 10
    if (score > 0) scored.push({ ...e, score })
  }
  scored.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
  return scored.slice(0, maxResults)
}

function fuzzy(haystack: string, needle: string): boolean {
  let i = 0
  for (const c of haystack) {
    if (c === needle[i]) i++
    if (i === needle.length) return true
  }
  return false
}

/** React hook wrapper — memoizes by (entities reference, query, maxResults). */
export function useExplorerSearch(entities: ExplorerEntity[], query: string, maxResults = 50) {
  return useMemo(() => rankEntities(entities, query, maxResults), [entities, query, maxResults])
}
