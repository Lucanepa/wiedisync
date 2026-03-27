import { usePB } from './usePB'
import type { Member } from '../types'

export function usePendingMembers(teamId?: string) {
  const filter: Record<string, unknown> = teamId
    ? { _and: [{ coach_approved_team: { _eq: false } }, { requested_team: { _eq: teamId } }] }
    : { coach_approved_team: { _eq: false } }

  return usePB<Member>('members', {
    filter,
    sort: '-created',
    all: true,
    enabled: !!teamId,
  })
}
