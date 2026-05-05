import { useMemo } from 'react'
import { useCollection } from '../lib/query'
import { useAuth } from './useAuth'
import { absenceCoversActivity } from '../utils/absenceHelpers'
import type { Absence, Participation } from '../types'

export function useMyCoveringAbsence(
  activityType: Participation['activity_type'],
  activityDate: string | undefined,
): { absence: Absence | null; hasAbsence: boolean; isLoading: boolean } {
  const { user } = useAuth()
  const dateOnly = activityDate?.split(' ')[0]?.split('T')[0] ?? ''
  const enabled = !!user && !!dateOnly

  const { data, isLoading } = useCollection<Absence>('absences', {
    filter: enabled
      ? { _and: [
          { member: { _eq: user!.id } },
          { start_date: { _lte: dateOnly } },
          { end_date: { _gte: dateOnly } },
        ] }
      : { id: { _eq: -1 } },
    limit: 5,
    enabled,
  })

  return useMemo(() => {
    const absences = data ?? []
    const match = dateOnly
      ? absences.find((a) => absenceCoversActivity(a, activityType, dateOnly)) ?? null
      : null
    return { absence: match, hasAbsence: !!match, isLoading: enabled && isLoading }
  }, [data, activityType, dateOnly, enabled, isLoading])
}
