import { describe, it, expect } from 'vitest'
import {
  getWeekDays,
  getBlockPixelPosition,
  WEEK_START_HOUR,
  WEEK_END_HOUR,
} from './weekView'

describe('getWeekDays', () => {
  it('returns 7 consecutive days starting Monday for a midweek anchor', () => {
    // 2026-04-23 is a Thursday
    const days = getWeekDays(new Date(2026, 3, 23))
    expect(days).toHaveLength(7)
    expect(days[0].getDay()).toBe(1) // Monday
    expect(days[0].getDate()).toBe(20) // Mon 2026-04-20
    expect(days[6].getDate()).toBe(26) // Sun 2026-04-26
    expect(days[6].getDay()).toBe(0)
  })

  it('treats Monday itself as the start of its own week', () => {
    const days = getWeekDays(new Date(2026, 3, 20)) // Mon
    expect(days[0].getDate()).toBe(20)
  })

  it('treats Sunday as the end of the prior Monday-started week', () => {
    const days = getWeekDays(new Date(2026, 3, 26)) // Sun
    expect(days[0].getDate()).toBe(20)
    expect(days[6].getDate()).toBe(26)
  })
})

describe('getBlockPixelPosition', () => {
  const PX = 60 // 60px per hour → easy math

  it('positions an 18:00 game so the 45min warm-up puts top at 17:15', () => {
    // 17:15 − 14:00 = 3h15m = 3.25h → 195px from top
    // Height = 2h45m = 2.75h → 165px
    const pos = getBlockPixelPosition('18:00', PX)
    expect(pos).not.toBeNull()
    expect(pos!.top).toBeCloseTo(195, 0)
    expect(pos!.height).toBeCloseTo(165, 0)
  })

  it('positions a 19:00 game with top=18:15 and height 165px', () => {
    // 19:00 game → block 18:15-21:00, fully inside 14-22 window
    // Top = 18:15 - 14:00 = 4h15m → 255px
    // Height = 2h45m → 165px
    const pos = getBlockPixelPosition('19:00', PX)
    expect(pos!.top).toBeCloseTo(255, 0)
    expect(pos!.height).toBeCloseTo(165, 0)
  })

  it('clamps a 20:30 game at the upper window edge', () => {
    // 20:30 game → block 19:45-22:30 → clamp end to 22:00
    // Top = 19:45 - 14:00 = 5h45m → 345px
    // Height = 22:00 - 19:45 = 2h15m → 135px
    const pos = getBlockPixelPosition('20:30', PX)
    expect(pos!.top).toBeCloseTo(345, 0)
    expect(pos!.height).toBeCloseTo(135, 0)
  })

  it('returns null for a game entirely before the visible window', () => {
    // 10:00 → block 09:15-12:00, ends before 14:00 → not visible
    expect(getBlockPixelPosition('10:00', PX)).toBeNull()
  })

  it('returns null for a game entirely after the visible window', () => {
    // 23:00 → block 22:15-25:00 → starts at 22:15, after WEEK_END_HOUR 22
    expect(getBlockPixelPosition('23:00', PX)).toBeNull()
  })

  it('clamps blocks that straddle the lower window edge', () => {
    // 14:00 start → block 13:15-16:00 → clamp to 14:00-16:00
    const pos = getBlockPixelPosition('14:00', PX)
    expect(pos!.top).toBeCloseTo(0, 0)
    // Height: 16:00 - 14:00 = 2h = 120px
    expect(pos!.height).toBeCloseTo(120, 0)
  })

  it('clamps blocks that straddle the upper window edge', () => {
    // 21:00 start → block 20:15-23:00 → clamp end to 22:00
    // Top = 20:15 - 14:00 = 6.25h → 375px
    // Height = 22:00 - 20:15 = 1h45m → 105px
    const pos = getBlockPixelPosition('21:00', PX)
    expect(pos!.top).toBeCloseTo(375, 0)
    expect(pos!.height).toBeCloseTo(105, 0)
  })

  it('returns null for unparseable time', () => {
    expect(getBlockPixelPosition('nope', PX)).toBeNull()
    expect(getBlockPixelPosition('', PX)).toBeNull()
  })
})

describe('window constants', () => {
  it('exposes 14-22 as the visible hour window', () => {
    expect(WEEK_START_HOUR).toBe(14)
    expect(WEEK_END_HOUR).toBe(22)
  })
})
