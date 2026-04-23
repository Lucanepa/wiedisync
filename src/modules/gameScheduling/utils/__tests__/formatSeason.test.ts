import { describe, it, expect } from 'vitest'
import { formatSeasonShort } from '../formatSeason'

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
