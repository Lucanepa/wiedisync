import { useCollection } from '../lib/query'
import type { Team } from '../types'

export function useTeams(sport?: 'volleyball' | 'basketball' | 'all') {
  const filter: Record<string, unknown> =
    sport && sport !== 'all'
      ? { _and: [{ active: { _eq: true } }, { sport: { _eq: sport } }] }
      : { active: { _eq: true } }

  const result = useCollection<Team>('teams', {
    filter,
    sort: ['name'],
    limit: 50,
  })

  return { ...result, data: result.data ?? [] }
}
