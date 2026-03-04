import { usePB } from './usePB'
import type { Participation } from '../types'

export function useParticipationSummary(
  activityType: Participation['activity_type'],
  activityId: string,
) {
  const { data } = usePB<Participation>('participations', {
    filter: activityId
      ? `activity_type="${activityType}" && activity_id="${activityId}"`
      : '',
    perPage: 200,
    enabled: !!activityId,
  })

  const confirmed = data.filter(p => p.status === 'confirmed').length
  const tentative = data.filter(p => p.status === 'tentative').length
  const declined = data.filter(p => p.status === 'declined').length

  return {
    confirmed,
    tentative,
    declined,
    total: data.length,
    participations: data,
  }
}
