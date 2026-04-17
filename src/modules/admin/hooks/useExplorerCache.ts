import { useCallback, useEffect, useState } from 'react'
import { fetchAllItems } from '../../../lib/api'
import type { Member, Team, Event as EventRec, Training, Game } from '../../../types'
import type { ExplorerScope, CacheShape } from '../components/explorerHelpers'

export interface CacheFilters {
  members: Record<string, unknown> | undefined
  teams: Record<string, unknown>
  events: Record<string, unknown> | undefined
  trainings: Record<string, unknown>
  games: Record<string, unknown> | undefined
}

/** Build Directus filter objects per bucket based on sport scope. */
export function buildFilters(scope: ExplorerScope): CacheFilters {
  const teams: Record<string, unknown> = { active: { _eq: true } }
  const trainings: Record<string, unknown> = {}
  let events: Record<string, unknown> | undefined = undefined
  let games: Record<string, unknown> | undefined = undefined

  if (scope !== 'all') {
    teams.sport = { _eq: scope }
    ;(trainings as { team?: unknown }).team = { sport: { _eq: scope } }
    games = { kscw_team: { sport: { _eq: scope } } }
    events = {
      _or: [
        { teams: { teams_id: { sport: { _eq: scope } } } },
        { teams: { _null: true } },
      ],
    }
  }

  return {
    members: { kscw_membership_active: { _eq: true } },
    teams,
    events,
    trainings,
    games,
  }
}

const EMPTY: CacheShape = {
  members: [], teams: [], events: [], trainings: [], games: [], loadedAt: null,
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

function ninetyDaysAgoISO(): string {
  return new Date(Date.now() - NINETY_DAYS_MS).toISOString().slice(0, 10)
}

/**
 * Batched page-load cache: fires 5 parallel fetches and stores the result.
 * Refresh() re-runs the batch. Sport scope is applied via buildFilters.
 * Member-sport filtering for non-'all' scope is done client-side (keep
 * members with ≥ 1 team in scope) to avoid a complex server-side filter.
 */
export function useExplorerCache(scope: ExplorerScope) {
  const [data, setData] = useState<CacheShape>(EMPTY)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const f = buildFilters(scope)
      const cutoff = ninetyDaysAgoISO()
      const [members, teams, events, trainings, games] = await Promise.all([
        fetchAllItems<Member>('members', {
          filter: f.members,
          fields: ['id', 'first_name', 'last_name', 'email', 'sex', 'kscw_membership_active', 'role', 'user', 'teams.team.id', 'teams.team.sport'],
          sort: ['last_name', 'first_name'],
        }),
        fetchAllItems<Team>('teams', {
          filter: f.teams,
          fields: ['id', 'name', 'full_name', 'sport', 'season', 'active', 'captain', 'coach', 'team_responsible'],
          sort: ['sport', 'name'],
        }),
        fetchAllItems<EventRec>('events', {
          filter: { _and: [{ end_date: { _gte: cutoff } }, ...(f.events ? [f.events] : [])] },
          fields: ['id', 'title', 'event_type', 'start_date', 'end_date', 'participation_mode', 'teams.teams_id'],
          sort: ['-start_date'],
        }),
        fetchAllItems<Training>('trainings', {
          filter: { _and: [{ date: { _gte: cutoff } }, ...(Object.keys(f.trainings).length ? [f.trainings] : [])] },
          fields: ['id', 'team', 'date', 'start_time', 'end_time', 'hall', 'cancelled'],
          sort: ['-date'],
        }),
        fetchAllItems<Game>('games', {
          filter: { _and: [{ date: { _gte: cutoff } }, ...(f.games ? [f.games] : [])] },
          fields: ['id', 'home_team', 'away_team', 'date', 'time', 'hall', 'home_score', 'away_score'],
          sort: ['-date'],
        }),
      ])

      // Member sport-filter: keep those with ≥1 team in scope
      const filteredMembers = scope === 'all'
        ? members
        : members.filter((m) => {
            const ts = Array.isArray((m as unknown as { teams?: unknown[] }).teams)
              ? (m as unknown as { teams: unknown[] }).teams
              : []
            return ts.some((junction: unknown) => {
              const j = junction as { team?: { sport?: string } | string }
              if (typeof j?.team === 'object' && j.team) return (j.team as { sport?: string }).sport === scope
              return false
            })
          })

      setData({
        members: filteredMembers,
        teams,
        events,
        trainings,
        games,
        loadedAt: Date.now(),
      })
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [scope])

  useEffect(() => { void load() }, [load])

  return { data, isLoading, error, refresh: load }
}
