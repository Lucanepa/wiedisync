import { useState, useEffect, useCallback } from 'react'
import { getSeasonDateRange } from '../../utils/dateHelpers'
import type { Training, Participation, Absence, Member, MemberTeam } from '../../types'
import { fetchAllItems } from '../../lib/api'

export interface PlayerStats {
  memberId: string
  memberName: string
  jerseyNumber: number
  total: number
  present: number
  absent: number
  excused: number
  percentage: number
  trend: ('present' | 'absent' | 'excused')[]
  lastResponseAt: string | null
}

export function useAttendanceStats(teamId: string | null, season: string) {
  const [stats, setStats] = useState<PlayerStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetch = useCallback(async () => {
    if (!teamId) {
      setStats([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const { start, end } = getSeasonDateRange(season)

      // Get team members
      const memberTeams = await fetchAllItems<MemberTeam & { expand?: { member?: Member } }>('member_teams', {
        filter: { team: { _eq: teamId } },
      })

      const members = memberTeams
        .map((mt) => mt.expand?.member)
        .filter((m): m is Member => m !== undefined)

      if (members.length === 0) {
        setStats([])
        setIsLoading(false)
        return
      }

      // Get non-cancelled trainings in season
      const trainings = await fetchAllItems<Training>('trainings', {
        filter: `team="${teamId}" && date>="${start}" && date<="${end}" && cancelled=false` as any,
        sort: ['date'],
      })

      if (trainings.length === 0) {
        setStats([])
        setIsLoading(false)
        return
      }

      // Get all participations for these trainings
      const trainingIds = trainings.map((t) => t.id)
      const activityFilter = trainingIds.map((id) => `activity_id="${id}"`).join(' || ')
      const participations = await fetchAllItems<Participation>('participations', {
        filter: `activity_type="training" && (${activityFilter})` as any,
      })

      // Get absences for all members in the season
      const memberIds = members.map((m) => m.id)
      const memberFilter = memberIds.map((id) => `member="${id}"`).join(' || ')
      const absences = await fetchAllItems<Absence>('absences', {
        filter: `(${memberFilter}) && end_date>="${start}" && start_date<="${end}"` as any,
      })

      // Build per-member stats
      const memberStats: Record<string, PlayerStats> = {}

      for (const member of members) {
        memberStats[member.id] = {
          memberId: member.id,
          memberName: member.name || `${member.first_name} ${member.last_name}`,
          jerseyNumber: member.number,
          total: trainings.length,
          present: 0,
          absent: 0,
          excused: 0,
          percentage: 0,
          trend: [],
          lastResponseAt: null,
        }
      }

      const today = new Date().toISOString().split('T')[0]

      // For each training, determine each member's status
      for (const training of trainings) {
        const trainingDate = training.date.split(' ')[0]
        const isPast = trainingDate <= today

        for (const member of members) {
          const s = memberStats[member.id]
          const participation = participations.find(
            (p) => p.member === member.id && p.activity_id === training.id,
          )
          const hasAbsence = absences.some(
            (a) => a.member === member.id && a.start_date <= trainingDate && a.end_date >= trainingDate,
          )

          if (hasAbsence) {
            s.excused++
          } else if (participation?.status === 'confirmed') {
            s.present++
          } else if (participation?.status === 'declined') {
            s.absent++
          } else if (isPast) {
            // Past training with no response → count as absent
            s.absent++
          }
          // Future training with no response → not counted
        }
      }

      // Compute last response timestamp per member
      for (const member of members) {
        const memberParticipations = participations.filter((p) => p.member === member.id)
        if (memberParticipations.length > 0) {
          const latest = memberParticipations.reduce((a, b) =>
            (a.updated ?? a.date_updated ?? '') > (b.updated ?? b.date_updated ?? '') ? a : b
          )
          memberStats[member.id].lastResponseAt = latest.updated ?? latest.date_updated ?? null
        }
      }

      // Build trend (last 5 past trainings)
      const pastTrainings = trainings.filter((t) => t.date.split(' ')[0] <= today)
      const lastTrainings = pastTrainings.slice(-5)
      for (const member of members) {
        const trend: PlayerStats['trend'] = []
        for (const training of lastTrainings) {
          const trainingDate = training.date.split(' ')[0]
          const participation = participations.find(
            (p) => p.member === member.id && p.activity_id === training.id,
          )
          const hasAbsence = absences.some(
            (a) => a.member === member.id && a.start_date <= trainingDate && a.end_date >= trainingDate,
          )

          if (hasAbsence) trend.push('excused')
          else if (participation?.status === 'confirmed') trend.push('present')
          else trend.push('absent')
        }
        memberStats[member.id].trend = trend
      }

      // Total = past trainings + future trainings where member explicitly responded
      // (future non-responses are excluded from the denominator)
      const futureTrainings = trainings.filter((t) => t.date.split(' ')[0] > today)
      const result = Object.values(memberStats).map((s) => {
        // Count future trainings where this member has an explicit response
        const futureResponded = futureTrainings.filter((t) => {
          const trainingDate = t.date.split(' ')[0]
          const hasParticipation = participations.some(
            (p) => p.member === s.memberId && p.activity_id === t.id,
          )
          const hasAbsence = absences.some(
            (a) => a.member === s.memberId && a.start_date <= trainingDate && a.end_date >= trainingDate,
          )
          return hasParticipation || hasAbsence
        }).length
        const countable = pastTrainings.length + futureResponded
        return {
          ...s,
          total: countable,
          percentage: countable > 0 ? Math.round((s.present / (countable - s.excused || 1)) * 100) : 0,
        }
      })
      result.sort((a, b) => b.percentage - a.percentage || a.memberName.localeCompare(b.memberName, 'de'))

      setStats(result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [teamId, season])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { stats, isLoading, error, refetch: fetch }
}
