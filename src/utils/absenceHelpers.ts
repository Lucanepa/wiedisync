import { getDayOfWeek } from './dateHelpers'
import type { Absence, Participation } from '../types'

/**
 * Check if an absence covers a specific activity on a given date.
 * Handles both standard (date-range) and weekly (day-of-week) absences.
 */
export function absenceCoversActivity(
  absence: Absence,
  activityType: Participation['activity_type'],
  activityDate: string,
): boolean {
  // Date range check
  const date = activityDate.split(' ')[0]
  const start = absence.start_date.split(' ')[0]
  const end = absence.end_date.split(' ')[0]
  if (start > date || end < date) return false

  // Affects check
  const affects = absence.affects
  if (affects && affects.length > 0 && !affects.includes('all')) {
    if (activityType === 'training' && !affects.includes('trainings')) return false
    if (activityType === 'game' && !affects.includes('games')) return false
    if (activityType === 'event' && !affects.includes('events')) return false
  }

  // Weekly type: also check day of week
  if (absence.type === 'weekly') {
    const dow = getDayOfWeek(new Date(date))
    if (!absence.days_of_week?.includes(dow)) return false
  }

  return true
}
