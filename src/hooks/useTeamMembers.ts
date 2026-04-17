import { useState, useEffect, useCallback } from 'react'
import { fetchItem, fetchAllItems, updateRecord } from '../lib/api'
import { coercePositions, normalizePositionsForSport } from '../utils/memberPositions'
import type { Member, MemberTeam, Team } from '../types'
import { asObj, relId } from '../utils/relations'

export type ExpandedMemberTeam = Omit<MemberTeam, 'member'> & { member: (Member & { id: string }) | string }

export function useTeamMembers(teamId: string | undefined, season?: string) {
  const [members, setMembers] = useState<ExpandedMemberTeam[]>([])
  // loadedKey is derived-state for isLoading: undefined = never loaded (initial),
  // null = loaded "no teamId" state, string = loaded data for that key.
  // Deriving isLoading synchronously from key mismatch eliminates the flash
  // where isLoading briefly stays false between a teamId change and the effect
  // firing setIsLoading(true).
  const [loadedKey, setLoadedKey] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)

  const safeTeamId = teamId ? relId(teamId) : ''
  const requestedKey = safeTeamId ? `${safeTeamId}:${season ?? ''}` : null
  const isLoading = loadedKey !== requestedKey

  const fetch = useCallback(async () => {
    if (!safeTeamId) {
      setMembers([])
      setLoadedKey(null)
      return
    }

    setError(null)
    const key = `${safeTeamId}:${season ?? ''}`
    try {
      const team = await fetchItem<Team>('teams', safeTeamId, { fields: ['id', 'sport'] })
      const filter: Record<string, unknown> = { team: { _eq: safeTeamId } }
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
      setLoadedKey(key)
    }
  }, [safeTeamId, season])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { members, isLoading, error, refetch: fetch }
}

/** Fetch members from multiple teams, deduplicating by member ID. */
export function useMultiTeamMembers(teamIds: string[]) {
  const [members, setMembers] = useState<ExpandedMemberTeam[]>([])
  const [loadedKey, setLoadedKey] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)
  // Defensive: ensure all IDs are scalars
  const safeIds = teamIds.map(id => relId(id)).filter(Boolean)
  const key = safeIds.slice().sort().join(',')
  const requestedKey = safeIds.length === 0 ? null : key
  const isLoading = loadedKey !== requestedKey

  const fetch = useCallback(async () => {
    if (safeIds.length === 0) {
      setMembers([])
      setLoadedKey(null)
      return
    }

    // Single team — delegate to simpler path
    if (safeIds.length === 1) {
      setError(null)
      try {
        const result = await fetchAllItems<ExpandedMemberTeam>('member_teams', {
          filter: { team: { _eq: safeIds[0] } },
          fields: ['*', 'member.*'],
          sort: ['member'],
        })
        setMembers(result)
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        setLoadedKey(key)
      }
      return
    }

    setError(null)
    try {
      const result = await fetchAllItems<ExpandedMemberTeam>('member_teams', {
        filter: { team: { _in: safeIds } },
        fields: ['*', 'member.*'],
        sort: ['member'],
      })
      // Deduplicate by member ID — keep the first occurrence
      const seen = new Set<string>()
      const deduped = result.filter(mt => {
        const memberId = String(asObj<Member>(mt.member)?.id ?? mt.member)
        if (seen.has(memberId)) return false
        seen.add(memberId)
        return true
      })
      setMembers(deduped)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoadedKey(key)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { members, isLoading, error, refetch: fetch }
}
