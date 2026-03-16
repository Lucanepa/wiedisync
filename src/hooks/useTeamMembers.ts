import { useState, useEffect, useCallback } from 'react'
import pb from '../pb'
import { coercePositions, normalizePositionsForSport } from '../utils/memberPositions'
import type { Member, MemberTeam, Team } from '../types'

export type ExpandedMemberTeam = MemberTeam & { expand?: { member?: Member } }

export function useTeamMembers(teamId: string | undefined, season?: string) {
  const [members, setMembers] = useState<ExpandedMemberTeam[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetch = useCallback(async () => {
    if (!teamId) {
      setMembers([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const team = await pb.collection('teams').getOne<Team>(teamId, { fields: 'id,sport' })
      const filter = season
        ? `team="${teamId}" && season="${season}"`
        : `team="${teamId}"`
      const result = await pb.collection('member_teams').getFullList<ExpandedMemberTeam>({
        filter,
        expand: 'member',
        sort: 'member',
      })
      const updates: Promise<unknown>[] = []
      const normalized = result.map((mt) => {
        const member = mt.expand?.member
        if (!member) return mt
        const originalPositions = coercePositions(member.position)
        const safePositions = normalizePositionsForSport(member.position, team.sport)
        if (originalPositions.join('|') !== safePositions.join('|')) {
          updates.push(pb.collection('members').update(member.id, { position: safePositions }))
          return {
            ...mt,
            expand: {
              ...mt.expand,
              member: { ...member, position: safePositions },
            },
          }
        }
        return mt
      })
      setMembers(normalized)
      if (updates.length > 0) {
        void Promise.allSettled(updates)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [teamId, season])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { members, isLoading, error, refetch: fetch }
}
