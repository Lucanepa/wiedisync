import { useState, useEffect, useCallback } from 'react'
import i18n from '../../i18n'
import { todayLocal } from '../../utils/dateHelpers'
import type { Training, Participation, Absence, Member, MemberTeam } from '../../types'
import { fetchAllItems } from '../../lib/api'
import { asObj, memberName } from '../../utils/relations'

export type AttendanceBucket = 'present' | 'absent' | 'not_counted'

interface ClassifyArgs {
  // Mirrors Participation['status'] from src/types/index.ts (no 'absent' value exists in the schema).
  participationStatus: 'confirmed' | 'declined' | 'tentative' | 'waitlisted' | null | undefined
  hasAbsence: boolean
  isPast: boolean
}

/**
 * Classify a single (player, activity) cell.
 *
 * Priority order (NEW — different from pre-2026-05-05 behaviour):
 * 1. Confirmed RSVP wins over a covering absence.
 * 2. Declined RSVP → absent.
 * 3. Covering absence (one-off OR weekly) → absent.
 * 4. Past activity with no response → absent.
 * 5. Future activity with no response → not counted.
 */
export function classifyAttendance({ participationStatus, hasAbsence, isPast }: ClassifyArgs): AttendanceBucket {
  if (participationStatus === 'confirmed') return 'present'
  if (participationStatus === 'declined') return 'absent'
  if (hasAbsence) return 'absent'
  if (isPast) return 'absent'
  return 'not_counted'
}

export interface DateRange {
  from: string  // YYYY-MM-DD
  to: string    // YYYY-MM-DD
}

export interface PlayerStats {
  memberId: string
  memberName: string
  jerseyNumber: number
  total: number
  present: number
  absent: number
  percentage: number
  trend: ('present' | 'absent')[]
  lastResponseAt: string | null
}

export function useAttendanceStats(teamId: string | null, range: DateRange) {
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
      const { from: start, to: end } = range

      // Get team members
      const memberTeams = await fetchAllItems<MemberTeam & { member: Member | string }>('member_teams', {
        filter: { team: { _eq: teamId } },
        fields: ['*', 'member.*'],
      })

      const members = memberTeams
        .map((mt) => asObj<Member>(mt.member))
        .filter((m): m is Member => m !== null)
        .map(m => ({ ...m, id: String(m.id) }))

      if (members.length === 0) {
        setStats([])
        setIsLoading(false)
        return
      }

      // Get non-cancelled trainings in range
      const trainings = await fetchAllItems<Training>('trainings', {
        filter: { _and: [{ team: { _eq: teamId } }, { date: { _gte: start } }, { date: { _lte: end } }, { cancelled: { _eq: false } }] },
        sort: ['date'],
      })

      if (trainings.length === 0) {
        setStats([])
        setIsLoading(false)
        return
      }

      // Get all participations for these trainings
      const trainingIds = trainings.map((t) => t.id)
      const participations = await fetchAllItems<Participation>('participations', {
        filter: { _and: [{ activity_type: { _eq: 'training' } }, { activity_id: { _in: trainingIds } }] },
      })

      // Get absences for all members in the range
      const memberIds = members.map((m) => m.id)
      const absences = await fetchAllItems<Absence>('absences', {
        filter: { _and: [{ member: { _in: memberIds } }, { end_date: { _gte: start } }, { start_date: { _lte: end } }] },
      })

      // Build per-member stats
      const memberStats: Record<string, PlayerStats> = {}

      for (const member of members) {
        memberStats[member.id] = {
          memberId: member.id,
          memberName: memberName(member),
          jerseyNumber: member.number,
          total: trainings.length,
          present: 0,
          absent: 0,
          percentage: 0,
          trend: [],
          lastResponseAt: null,
        }
      }

      const today = todayLocal()

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

          const bucket = classifyAttendance({
            participationStatus: participation?.status ?? null,
            hasAbsence,
            isPast,
          })

          if (bucket === 'present') s.present++
          else if (bucket === 'absent') s.absent++
          // 'not_counted' → contributes nothing
        }
      }

      // Compute last response timestamp per member
      for (const member of members) {
        const memberParticipations = participations.filter((p) => p.member === member.id)
        if (memberParticipations.length > 0) {
          const latest = memberParticipations.reduce((a, b) =>
            (a.date_updated ?? '') > (b.date_updated ?? '') ? a : b
          )
          memberStats[member.id].lastResponseAt = latest.date_updated ?? null
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
          const bucket = classifyAttendance({
            participationStatus: participation?.status ?? null,
            hasAbsence,
            isPast: true, // trend dots only show past trainings
          })
          trend.push(bucket === 'present' ? 'present' : 'absent')
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
        const total = pastTrainings.length + futureResponded
        return {
          ...s,
          total,
          percentage: total > 0 ? Math.round((s.present / total) * 100) : 0,
        }
      })
      result.sort((a, b) => b.percentage - a.percentage || a.memberName.localeCompare(b.memberName, i18n.language))

      setStats(result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [teamId, range.from, range.to])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { stats, isLoading, error, refetch: fetch }
}
