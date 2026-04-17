import { useState, useEffect, useCallback } from 'react'
import { fetchAllItems, fetchItem } from '../lib/api'
import type { Absence, Member, MemberTeam } from '../types'
import { asObj, flattenMemberIds } from '../utils/relations'

export type AbsenceWithMember = Absence & { member: Member | string }

export function useTeamAbsences(teamIds: string[], startDate: string, endDate: string) {
  const [absences, setAbsences] = useState<AbsenceWithMember[]>([])
  const [memberMap, setMemberMap] = useState<Record<string, Member>>({})
  // Derived loading: compare requested key to the one we've loaded. Prevents
  // the flash where isLoading stays false after teamIds flip but before the
  // refetch effect runs setIsLoading(true).
  const [loadedKey, setLoadedKey] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)

  // Stable key for dependency tracking
  const teamIdsKey = teamIds.join(',')
  const requestedKey = teamIds.length === 0 ? null : `${teamIdsKey}|${startDate}|${endDate}`
  const isLoading = loadedKey !== requestedKey

  const fetch = useCallback(async () => {
    if (teamIds.length === 0) {
      setAbsences([])
      setMemberMap({})
      setLoadedKey(null)
      return
    }

    const key = `${teamIdsKey}|${startDate}|${endDate}`
    setError(null)
    try {
      // Get players from member_teams for all teams
      const memberTeams = await fetchAllItems<MemberTeam>('member_teams', {
        filter: { team: { _in: teamIds } },
      })
      const memberIdSet = new Set(memberTeams.map((mt) => mt.member))

      // Also include coaches and team_responsibles (they may not have member_teams records)
      const validTeamIds = teamIds.filter((id) => id != null && id !== '' && id !== 'null' && id !== 'undefined')
      for (const teamId of validTeamIds) {
        try {
          const team = await fetchItem<Record<string, unknown>>('teams', teamId)
          const coachIds = flattenMemberIds(team.coach)
          const trIds = flattenMemberIds(team.team_responsible)
          for (const id of [...coachIds, ...trIds]) {
            if (id) memberIdSet.add(id)
          }
        } catch {
          // team fetch failed — continue
        }
      }

      const memberIds = [...memberIdSet]

      if (memberIds.length === 0) {
        setAbsences([])
        setMemberMap({})
        setLoadedKey(key)
        return
      }

      const result = await fetchAllItems<AbsenceWithMember>('absences', {
        filter: {
          _and: [
            { member: { _in: memberIds } },
            { end_date: { _gte: startDate } },
            { start_date: { _lte: endDate } },
          ],
        },
        fields: ['*', 'member.*'],
        sort: ['start_date'],
      })

      // Filter to absences that affect at least one of the selected teams
      // Empty affects, or affects containing 'all', means all teams are affected
      const teamIdSet = new Set(teamIds)
      const relevant = result.filter(
        (a) => !a.affects || a.affects.length === 0 || a.affects.includes('all') || a.affects.some((id) => teamIdSet.has(id)),
      )

      // Build member map from absence expands
      const mMap: Record<string, Member> = {}
      for (const a of relevant) {
        const memberObj = asObj<Member>(a.member)
        if (memberObj) {
          mMap[memberObj.id] = memberObj
        }
      }

      // Fetch member details for all team members (for "available" list)
      const knownIds = new Set(Object.keys(mMap))
      const missingIds = memberIds.filter((id) => !knownIds.has(id))
      if (missingIds.length > 0) {
        const members = await fetchAllItems<Member>('members', {
          filter: { id: { _in: missingIds } },
        })
        for (const m of members) {
          mMap[m.id] = m
        }
      }

      setAbsences(relevant)
      setMemberMap(mMap)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoadedKey(key)
    }
  }, [teamIdsKey, startDate, endDate]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch()
  }, [fetch])

  return { absences, memberMap, isLoading, error, refetch: fetch }
}
