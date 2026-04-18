import { useEffect, useState } from 'react'
import { fetchAllItems } from '../../../lib/api'

/**
 * Batch-fetch display names for a set of member ids. Returns a Map keyed by id.
 * Re-fetches when the set of ids changes.
 */
export function useMemberDisplayNames(memberIds: string[]): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(new Map())
  const key = memberIds.slice().sort().join(',')
  useEffect(() => {
    if (memberIds.length === 0) { setMap(new Map()); return }
    let alive = true
    ;(async () => {
      try {
        const rows = await fetchAllItems<{ id: string; first_name: string; last_name: string }>(
          'members',
          { filter: { id: { _in: memberIds } }, fields: ['id', 'first_name', 'last_name'] },
        )
        if (!alive) return
        const m = new Map<string, string>()
        for (const r of rows) {
          const full = `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim()
          m.set(String(r.id), full || String(r.id))
        }
        setMap(m)
      } catch { /* empty map — caller falls back to '—' */ }
    })()
    return () => { alive = false }
  }, [key])   // eslint-disable-line react-hooks/exhaustive-deps
  return map
}
