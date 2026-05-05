import { describe, it, expect } from 'vitest'
import { classifyAttendance } from '../useAttendanceStats'

describe('classifyAttendance', () => {
  it('confirmed RSVP wins over a covering absence', () => {
    expect(classifyAttendance({ participationStatus: 'confirmed', hasAbsence: true, isPast: true })).toBe('present')
    expect(classifyAttendance({ participationStatus: 'confirmed', hasAbsence: true, isPast: false })).toBe('present')
  })

  it('declined RSVP → absent', () => {
    expect(classifyAttendance({ participationStatus: 'declined', hasAbsence: false, isPast: true })).toBe('absent')
    expect(classifyAttendance({ participationStatus: 'declined', hasAbsence: false, isPast: false })).toBe('absent')
  })

  it('covering absence with no overriding RSVP → absent (was previously "excused")', () => {
    expect(classifyAttendance({ participationStatus: null, hasAbsence: true, isPast: true })).toBe('absent')
    expect(classifyAttendance({ participationStatus: null, hasAbsence: true, isPast: false })).toBe('absent')
    expect(classifyAttendance({ participationStatus: undefined, hasAbsence: true, isPast: true })).toBe('absent')
  })

  it('past activity with no response → absent', () => {
    expect(classifyAttendance({ participationStatus: null, hasAbsence: false, isPast: true })).toBe('absent')
  })

  it('future activity with no response → not counted', () => {
    expect(classifyAttendance({ participationStatus: null, hasAbsence: false, isPast: false })).toBe('not_counted')
  })

  it('tentative is treated as not-confirmed (not counted toward present)', () => {
    // tentative is neither present nor absent in the dashboard semantics
    expect(classifyAttendance({ participationStatus: 'tentative', hasAbsence: false, isPast: true })).toBe('absent')
    expect(classifyAttendance({ participationStatus: 'tentative', hasAbsence: false, isPast: false })).toBe('not_counted')
  })
})
