import { describe, it, expect } from 'vitest'
import { buildFilters } from './useExplorerCache'

describe('buildFilters', () => {
  it('returns unscoped filters for scope=all', () => {
    const f = buildFilters('all')
    expect(f.teams).toEqual({ active: { _eq: true } })
    expect(f.games).toBeUndefined()
    expect(f.events).toBeUndefined()
  })

  it('scopes teams/trainings/games by sport', () => {
    const f = buildFilters('volleyball')
    expect(f.teams).toEqual({ active: { _eq: true }, sport: { _eq: 'volleyball' } })
    expect(f.trainings).toMatchObject({ team: { sport: { _eq: 'volleyball' } } })
    expect(f.games).toEqual({ sport: { _eq: 'volleyball' } })
  })

  it('events filter includes club-wide (no teams) entries', () => {
    const f = buildFilters('basketball')
    expect(f.events).toMatchObject({
      _or: [
        { teams: { teams_id: { sport: { _eq: 'basketball' } } } },
        { teams: { _null: true } },
      ],
    })
  })
})
