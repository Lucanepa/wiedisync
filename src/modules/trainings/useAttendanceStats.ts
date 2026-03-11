import { useState, useEffect, useCallback } from 'react'
import pb from '../../pb'
import { getSeasonDateRange } from '../../utils/dateHelpers'
import type { Training, Participation, Absence, Member, MemberTeam } from '../../types'

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
      const memberTeams = await pb.collection('member_teams').getFullList<MemberTeam & { expand?: { member?: Member } }>({
        filter: `team="${teamId}"`,
        expand: 'member',
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
      const trainings = await pb.collection('trainings').getFullList<Training>({
        filter: `team="${teamId}" && date>="${start}" && date<="${end}" && cancelled=false`,
        sort: 'date',
      })

      if (trainings.length === 0) {
        setStats([])
        setIsLoading(false)
        return
      }

      // Get all participations for these trainings
      const trainingIds = trainings.map((t) => t.id)
      const activityFilter = trainingIds.map((id) => `activity_id="${id}"`).join(' || ')
      const participations = await pb.collection('participations').getFullList<Participation>({
        filter: `activity_type="training" && (${activityFilter})`,
      })

      // Get absences for all members in the season
      const memberIds = members.map((m) => m.id)
      const memberFilter = memberIds.map((id) => `member="${id}"`).join(' || ')
      const absences = await pb.collection('absences').getFullList<Absence>({
        filter: `(${memberFilter}) && end_date>="${start}" && start_date<="${end}"`,
      })

      // Build per-member stats
      const memberStats: Record<string, PlayerStats> = {}

      for (const member of members) {
        memberStats[member.id] = {
          memberId: member.id,
          memberName: member.name,
          jerseyNumber: member.number,
          total: trainings.length,
          present: 0,
          absent: 0,
          excused: 0,
          percentage: 0,
          trend: [],
        }
      }

      // For each training, determine each member's status
      for (const training of trainings) {
        const trainingDate = training.date.split(' ')[0]

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
          } else {
            s.absent++
          }
        }
      }

      // Build trend (last 5 trainings)
      const lastTrainings = trainings.slice(-5)
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

      // Calculate percentage and sort
      const result = Object.values(memberStats).map((s) => ({
        ...s,
        percentage: s.total > 0 ? Math.round((s.present / (s.total - s.excused || 1)) * 100) : 0,
      }))
      result.sort((a, b) => b.percentage - a.percentage)

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
