import { describe, it, expect } from 'vitest'
import { formatSvrzClipboard } from './svrzClipboard'
import type { Game, Team } from '../../../types'

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: '1',
    game_id: 'manual_test',
    home_team: 'Rhinos D3',
    away_team: 'Goldcoast Wadenswil 1',
    kscw_team: { id: 3, name: 'Rhinos D3' } as unknown as Team,
    hall: { name: 'Schulhaus Buchlern', address: 'Badenerstrasse 123', city: '8004 Zürich' } as unknown as string,
    away_hall_json: null,
    date: '2026-05-09',
    time: '16:00:00',
    league: 'Testspiel',
    round: '',
    season: '2025/2026',
    type: 'home',
    status: 'scheduled',
    home_score: 0,
    away_score: 0,
    sets_json: null,
    referees_json: [],
    source: 'manual',
    svrz_push_status: null,
    respond_by: '',
    min_participants: 0,
    ...overrides,
  } as Game
}

describe('formatSvrzClipboard', () => {
  it('formats a home game with league and hall', () => {
    const out = formatSvrzClipboard(makeGame())
    expect(out).toContain('Sat, 9 May 2026')
    expect(out).toContain('16:00')
    expect(out).toContain('Home: Rhinos D3 vs Goldcoast Wadenswil 1')
    expect(out).toContain('Schulhaus Buchlern')
    expect(out).toContain('Testspiel')
  })

  it('formats an away game with away_hall_json', () => {
    const out = formatSvrzClipboard(
      makeGame({
        type: 'away',
        home_team: 'Goldcoast Wadenswil 1',
        away_team: 'Rhinos D3',
        hall: null as unknown as string,
        away_hall_json: { name: 'TH Grüze', address: 'Grüzefeldstr. 18', city: '8404 Winterthur' },
      }),
    )
    expect(out).toContain('Away: Goldcoast Wadenswil 1 vs Rhinos D3')
    expect(out).toContain('TH Grüze')
    expect(out).toContain('Winterthur')
  })

  it('omits missing league / hall gracefully', () => {
    const out = formatSvrzClipboard(
      makeGame({ league: '', round: '', hall: null as unknown as string, away_hall_json: null }),
    )
    expect(out).toContain('Home: Rhinos D3 vs Goldcoast Wadenswil 1')
    expect(out.split('\n').length).toBe(2) // only date line + teams line
  })
})
