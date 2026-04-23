import { useMemo } from 'react'
import { useCollection } from '../../../lib/query'
import type { Game } from '../../../types'
import { checkConflicts, type ConflictCheckResult } from '../utils/gameConflicts'

interface UseGameConflictsInput {
  editingId?: string | number
  kscw_team: string | number
  hall?: string | number | null
  date: string // YYYY-MM-DD
  time: string // HH:MM
  type: 'home' | 'away'
  /** Skip the check (returns empty errors/warnings) when required fields aren't ready. */
  enabled?: boolean
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Queries games within ±3 days of the candidate date and runs the conflict
 * rules client-side. Small payload, short-circuits when the candidate is
 * incomplete. Returns `{ errors, warnings }` ready for the modal banner.
 */
export function useGameConflicts(input: UseGameConflictsInput): ConflictCheckResult & { isLoading: boolean } {
  const { editingId, kscw_team, hall, date, time, type, enabled = true } = input

  const ready = !!date && !!time && !!kscw_team && enabled

  const { data, isLoading } = useCollection<Game>('games', {
    filter: ready
      ? {
          _and: [
            { date: { _gte: addDaysISO(date, -3) } },
            { date: { _lte: addDaysISO(date, 3) } },
            {
              _or: [
                { kscw_team: { _eq: kscw_team } },
                ...(type === 'home' && hall != null ? [{ hall: { _eq: hall } }] : []),
              ],
            },
          ],
        }
      : undefined,
    fields: ['id', 'kscw_team', 'hall', 'date', 'time', 'type', 'home_team', 'away_team'],
    all: true,
    enabled: ready,
    staleTime: 30_000,
  })

  const result = useMemo<ConflictCheckResult>(() => {
    if (!ready) return { errors: [], warnings: [] }
    return checkConflicts(
      { editingId, kscw_team, hall: hall ?? null, date, time, type },
      data ?? [],
    )
  }, [ready, editingId, kscw_team, hall, date, time, type, data])

  return { ...result, isLoading }
}
