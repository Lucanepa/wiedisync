import { describe, it, expect } from 'vitest'
import { rankEntities } from './useExplorerSearch'

const entities = [
  { type: 'members' as const, id: '1', label: 'Canepa, Luca', sublabel: 'luca@example.com' },
  { type: 'members' as const, id: '2', label: 'Fretz, Finn', sublabel: 'finn@example.com' },
  { type: 'teams' as const, id: '10', label: 'H3', sublabel: 'Herren 3' },
  { type: 'events' as const, id: '100', label: 'Mixed-Turnier 2026' },
]

describe('rankEntities', () => {
  it('returns all entities unchanged for empty query', () => {
    expect(rankEntities(entities, '')).toHaveLength(4)
  })

  it('ranks prefix match above substring', () => {
    const results = rankEntities(entities, 'can')
    expect(results[0]?.id).toBe('1') // Canepa — prefix on primary
  })

  it('matches case-insensitively', () => {
    const results = rankEntities(entities, 'LUCA')
    expect(results.find((r) => r.id === '1')).toBeTruthy()
  })

  it('matches on sublabel (secondary field) with lower score', () => {
    const results = rankEntities(entities, 'finn@example')
    expect(results[0]?.id).toBe('2')
  })

  it('returns empty for no match', () => {
    expect(rankEntities(entities, 'zzzzzz')).toHaveLength(0)
  })

  it('caps results at maxResults', () => {
    const many = Array.from({ length: 100 }, (_, i) => ({
      type: 'members' as const,
      id: String(i),
      label: `Person ${i}`,
    }))
    expect(rankEntities(many, 'person', 10)).toHaveLength(10)
  })
})
