import { useState, useEffect, useCallback } from 'react'
import { fetchItem, fetchAllItems, updateRecord } from '../lib/api'
import { coercePositions, normalizePositionsForSport } from '../utils/memberPositions'
import type { Member, MemberTeam, Team } from '../types'
import { asObj } from '../utils/relations'

export type ExpandedMemberTeam = Omit<MemberTeam, 'member'> & { member: (Member & { id: string }) | string }

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
      const team = await fetchItem<Team>('teams', teamId, { fields: ['id', 'sport'] })
      const filter: Record<string, unknown> = { team: { _eq: teamId } }
      if (season) filter.season = { _eq: season }
      const result = await fetchAllItems<ExpandedMemberTeam>('member_teams', {
        filter,
        fields: ['*', 'member.*'],
        sort: ['member'],
      })
      const updates: Promise<unknown>[] = []
      const normalized = result.map((mt) => {
        const member = asObj<Member>(mt.member)
        if (!member) return mt
        const originalPositions = coercePositions(member.position)
        const safePositions = normalizePositionsForSport(member.position, team.sport)
        if (originalPositions.join('|') !== safePositions.join('|')) {
          updates.push(updateRecord('members', member.id, { position: safePositions }))
          return {
            ...mt,
            member: { ...member, position: safePositions } as Member,
          } as ExpandedMemberTeam
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

/** Fetch members from multiple teams, deduplicating by member ID. */
export function useMultiTeamMembers(teamIds: string[]) {
  const [members, setMembers] = useState<ExpandedMemberTeam[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const key = teamIds.slice().sort().join(',')

  const fetch = useCallback(async () => {
    if (teamIds.length === 0) {
      setMembers([])
      setIsLoading(false)
      return
    }

    // Single team — delegate to simpler path
    if (teamIds.length === 1) {
      setIsLoading(true)
      setError(null)
      try {
        const result = await fetchAllItems<ExpandedMemberTeam>('member_teams', {
          filter: { team: { _eq: teamIds[0] } },
          fields: ['*', 'member.*'],
          sort: ['member'],
        })
        setMembers(result)
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        setIsLoading(false)
      }
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const result = await fetchAllItems<ExpandedMemberTeam>('member_teams', {
        filter: { team: { _in: teamIds } },
        fields: ['*', 'member.*'],
        sort: ['member'],
      })
      // Deduplicate by member ID — keep the first occurrence
      const seen = new Set<string>()
      const deduped = result.filter(mt => {
        const memberId = asObj<Member>(mt.member)?.id ?? (mt.member as string)
        if (seen.has(memberId)) return false
        seen.add(memberId)
        return true
      })
      setMembers(deduped)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { members, isLoading, error, refetch: fetch }
}
