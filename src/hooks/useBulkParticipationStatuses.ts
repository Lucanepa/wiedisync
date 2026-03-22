import { useMemo } from 'react'
import { usePB } from './usePB'
import { useAuth } from './useAuth'
import { useRealtime } from './useRealtime'
import type { Participation, Absence } from '../types'

/**
 * Bulk-fetch participation statuses for multiple activities in just 2 queries
 * (1 for participations, 1 for absences) instead of 2 per row.
 *
 * Includes realtime subscription so banners update when participation changes.
 * Returns a Map<activityId, effectiveStatus> that row components can look up.
 */
export function useBulkParticipationStatuses(
  activities: Array<{ id: string; type: Participation['activity_type']; date: string }>,
) {
  const { user } = useAuth()

  // Build a single filter for all participations: member=X && (activity_id=A || activity_id=B || ...)
  const participationFilter = useMemo(() => {
    if (!user || activities.length === 0) return ''
    const idClauses = activities.map((a) => `activity_id="${a.id}"`).join(' || ')
    return `member="${user.id}" && (${idClauses})`
  }, [user, activities])

  // Determine date range for absences
  const { minDate, maxDate } = useMemo(() => {
    if (activities.length === 0) return { minDate: '', maxDate: '' }
    const dates = activities.map((a) => a.date).filter(Boolean).sort()
    return { minDate: dates[0] ?? '', maxDate: dates[dates.length - 1] ?? '' }
  }, [activities])

  const absenceFilter = useMemo(() => {
    if (!user || !minDate || !maxDate) return ''
    return `member="${user.id}" && start_date<="${maxDate}" && end_date>="${minDate}"`
  }, [user, minDate, maxDate])

  const { data: participations, isLoading: partLoading, refetch: refetchParticipations } = usePB<Participation>('participations', {
    filter: participationFilter,
    all: true,
    enabled: !!user && activities.length > 0,
  })

  const { data: absences, isLoading: absLoading } = usePB<Absence>('absences', {
    filter: absenceFilter,
    perPage: 50,
    enabled: !!user && !!minDate,
  })

  // Realtime: refetch when any participation for the current user changes
  const activityIdSet = useMemo(() => new Set(activities.map((a) => a.id)), [activities])
  useRealtime<Participation>('participations', (e) => {
    if (e.record.member === user?.id && activityIdSet.has(e.record.activity_id)) {
      refetchParticipations()
    }
  })

  const isLoading = partLoading || absLoading

  // Build lookup: activityId → effectiveStatus
  const statusMap = useMemo(() => {
    const map = new Map<string, Participation['status'] | 'absent'>()
    if (!user) return map

    // Index participations by activity_id
    const partByActivity = new Map<string, Participation>()
    for (const p of participations) {
      partByActivity.set(p.activity_id, p)
    }

    for (const activity of activities) {
      const participation = partByActivity.get(activity.id)

      // Check if any absence covers this activity's date and type
      const hasAbsence = absences.some((a) => {
        if (a.start_date > activity.date || a.end_date < activity.date) return false
        const affects = a.affects
        if (!affects || affects.length === 0 || affects.includes('all')) return true
        if (activity.type === 'training' && affects.includes('trainings')) return true
        if (activity.type === 'game' && affects.includes('games')) return true
        if (activity.type === 'event') return true
        return false
      })

      if (participation) {
        map.set(activity.id, participation.status)
      } else if (hasAbsence) {
        // Will be auto-declined by useParticipation when the detail modal opens
        map.set(activity.id, 'declined')
      }
    }

    return map
  }, [user, participations, absences, activities])

  return { statusMap, isLoading }
}
