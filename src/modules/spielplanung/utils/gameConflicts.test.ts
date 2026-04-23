import { describe, it, expect } from 'vitest'
import { checkConflicts } from './gameConflicts'
import type { Game } from '../../../types'

function makeGame(over: Record<string, unknown> = {}): Game {
  // Game's kscw_team / hall are typed as string by the schema, but Directus
  // returns integers at runtime. Cast to Game to keep tests readable.
  return {
    id: 100,
    game_id: 'x',
    home_team: 'H',
    away_team: 'A',
    kscw_team: 5,
    hall: 3,
    away_hall_json: null,
    date: '2026-05-09',
    time: '16:00:00',
    league: '',
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
    ...over,
  } as unknown as Game
}

describe('checkConflicts: same team same day', () => {
  it('flags an error when another game for the same team exists on the same date', () => {
    const r = checkConflicts(
      { kscw_team: 5, hall: null, date: '2026-05-09', time: '14:00', type: 'away' },
      [makeGame()],
    )
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]!.kind).toBe('same_team_same_day')
  })

  it('does NOT flag when editingId matches (self-edit)', () => {
    const r = checkConflicts(
      { editingId: 100, kscw_team: 5, hall: null, date: '2026-05-09', time: '14:00', type: 'away' },
      [makeGame()],
    )
    expect(r.errors).toHaveLength(0)
  })
})

describe('checkConflicts: hall overlap', () => {
  it('flags an error when two home games in the same hall overlap', () => {
    const r = checkConflicts(
      { kscw_team: 6, hall: 3, date: '2026-05-09', time: '17:00', type: 'home' },
      [makeGame({ id: 200, kscw_team: 7, time: '16:00:00' })],
    )
    expect(r.errors.some((e) => e.kind === 'hall_overlap')).toBe(true)
  })

  it('does NOT flag when the candidate is an away game (no hall)', () => {
    const r = checkConflicts(
      { kscw_team: 6, hall: null, date: '2026-05-09', time: '17:00', type: 'away' },
      [makeGame({ id: 200, kscw_team: 7, time: '16:00:00' })],
    )
    expect(r.errors.some((e) => e.kind === 'hall_overlap')).toBe(false)
  })

  it('does NOT flag when halls differ', () => {
    const r = checkConflicts(
      { kscw_team: 6, hall: 99, date: '2026-05-09', time: '17:00', type: 'home' },
      [makeGame({ id: 200, kscw_team: 7, hall: 3, time: '16:00:00' })],
    )
    expect(r.errors.some((e) => e.kind === 'hall_overlap')).toBe(false)
  })

  it('does NOT flag when times are fully disjoint', () => {
    const r = checkConflicts(
      { kscw_team: 6, hall: 3, date: '2026-05-09', time: '20:00', type: 'home' },
      [makeGame({ id: 200, kscw_team: 7, time: '13:00:00' })],
    )
    expect(r.errors.some((e) => e.kind === 'hall_overlap')).toBe(false)
  })
})

describe('checkConflicts: same team within two days', () => {
  it('warns when another game for the team is 1 day earlier', () => {
    const r = checkConflicts(
      { kscw_team: 5, hall: 3, date: '2026-05-10', time: '16:00', type: 'home' },
      [makeGame({ date: '2026-05-09' })],
    )
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]!.kind).toBe('same_team_within_two_days')
  })

  it('warns when another game is 2 days later', () => {
    const r = checkConflicts(
      { kscw_team: 5, hall: 3, date: '2026-05-07', time: '16:00', type: 'home' },
      [makeGame({ date: '2026-05-09' })],
    )
    expect(r.warnings).toHaveLength(1)
  })

  it('does NOT warn when the gap is 3+ days', () => {
    const r = checkConflicts(
      { kscw_team: 5, hall: 3, date: '2026-05-12', time: '16:00', type: 'home' },
      [makeGame({ date: '2026-05-09' })],
    )
    expect(r.warnings).toHaveLength(0)
  })

  it('does not double-count: same-day produces only the same-day error, not the warning', () => {
    const r = checkConflicts(
      { kscw_team: 5, hall: 3, date: '2026-05-09', time: '18:00', type: 'home' },
      [makeGame()],
    )
    expect(r.errors.some((e) => e.kind === 'same_team_same_day')).toBe(true)
    expect(r.warnings.some((w) => w.kind === 'same_team_within_two_days')).toBe(false)
  })
})

describe('checkConflicts: clean input returns no conflicts', () => {
  it('returns empty arrays when no games match any rule', () => {
    const r = checkConflicts(
      { kscw_team: 99, hall: 99, date: '2026-12-25', time: '16:00', type: 'home' },
      [makeGame()],
    )
    expect(r).toEqual({ errors: [], warnings: [] })
  })
})
