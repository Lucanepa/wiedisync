import { useMemo } from 'react'
import { useCollection } from '../../../lib/query'
import type { Game, Hall, Team } from '../../../types'
import { checkConflicts, type ConflictCheckResult } from '../utils/gameConflicts'
import { normalizeRelId } from '../../../utils/gameHalls'

interface UseGameConflictsInput {
  editingId?: string | number
  kscw_team: string | number
  hall?: string | number | null
  additional_halls?: string[] | null
  date: string // YYYY-MM-DD
  time: string // HH:MM
  type: 'home' | 'away'
  /** Teams + halls enable multi-hall conflict detection + the legacy-basketball fallback. */
  teams?: Team[]
  halls?: Hall[]
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
  const { editingId, kscw_team, hall, additional_halls, date, time, type, teams, halls, enabled = true } = input

  const ready = !!date && !!time && !!kscw_team && enabled

  const candidateHallIds = useMemo(() => {
    if (type !== 'home') return [] as string[]
    const ids: string[] = []
    if (hall != null) ids.push(normalizeRelId(hall))
    for (const h of additional_halls ?? []) ids.push(normalizeRelId(h))
    return Array.from(new Set(ids.filter(Boolean)))
  }, [type, hall, additional_halls])

  const { data, isLoading } = useCollection<Game>('games', {
    filter: ready
      ? {
          _and: [
            { date: { _gte: addDaysISO(date, -3) } },
            { date: { _lte: addDaysISO(date, 3) } },
            {
              _or: [
                { kscw_team: { _eq: kscw_team } },
                ...(candidateHallIds.length > 0
                  ? [{ hall: { _in: candidateHallIds } }]
                  : []),
              ],
            },
          ],
        }
      : undefined,
    fields: ['id', 'kscw_team', 'hall', 'additional_halls', 'date', 'time', 'type', 'home_team', 'away_team'],
    all: true,
    enabled: ready,
    staleTime: 30_000,
  })

  const result = useMemo<ConflictCheckResult>(() => {
    if (!ready) return { errors: [], warnings: [] }
    return checkConflicts(
      {
        editingId,
        kscw_team,
        hall: hall ?? null,
        additional_halls: additional_halls ?? null,
        date,
        time,
        type,
      },
      data ?? [],
      { teams, halls },
    )
  }, [ready, editingId, kscw_team, hall, additional_halls, date, time, type, data, teams, halls])

  return { ...result, isLoading }
}
