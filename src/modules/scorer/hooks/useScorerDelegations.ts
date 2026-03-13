import { useMemo, useCallback } from 'react'
import type { ScorerDelegation, Member } from '../../../types'
import { usePB } from '../../../hooks/usePB'
import { useRealtime } from '../../../hooks/useRealtime'
import { useAuth } from '../../../hooks/useAuth'
import pb from '../../../pb'
import { logActivity } from '../../../utils/logActivity'

export function useScorerDelegations() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const {
    data: delegations,
    isLoading,
    refetch,
  } = usePB<ScorerDelegation>('scorer_delegations', {
    filter: 'status = "pending"',
    sort: '-created',
    expand: 'game,from_member,to_member,from_team,to_team',
    perPage: 50,
    enabled: !!userId,
  })

  useRealtime<ScorerDelegation>('scorer_delegations', () => { refetch() }, ['create', 'update'])

  const pendingIncoming = useMemo(
    () => delegations.filter((d) => d.to_member === userId && d.status === 'pending'),
    [delegations, userId],
  )

  const pendingOutgoing = useMemo(
    () => delegations.filter((d) => d.from_member === userId && d.status === 'pending'),
    [delegations, userId],
  )

  const createDelegation = useCallback(
    async (
      gameId: string,
      role: ScorerDelegation['role'],
      toMemberId: string,
      fromTeamId: string,
      toTeamId: string,
    ) => {
      const sameTeam = fromTeamId === toTeamId
      const record = await pb.collection('scorer_delegations').create({
        game: gameId,
        role,
        from_member: userId,
        to_member: toMemberId,
        from_team: fromTeamId,
        to_team: toTeamId,
        same_team: sameTeam,
        status: sameTeam ? 'accepted' : 'pending',
      })
      logActivity('create', 'scorer_delegations', record.id, { game: gameId, role, to_member: toMemberId, same_team: sameTeam })
      refetch()
      return record as ScorerDelegation
    },
    [userId, refetch],
  )

  const acceptDelegation = useCallback(
    async (delegationId: string) => {
      await pb.collection('scorer_delegations').update(delegationId, { status: 'accepted' })
      logActivity('update', 'scorer_delegations', delegationId, { status: 'accepted' })
      refetch()
    },
    [refetch],
  )

  const declineDelegation = useCallback(
    async (delegationId: string) => {
      await pb.collection('scorer_delegations').update(delegationId, { status: 'declined' })
      logActivity('update', 'scorer_delegations', delegationId, { status: 'declined' })
      refetch()
    },
    [refetch],
  )

  /** Find pending outgoing delegation for a specific game + role */
  const getPendingForRole = useCallback(
    (gameId: string, role: string): ScorerDelegation | undefined =>
      pendingOutgoing.find((d) => d.game === gameId && d.role === role),
    [pendingOutgoing],
  )

  /** Get the target member name for a pending delegation */
  const getDelegationTargetName = useCallback(
    (delegation: ScorerDelegation, members: Member[]): string => {
      const m = members.find((mem) => mem.id === delegation.to_member)
      return m ? `${m.first_name} ${m.last_name}` : ''
    },
    [],
  )

  return {
    pendingIncoming,
    pendingOutgoing,
    isLoading,
    createDelegation,
    acceptDelegation,
    declineDelegation,
    getPendingForRole,
    getDelegationTargetName,
    refetch,
  }
}
