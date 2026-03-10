import { describe, expect, it } from 'vitest'
import {
  coercePositions,
  getPositionI18nKey,
  getPositionsForSport,
  getSelectablePositions,
  isPositionValidForSport,
  normalizePositionsForSport,
} from './memberPositions'

describe('memberPositions', () => {
  it('returns sport-specific volleyball positions', () => {
    expect(getPositionsForSport('volleyball')).toEqual([
      'setter',
      'outside',
      'middle',
      'opposite',
      'libero',
      'coach',
      'other',
    ])
  })

  it('returns sport-specific basketball positions', () => {
    expect(getPositionsForSport('basketball')).toEqual([
      'point_guard',
      'shooting_guard',
      'small_forward',
      'power_forward',
      'center',
      'coach',
      'other',
    ])
  })

  it('coerces both string and array inputs safely', () => {
    expect(coercePositions('setter')).toEqual(['setter'])
    expect(coercePositions(['setter', 'center', 'unknown'])).toEqual(['setter', 'center'])
    expect(coercePositions(123)).toEqual([])
  })

  it('normalizes out-of-sport and invalid values to other', () => {
    expect(normalizePositionsForSport(['center'], 'volleyball')).toEqual(['other'])
    expect(normalizePositionsForSport(['outside', 'invalid'], 'volleyball')).toEqual(['outside'])
    expect(normalizePositionsForSport([], 'basketball')).toEqual(['other'])
  })

  it('keeps legacy value visible in selectable list', () => {
    const selectable = getSelectablePositions('volleyball', ['center'])
    expect(selectable[0]).toBe('center')
    expect(selectable).toContain('setter')
    expect(selectable).toContain('other')
  })

  it('maps known i18n keys and validates sport compatibility', () => {
    expect(getPositionI18nKey('shooting_guard')).toBe('positionShootingGuard')
    expect(getPositionI18nKey('unknown')).toBeNull()

    expect(isPositionValidForSport('center', 'basketball')).toBe(true)
    expect(isPositionValidForSport('center', 'volleyball')).toBe(false)
  })
})
