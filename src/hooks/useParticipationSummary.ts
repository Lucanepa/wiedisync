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

  const confirmedParts = data.filter(p => p.status === 'confirmed')
  const tentativeParts = data.filter(p => p.status === 'tentative')
  const confirmed = confirmedParts.length
  const tentative = tentativeParts.length
  const declined = data.filter(p => p.status === 'declined').length
  const waitlisted = data.filter(p => p.status === 'waitlisted').length
  const guests = data.reduce((sum, p) => sum + (p.guest_count ?? 0), 0)

  return {
    confirmed,
    tentative,
    declined,
    waitlisted,
    guests,
    total: data.length,
    totalWithGuests: data.length + guests,
    participations: data,
  }
}
