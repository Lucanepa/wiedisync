import { usePB } from './usePB'
import type { Team } from '../types'

export function useTeams(sport?: 'volleyball' | 'basketball' | 'all') {
  const filter: Record<string, unknown> =
    sport && sport !== 'all'
      ? { _and: [{ active: { _eq: true } }, { sport: { _eq: sport } }] }
      : { active: { _eq: true } }

  return usePB<Team>('teams', {
    filter,
    sort: 'name',
    perPage: 50,
  })
}
