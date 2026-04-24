import { describe, it, expect } from 'vitest'
import { canAccessSpielplanung } from './SpielplanerOrAdminRoute'

const base = { isAdmin: false, is_spielplaner: false, spielplanerTeamIds: [] as string[] }

describe('canAccessSpielplanung', () => {
  it('admits admins', () => {
    expect(canAccessSpielplanung({ ...base, isAdmin: true })).toBe(true)
  })

  it('admits club-wide spielplaners', () => {
    expect(canAccessSpielplanung({ ...base, is_spielplaner: true })).toBe(true)
  })

  it('admits scoped spielplaners with at least one assignment', () => {
    expect(canAccessSpielplanung({ ...base, spielplanerTeamIds: ['3'] })).toBe(true)
  })

  it('rejects users with none of the above', () => {
    expect(canAccessSpielplanung(base)).toBe(false)
  })

  it('rejects an empty spielplanerTeamIds array', () => {
    expect(canAccessSpielplanung({ ...base, spielplanerTeamIds: [] })).toBe(false)
  })
})
