import { useCallback, useEffect, useRef, useState } from 'react'
import { usePB } from './usePB'
import { useMutation } from './useMutation'
import { useAuth } from './useAuth'
import { useRealtime } from './useRealtime'
import type { Participation, Absence } from '../types'

/** Check if an absence's `affects` field matches the given activity type */
function absenceAffectsActivity(absence: Absence, activityType: Participation['activity_type']): boolean {
  const affects = absence.affects
  if (!affects || affects.length === 0 || affects.includes('all')) return true
  if (activityType === 'training' && affects.includes('trainings')) return true
  if (activityType === 'game' && affects.includes('games')) return true
  if (activityType === 'event') return true // events always affected
  return false
}

export function useParticipation(
  activityType: Participation['activity_type'],
  activityId: string,
  activityDate?: string,
  sessionId?: string,
  isStaff?: boolean,
) {
  const { user } = useAuth()

  const sessionFilter = sessionId ? ` && session_id="${sessionId}"` : ''
  const { data: participations, refetch } = usePB<Participation>('participations', {
    filter: user && activityId
      ? `member="${user.id}" && activity_type="${activityType}" && activity_id="${activityId}"${sessionFilter}`
      : '',
    perPage: 1,
    enabled: !!user && !!activityId,
  })

  const { data: absencesRaw } = usePB<Absence>('absences', {
    filter: user && activityDate
      ? `member="${user.id}" && start_date<="${activityDate}" && end_date>="${activityDate}"`
      : '',
    perPage: 5,
    enabled: !!user && !!activityDate,
  })

  const { create, update, remove } = useMutation<Participation>('participations')

  // Realtime: refetch when any participation for this activity changes
  useRealtime<Participation>('participations', (e) => {
    if (e.record.activity_id === activityId && e.record.member === user?.id) {
      refetch()
    }
  })

  // Optimistic status: shown immediately while API call is in-flight
  const [optimisticStatus, setOptimisticStatus] = useState<Participation['status'] | null>(null)
  const [saveConfirmed, setSaveConfirmed] = useState(false)

  const participation = participations[0] ?? null

  // Filter absences to those that actually affect this activity type
  const hasAbsence = absencesRaw.some((a) => absenceAffectsActivity(a, activityType))

  // Auto-decline when absent and no participation exists yet (or existing is not declined)
  const autoDeclineRef = useRef(false)
  useEffect(() => {
    if (!hasAbsence || !user || !activityId) return
    if (autoDeclineRef.current) return // already attempted

    // If no participation record, or existing is not declined → auto-decline
    if (!participation) {
      autoDeclineRef.current = true
      create({
        member: user.id,
        activity_type: activityType,
        activity_id: activityId,
        status: 'declined',
        note: '',
        guest_count: 0,
        is_staff: isStaff ?? false,
        ...(sessionId ? { session_id: sessionId } : {}),
      }).then(() => refetch()).catch(() => {})
    } else if (participation.status !== 'declined') {
      autoDeclineRef.current = true
      update(participation.id, { status: 'declined', guest_count: 0 })
        .then(() => refetch()).catch(() => {})
    }
  }, [hasAbsence, user, activityId, participation, activityType, isStaff, sessionId, create, update, refetch])

  // Reset auto-decline flag when activity changes
  useEffect(() => {
    autoDeclineRef.current = false
  }, [activityId])

  const setStatus = useCallback(async (status: Participation['status'], note = '', guestCount = 0) => {
    if (!user) return
    // Optimistic update — show status immediately
    setOptimisticStatus(status)
    setSaveConfirmed(false)
    try {
      if (participation) {
        await update(participation.id, { status, note, guest_count: guestCount })
      } else {
        await create({
          member: user.id,
          activity_type: activityType,
          activity_id: activityId,
          status,
          note,
          guest_count: guestCount,
          is_staff: isStaff ?? false,
          ...(sessionId ? { session_id: sessionId } : {}),
        })
      }
      setSaveConfirmed(true)
      refetch()
    } catch {
      // Revert optimistic update on failure
      setOptimisticStatus(null)
    }
  }, [user, participation, activityType, activityId, isStaff, sessionId, create, update, refetch])

  const clearStatus = useCallback(async () => {
    if (participation) {
      setOptimisticStatus(null)
      setSaveConfirmed(false)
      try {
        await remove(participation.id)
        refetch()
      } catch {
        // Revert — restore the original status
        setOptimisticStatus(participation.status)
      }
    }
  }, [participation, remove, refetch])

  // Clear optimistic status once server data catches up
  const serverStatus = participation?.status ?? null
  const displayStatus = optimisticStatus ?? serverStatus

  return {
    participation,
    hasAbsence,
    effectiveStatus: displayStatus,
    note: participation?.note ?? '',
    setStatus,
    clearStatus,
    refetch,
    saveConfirmed,
    dismissConfirmed: useCallback(() => setSaveConfirmed(false), []),
  }
}

export function useTeamParticipations(
  activityType: Participation['activity_type'],
  activityId: string,
  memberIds: string[],
  sessionId?: string,
) {
  const memberFilter = memberIds.length > 0
    ? memberIds.map((id) => `member="${id}"`).join(' || ')
    : 'member=""'

  const sessionFilter = sessionId ? ` && session_id="${sessionId}"` : ''
  const { data, refetch, isLoading } = usePB<Participation>('participations', {
    filter: activityId
      ? `(${memberFilter}) && activity_type="${activityType}" && activity_id="${activityId}"${sessionFilter}`
      : '',
    all: true,
    enabled: !!activityId && memberIds.length > 0,
  })

  return { participations: data, refetch, isLoading }
}

/** Fetch all participations for an event across all sessions (for roster aggregation) */
export function useAllEventParticipations(
  activityId: string,
  memberIds: string[],
) {
  const memberFilter = memberIds.length > 0
    ? memberIds.map((id) => `member="${id}"`).join(' || ')
    : 'member=""'

  const { data, refetch, isLoading } = usePB<Participation>('participations', {
    filter: activityId
      ? `(${memberFilter}) && activity_type="event" && activity_id="${activityId}"`
      : '',
    all: true,
    enabled: !!activityId && memberIds.length > 0,
  })

  return { participations: data, refetch, isLoading }
}
