import { usePB } from './usePB'
import type { EventSession } from '../types'

export function useEventSessions(eventId: string) {
  const { data, refetch, isLoading } = usePB<EventSession>('event_sessions', {
    filter: eventId ? `event="${eventId}"` : '',
    sort: 'sort_order,date,start_time',
    perPage: 100,
    enabled: !!eventId,
  })

  return { sessions: data, refetch, isLoading }
}
