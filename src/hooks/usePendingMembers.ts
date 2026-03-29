import { useCollection } from '../lib/query'
import type { Member } from '../types'

export function usePendingMembers(teamId?: string) {
  const filter: Record<string, unknown> = teamId
    ? { _and: [{ coach_approved_team: { _eq: false } }, { requested_team: { _eq: teamId } }] }
    : { coach_approved_team: { _eq: false } }

  const result = useCollection<Member>('members', {
    filter,
    sort: ['-date_created'],
    all: true,
    enabled: !!teamId,
  })

  return { ...result, data: result.data ?? [] }
}
