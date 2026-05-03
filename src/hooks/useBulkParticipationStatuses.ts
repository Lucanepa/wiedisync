import { useMemo } from 'react'
import { useCollection } from '../lib/query'
import { useAuth } from './useAuth'
import { useRealtime } from './useRealtime'
import type { Participation, Absence } from '../types'
import { absenceCoversActivity } from '../utils/absenceHelpers'

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

  // Build a single filter for all participations: member=X && activity_type ∈ types
  // && activity_id ∈ ids. We MUST filter on activity_type as well — `(type, id)`
  // is the natural composite key for `participations`. A user can have separate
  // rows for `training:4` and `event:4` with different statuses; without the
  // type filter the JS map below collides them and the wrong row wins.
  const activityTypes = useMemo(() => Array.from(new Set(activities.map(a => a.type))), [activities])
  const activityIds = useMemo(() => activities.map(a => a.id), [activities])
  const participationFilter = useMemo((): Record<string, unknown> | undefined => {
    if (!user || activities.length === 0) return undefined
    return { _and: [
      { member: { _eq: user.id } },
      { activity_type: { _in: activityTypes } },
      { activity_id: { _in: activityIds } },
    ] }
  }, [user, activities, activityTypes, activityIds])

  // Determine date range for absences
  const { minDate, maxDate } = useMemo(() => {
    if (activities.length === 0) return { minDate: '', maxDate: '' }
    const dates = activities.map((a) => a.date).filter(Boolean).sort()
    return { minDate: dates[0] ?? '', maxDate: dates[dates.length - 1] ?? '' }
  }, [activities])

  const absenceFilter = useMemo((): Record<string, unknown> | undefined => {
    if (!user || !minDate || !maxDate) return undefined
    return { _and: [{ member: { _eq: user.id } }, { start_date: { _lte: maxDate } }, { end_date: { _gte: minDate } }] }
  }, [user, minDate, maxDate])

  const { data: participationsRaw, isLoading: partLoading, refetch: refetchParticipations } = useCollection<Participation>('participations', {
    filter: participationFilter,
    all: true,
    enabled: !!user && activities.length > 0,
  })
  const participations = participationsRaw ?? []

  const { data: absencesRaw, isLoading: absLoading } = useCollection<Absence>('absences', {
    filter: absenceFilter,
    limit: 50,
    enabled: !!user && !!minDate,
  })
  const absences = absencesRaw ?? []

  // Realtime: refetch when any participation for the current user changes
  const activityIdSet = useMemo(() => new Set(activities.map((a) => a.id)), [activities])
  useRealtime<Participation>('participations', (e) => {
    if (e.record.member === user?.id && activityIdSet.has(e.record.activity_id)) {
      refetchParticipations()
    }
  })

  const isLoading = partLoading || absLoading

  // Build lookup keyed by composite `type:id`. The numeric id alone is unsafe
  // when callers iterate mixed activity types (the home page passes trainings,
  // games and events together). A `training:1 declined` would otherwise be
  // overwritten by an `event:1 confirmed` for the same member, painting the
  // training row green. v4.4.12 fixed the input filter and `partByKey` lookup
  // but missed the output map — this is the rest of that fix.
  const statusMap = useMemo(() => {
    const map = new Map<string, Participation['status'] | 'absent'>()
    if (!user) return map

    const partByKey = new Map<string, Participation>()
    for (const p of participations) {
      partByKey.set(`${p.activity_type}:${p.activity_id}`, p)
    }

    for (const activity of activities) {
      const key = `${activity.type}:${activity.id}`
      const participation = partByKey.get(key)

      // Check if any absence covers this activity's date and type
      const hasAbsence = absences.some((a) => absenceCoversActivity(a, activity.type, activity.date))

      if (participation) {
        map.set(key, participation.status)
      } else if (hasAbsence) {
        // Will be auto-declined by useParticipation when the detail modal opens
        map.set(key, 'declined')
      }
    }

    return map
  }, [user, participations, absences, activities])

  const getStatus = useMemo(
    () => (type: Participation['activity_type'], id: string) => statusMap.get(`${type}:${id}`),
    [statusMap],
  )

  return { statusMap, getStatus, isLoading }
}
