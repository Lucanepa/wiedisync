import { describe, it, expect } from 'vitest'
import { getBlockWindow, blocksOverlap } from './gameBlock'

describe('getBlockWindow', () => {
  it('computes 2h45min around a 16:00 start', () => {
    expect(getBlockWindow('16:00')).toEqual({ start: '15:15', end: '18:00' })
  })

  it('handles the 18:00 spec example from the design doc', () => {
    expect(getBlockWindow('18:00')).toEqual({ start: '17:15', end: '20:00' })
  })

  it('accepts HH:MM:SS and ignores seconds', () => {
    expect(getBlockWindow('14:30:00')).toEqual({ start: '13:45', end: '16:30' })
  })

  it('handles a late-night start (cross-midnight window allowed)', () => {
    // 23:00 start → warmup at 22:15, ends at 25:00 (1am next day). Caller's responsibility.
    expect(getBlockWindow('23:00')).toEqual({ start: '22:15', end: '25:00' })
  })

  it('throws on unparseable input', () => {
    expect(() => getBlockWindow('nope')).toThrow()
  })
})

describe('blocksOverlap', () => {
  it('returns true for overlapping windows', () => {
    expect(blocksOverlap({ start: '15:15', end: '18:00' }, { start: '17:15', end: '20:00' })).toBe(
      true,
    )
  })

  it('returns false for back-to-back windows (touching endpoints do not overlap)', () => {
    expect(blocksOverlap({ start: '15:15', end: '18:00' }, { start: '18:00', end: '20:45' })).toBe(
      false,
    )
  })

  it('returns false for fully disjoint windows', () => {
    expect(blocksOverlap({ start: '10:00', end: '12:45' }, { start: '14:00', end: '16:45' })).toBe(
      false,
    )
  })

  it('returns true when one contains the other', () => {
    expect(blocksOverlap({ start: '14:00', end: '20:00' }, { start: '16:00', end: '18:00' })).toBe(
      true,
    )
  })
})
