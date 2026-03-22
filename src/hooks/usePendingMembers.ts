import { usePB } from './usePB'
import type { Member } from '../types'

export function usePendingMembers(teamId?: string) {
  const filter = teamId
    ? `coach_approved_team=false && requested_team="${teamId}"`
    : 'coach_approved_team=false'

  return usePB<Member>('members', {
    filter,
    sort: '-created',
    all: true,
    enabled: !!teamId,
  })
}
