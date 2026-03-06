import { timeToMinutes } from '../../../utils/dateHelpers'
import type { HallSlot } from '../../../types'

export const START_HOUR = 10
export const END_HOUR = 22
export const SLOT_MINUTES = 15 // minutes per grid row
export const SLOT_HEIGHT = 16 // px per 15-min row
export const TOTAL_ROWS = (END_HOUR - START_HOUR) * (60 / SLOT_MINUTES)

/** Per-day active time ranges (in minutes from midnight) */
const WEEKDAY_START = 16 * 60       // 16:00
const WEEKDAY_END = 22 * 60         // 22:00
const WEEKEND_START = 10 * 60 + 30  // 10:30
const WEEKEND_END = 20 * 60         // 20:00

/** Returns active time range [startMin, endMin] for a day index (0=Mon..6=Sun) */
export function getDayRange(dayIndex: number): { startMin: number; endMin: number } {
  const isWeekend = dayIndex === 5 || dayIndex === 6
  return {
    startMin: isWeekend ? WEEKEND_START : WEEKDAY_START,
    endMin: isWeekend ? WEEKEND_END : WEEKDAY_END,
  }
}

export interface PositionedSlot {
  slot: HallSlot
  top: number          // px from grid top
  height: number       // px
  left: number         // percentage (0-100)
  width: number        // percentage (0-100)
  dayIndex: number     // 0=Mon..6=Sun
}

/** Converts a time string to pixel offset from grid top */
export function timeToTop(time: string, baseMinute = START_HOUR * 60): number {
  const minutes = timeToMinutes(time)
  return ((minutes - baseMinute) / SLOT_MINUTES) * SLOT_HEIGHT
}

/** Converts a pixel offset from grid top to minutes since midnight */
export function topToMinutes(top: number, baseMinute = START_HOUR * 60): number {
  return Math.round(top / SLOT_HEIGHT) * SLOT_MINUTES + baseMinute
}

/**
 * Positions slots within each day column. Overlapping slots stack on top of each other
 * (full width) instead of being placed side-by-side.
 */
export function positionSlots(slots: HallSlot[], baseMinute = START_HOUR * 60): PositionedSlot[] {
  const result: PositionedSlot[] = []

  for (const slot of slots) {
    const startMin = timeToMinutes(slot.start_time)
    const endMin = timeToMinutes(slot.end_time)

    result.push({
      slot,
      top: ((startMin - baseMinute) / SLOT_MINUTES) * SLOT_HEIGHT,
      height: ((endMin - startMin) / SLOT_MINUTES) * SLOT_HEIGHT,
      left: 0,
      width: 100,
      dayIndex: slot.day_of_week,
    })
  }

  return result
}

/**
 * Positions slots grouped by (day, hall). Overlapping slots in the same hall
 * stack on top of each other (full width) instead of being placed side-by-side.
 */
export function positionSlotsMultiHall(slots: HallSlot[], baseMinute = START_HOUR * 60): PositionedSlot[] {
  const result: PositionedSlot[] = []

  for (const slot of slots) {
    const startMin = timeToMinutes(slot.start_time)
    const endMin = timeToMinutes(slot.end_time)

    result.push({
      slot,
      top: ((startMin - baseMinute) / SLOT_MINUTES) * SLOT_HEIGHT,
      height: ((endMin - startMin) / SLOT_MINUTES) * SLOT_HEIGHT,
      left: 0,
      width: 100,
      dayIndex: slot.day_of_week,
    })
  }

  return result
}

/** Generates time labels for the grid (every SLOT_MINUTES from startHour to endHour) */
export function generateTimeLabels(startHour = START_HOUR, endHour = END_HOUR): { time: string; isFullHour: boolean }[] {
  const labels: { time: string; isFullHour: boolean }[] = []
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      labels.push({
        time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        isFullHour: m === 0,
      })
    }
  }
  return labels
}

/** Compute a smart visible start hour for a day based on actual slots (30min before earliest slot, floored to hour) */
export function getSmartStartHour(daySlots: HallSlot[], dayIndex: number): number {
  if (daySlots.length === 0) return getDayRange(dayIndex).startMin / 60 | 0
  let earliest = Infinity
  for (const s of daySlots) {
    earliest = Math.min(earliest, timeToMinutes(s.start_time))
  }
  // 30 min before earliest, floored to the hour
  return Math.max(Math.floor((earliest - 30) / 60), START_HOUR)
}

/** Compute a smart visible end hour for a day based on actual slots (ceiled to hour after latest slot) */
export function getSmartEndHour(daySlots: HallSlot[], dayIndex: number): number {
  if (daySlots.length === 0) return Math.ceil(getDayRange(dayIndex).endMin / 60)
  let latest = -Infinity
  for (const s of daySlots) {
    latest = Math.max(latest, timeToMinutes(s.end_time))
  }
  return Math.min(Math.ceil(latest / 60), END_HOUR)
}
