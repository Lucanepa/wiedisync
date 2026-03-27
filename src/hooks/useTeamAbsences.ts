import { useState, useEffect, useCallback } from 'react'
import { fetchAllItems, fetchItem } from '../lib/api'
import type { Absence, Member, MemberTeam } from '../types'

export type AbsenceWithMember = Absence & { expand?: { member?: Member } }

export function useTeamAbsences(teamIds: string[], startDate: string, endDate: string) {
  const [absences, setAbsences] = useState<AbsenceWithMember[]>([])
  const [memberMap, setMemberMap] = useState<Record<string, Member>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Stable key for dependency tracking
  const teamIdsKey = teamIds.join(',')

  const fetch = useCallback(async () => {
    if (teamIds.length === 0) {
      setAbsences([])
      setMemberMap({})
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      // Get players from member_teams for all teams
      const memberTeams = await fetchAllItems<MemberTeam>('member_teams', {
        filter: { team: { _in: teamIds } },
      })
      const memberIdSet = new Set(memberTeams.map((mt) => mt.member))

      // Also include coaches and team_responsibles (they may not have member_teams records)
      for (const teamId of teamIds) {
        try {
          const team = await fetchItem<Record<string, unknown>>('teams', teamId)
          const coachIds: string[] = Array.isArray(team.coach) ? team.coach : team.coach ? [team.coach] : []
          const trIds: string[] = Array.isArray(team.team_responsible) ? team.team_responsible : team.team_responsible ? [team.team_responsible] : []
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
        setIsLoading(false)
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
        if (a.expand?.member) {
          mMap[a.member] = a.expand.member
        }
      }

      // Fetch member details for all team members (for "available" list)
      const missingIds = memberIds.filter((id) => !mMap[id])
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
      setIsLoading(false)
    }
  }, [teamIdsKey, startDate, endDate]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch()
  }, [fetch])

  return { absences, memberMap, isLoading, error, refetch: fetch }
}
