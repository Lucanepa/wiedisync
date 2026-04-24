import { describe, it, expect } from 'vitest'
import { pixelDeltaToSnappedMinutes, applyTimeDelta, SNAP_STEP_MINUTES } from './weekDnd'

describe('pixelDeltaToSnappedMinutes', () => {
  it('snaps to 15-minute increments', () => {
    // At 60 px/hour, 37px drag = 37 minutes, snap → 30 min
    expect(pixelDeltaToSnappedMinutes(37, 60)).toBe(30)
    // 38 px = 38 min, snap → 45 min
    expect(pixelDeltaToSnappedMinutes(38, 60)).toBe(45)
  })

  it('snaps negative deltas', () => {
    // -22px at 60px/h = -22 min, snap → -15 min
    expect(pixelDeltaToSnappedMinutes(-22, 60)).toBe(-15)
    // -23px = -23 min, snap → -30 min
    expect(pixelDeltaToSnappedMinutes(-23, 60)).toBe(-30)
  })

  it('zero delta yields zero', () => {
    expect(pixelDeltaToSnappedMinutes(0, 60)).toBe(0)
  })

  it('scales correctly at 48 px/hour', () => {
    // 48 px = 1 hour = 60 min → snap to 60
    expect(pixelDeltaToSnappedMinutes(48, 48)).toBe(60)
    // 24 px = 30 min → snap to 30
    expect(pixelDeltaToSnappedMinutes(24, 48)).toBe(30)
    // 20 px at 48 px/h = 25 min → snap to 30 (nearest 15)
    expect(pixelDeltaToSnappedMinutes(20, 48)).toBe(30)
  })
})

describe('applyTimeDelta', () => {
  it('adds minutes to an HH:MM time', () => {
    expect(applyTimeDelta('18:00', 30)).toBe('18:30')
    expect(applyTimeDelta('18:45', 15)).toBe('19:00')
    expect(applyTimeDelta('19:30', -45)).toBe('18:45')
  })

  it('zero-pads single-digit minutes and hours', () => {
    expect(applyTimeDelta('08:05', 0)).toBe('08:05')
    expect(applyTimeDelta('09:55', 10)).toBe('10:05')
  })

  it('handles HH:MM:SS input by dropping seconds', () => {
    expect(applyTimeDelta('18:00:00', 15)).toBe('18:15')
  })

  it('clamps to 00:00 if the delta would go negative', () => {
    expect(applyTimeDelta('00:15', -30)).toBe('00:00')
  })

  it('clamps to 23:59 if the delta would exceed 24h', () => {
    expect(applyTimeDelta('23:30', 60)).toBe('23:59')
  })
})

describe('SNAP_STEP_MINUTES', () => {
  it('is 15', () => {
    expect(SNAP_STEP_MINUTES).toBe(15)
  })
})
