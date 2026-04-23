import { describe, it, expect, vi } from 'vitest'
import { buildManualGamePayload } from './manualGamePayload'
import type { ManualGameInput } from '../../../types'

const baseInput: ManualGameInput = {
  kscw_team: 5,
  type: 'home',
  opponent: 'Goldcoast Wadenswil 1',
  date: '2026-05-09',
  time: '16:00',
  hall: 3,
  league: 'Testspiel',
  round: '',
}

describe('buildManualGamePayload', () => {
  it('generates a manual_<uuid> game_id', () => {
    const uuid = '964bbdf4-9215-40a6-9672-c4e499f5eb80'
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(uuid)
    const out = buildManualGamePayload(baseInput, 'D2', '2025/2026')
    expect(out.game_id).toBe(`manual_${uuid}`)
    vi.restoreAllMocks()
  })

  it('home: puts KSCW team as home_team, opponent as away_team', () => {
    const out = buildManualGamePayload(baseInput, 'D2', '2025/2026')
    expect(out.home_team).toBe('D2')
    expect(out.away_team).toBe('Goldcoast Wadenswil 1')
    expect(out.type).toBe('home')
  })

  it('away: puts opponent as home_team, KSCW team as away_team', () => {
    const out = buildManualGamePayload({ ...baseInput, type: 'away', hall: null }, 'D2', '2025/2026')
    expect(out.home_team).toBe('Goldcoast Wadenswil 1')
    expect(out.away_team).toBe('D2')
    expect(out.type).toBe('away')
  })

  it('home: writes hall, nulls away_hall_json', () => {
    const out = buildManualGamePayload(baseInput, 'D2', '2025/2026')
    expect(out.hall).toBe(3)
    expect(out.away_hall_json).toBeNull()
  })

  it('away: writes away_hall_json, nulls hall', () => {
    const out = buildManualGamePayload(
      {
        ...baseInput,
        type: 'away',
        hall: null,
        away_hall_json: { name: 'TH Grüze', address: 'Grüzefeldstr. 18', city: '8404 Winterthur' },
      },
      'D2',
      '2025/2026',
    )
    expect(out.hall).toBeNull()
    expect(out.away_hall_json).toEqual({
      name: 'TH Grüze',
      address: 'Grüzefeldstr. 18',
      city: '8404 Winterthur',
    })
  })

  it('always stamps source=manual and svrz_push_status=null', () => {
    const out = buildManualGamePayload(baseInput, 'D2', '2025/2026')
    expect(out.source).toBe('manual')
    expect(out.svrz_push_status).toBeNull()
  })

  it('always stamps status=scheduled and initializes scores to 0', () => {
    const out = buildManualGamePayload(baseInput, 'D2', '2025/2026')
    expect(out.status).toBe('scheduled')
    expect(out.home_score).toBe(0)
    expect(out.away_score).toBe(0)
  })
})
