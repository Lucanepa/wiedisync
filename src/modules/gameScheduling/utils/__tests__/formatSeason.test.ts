import { describe, it, expect } from 'vitest'
import { currentSeasonLong, formatSeasonShort } from '../formatSeason'

describe('formatSeasonShort', () => {
  it('converts YYYY/YYYY to YYYY/YY', () => {
    expect(formatSeasonShort('2025/2026')).toBe('2025/26')
    expect(formatSeasonShort('2026/2027')).toBe('2026/27')
    expect(formatSeasonShort('2099/2100')).toBe('2099/00')
  })

  it('is idempotent on already-short form', () => {
    expect(formatSeasonShort('2025/26')).toBe('2025/26')
    expect(formatSeasonShort('2026/27')).toBe('2026/27')
  })

  it('returns empty string for nullish input', () => {
    expect(formatSeasonShort(null)).toBe('')
    expect(formatSeasonShort(undefined)).toBe('')
    expect(formatSeasonShort('')).toBe('')
  })

  it('leaves unrecognized formats unchanged', () => {
    expect(formatSeasonShort('Saison 25')).toBe('Saison 25')
    expect(formatSeasonShort('2025')).toBe('2025')
  })
})

describe('currentSeasonLong', () => {
  it('returns previous-season for dates before Jun 1', () => {
    expect(currentSeasonLong(new Date('2026-05-31T12:00:00Z'))).toBe('2025/2026')
    expect(currentSeasonLong(new Date('2026-01-15T12:00:00Z'))).toBe('2025/2026')
  })

  it('flips to new season on Jun 1', () => {
    expect(currentSeasonLong(new Date('2026-06-01T12:00:00Z'))).toBe('2026/2027')
    expect(currentSeasonLong(new Date('2026-06-15T12:00:00Z'))).toBe('2026/2027')
    expect(currentSeasonLong(new Date('2026-12-31T12:00:00Z'))).toBe('2026/2027')
  })

  it('handles year-boundary correctly', () => {
    expect(currentSeasonLong(new Date('2027-01-01T12:00:00Z'))).toBe('2026/2027')
    expect(currentSeasonLong(new Date('2027-05-31T12:00:00Z'))).toBe('2026/2027')
    expect(currentSeasonLong(new Date('2027-06-01T12:00:00Z'))).toBe('2027/2028')
  })
})
