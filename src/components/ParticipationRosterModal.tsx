import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil } from 'lucide-react'
import Modal from '@/components/Modal'
import { useMultiTeamMembers } from '../hooks/useTeamMembers'
import { useTeamParticipations, useAllEventParticipations } from '../hooks/useParticipation'
import { useAuth } from '../hooks/useAuth'
import { useMutation } from '../hooks/useMutation'
import { useCollection } from '../lib/query'
import { fetchAllItems } from '../lib/api'
import { getFileUrl } from '../utils/fileUrl'
import type { Participation, Absence, Member, Team, EventSession } from '../types'
import { asObj, flattenMemberIds } from '../utils/relations'
import { formatDate, getDeadlineDate, formatRelativeTime, formatDateTimeCompact } from '../utils/dateHelpers'

interface ParticipationRosterModalProps {
  open: boolean
  onClose: () => void
  activityType: Participation['activity_type']
  activityId: string | null
  activityDate: string
  teamIds: string[]
  title: string
  respondBy?: string
  activityStartTime?: string
  maxPlayers?: number
  eventSessions?: EventSession[]
  participationMode?: 'whole' | 'per_day' | 'per_session' | ''
  showRsvpTime?: boolean
  allowMaybe?: boolean
}

function formatSessionLabel(session: EventSession): string {
  const dateStr = session.date?.split(' ')[0] ?? ''
  const d = new Date(dateStr + 'T00:00:00')
  const datePart = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  if (session.label) return session.label
  if (session.start_time) return `${datePart} ${session.start_time}${session.end_time ? '–' + session.end_time : ''}`
  return datePart
}

/** Clickable relative timestamp that toggles to absolute dd.mm.yy HH:mm on tap */
function RsvpTimestamp({ datetime, locale }: { datetime: string; locale: string }) {
  const [showAbsolute, setShowAbsolute] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setShowAbsolute(v => !v)}
      className="truncate text-[11px] text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
    >
      {showAbsolute ? formatDateTimeCompact(datetime) : formatRelativeTime(datetime, locale)}
    </button>
  )
}

export default function ParticipationRosterModal({
  open,
  onClose,
  activityType,
  activityId,
  activityDate,
  teamIds,
  title,
  respondBy,
  activityStartTime,
  maxPlayers,
  eventSessions,
  participationMode,
  showRsvpTime = true,
  allowMaybe = true,
}: ParticipationRosterModalProps) {
  const { t, i18n } = useTranslation('participation')
  const { t: te } = useTranslation('events')
  const { t: ta } = useTranslation('absences')
  const { members, isLoading: membersLoading } = useMultiTeamMembers(teamIds)
  const [absences, setAbsences] = useState<Absence[]>([])
  const [staffMembers, setStaffMembers] = useState<Member[]>([])
  const [activeSessionTab, setActiveSessionTab] = useState<string | null>(null) // null = overall
  const [statusFilter, setStatusFilter] = useState<string | null>(null) // null = "All"

  // Reset filter and editing state when modal opens
  useEffect(() => {
    if (open) {
      setStatusFilter(null)
      setEditingMemberId(null)
    }
  }, [open])

  // Fetch team leadership roles (coach, captain, team_responsible)
  const { data: teamsRaw } = useCollection<Team>('teams', {
    filter: teamIds.length > 0 ? { id: { _in: teamIds } } : undefined,
    fields: ['id', 'coach', 'captain', 'team_responsible'],
    enabled: teamIds.length > 0 && open,
  })
  const teams = teamsRaw ?? []
  const leadershipRoles = useMemo(() => {
    const map = new Map<string, string>()
    for (const team of teams) {
      for (const id of flattenMemberIds(team.coach)) if (!map.has(id)) map.set(id, 'coach')
      for (const id of flattenMemberIds(team.captain)) if (!map.has(id)) map.set(id, 'captain')
      for (const id of flattenMemberIds(team.team_responsible)) if (!map.has(id)) map.set(id, 'tr')
    }
    return map
  }, [teams])

  const { isCoachOf, teamResponsibleIds } = useAuth()

  const canEditRoster = (activityType === 'training' || activityType === 'game') &&
    teamIds.some(id => isCoachOf(id) || teamResponsibleIds.includes(id))

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [savingMemberIds, setSavingMemberIds] = useState<Set<string>>(new Set())
  const { create, update, remove } = useMutation<Participation>('participations')

  // For club-wide events (no team), fetch all participations and resolve members from them
  const [clubWideMembers, setClubWideMembers] = useState<Member[]>([])
  const [clubWideLoading, setClubWideLoading] = useState(false)
  const isClubWide = teamIds.length === 0

  const hasSessionMode = participationMode && participationMode !== 'whole' && eventSessions && eventSessions.length > 0

  // Club-wide: fetch all participations for the event, then resolve member info
  const { data: clubWideParticipationsRaw, isLoading: clubWidePartsLoading } = useCollection<Participation>('participations', {
    filter: isClubWide && activityId ? {
      _and: [
        { activity_type: { _eq: activityType } },
        { activity_id: { _eq: activityId } },
      ],
    } : undefined,
    all: true,
    enabled: isClubWide && !!activityId && open,
  })
  const clubWideParticipations = clubWideParticipationsRaw ?? []

  useEffect(() => {
    if (!isClubWide || !open || clubWideParticipations.length === 0) {
      setClubWideMembers([])
      return
    }
    setClubWideLoading(true)
    const uniqueMemberIds = [...new Set(clubWideParticipations.map(p => p.member))]
    fetchAllItems<Member>('members', {
      filter: { id: { _in: uniqueMemberIds } },
      fields: ['id', 'first_name', 'last_name', 'photo'],
    })
      .then(m => setClubWideMembers(m.sort((a, b) => (a.last_name ?? '').localeCompare(b.last_name ?? ''))))
      .catch(() => setClubWideMembers([]))
      .finally(() => setClubWideLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClubWide, open, clubWideParticipations.length])

  const memberList: Member[] = isClubWide
    ? clubWideMembers
    : members
        .map((mt) => asObj<Member>(mt.member))
        .filter((m): m is Member => m !== null)
        .map(m => ({ ...m, id: String(m.id) }))
        .sort((a, b) => (a.last_name ?? '').localeCompare(b.last_name ?? ''))

  const memberIds = memberList.map((m) => m.id)

  // For regular (non-session) mode, filter by session tab if active
  const { participations: regularParticipations, isLoading: regularLoading } = useTeamParticipations(
    activityType,
    activityId ?? '',
    isClubWide ? [] : memberIds, // skip for club-wide (we use clubWideParticipations)
    hasSessionMode ? (activeSessionTab ?? undefined) : undefined,
  )

  // For session mode overall tab: fetch ALL participations across sessions
  const { participations: allParticipations, isLoading: allLoading } = useAllEventParticipations(
    hasSessionMode && activeSessionTab === null && !isClubWide ? (activityId ?? '') : '',
    isClubWide ? [] : memberIds,
  )

  const participations = isClubWide
    ? clubWideParticipations
    : hasSessionMode && activeSessionTab === null
      ? allParticipations
      : regularParticipations
  const participationsLoading = isClubWide
    ? clubWidePartsLoading
    : hasSessionMode && activeSessionTab === null
      ? allLoading
      : regularLoading
  const isLoading = (isClubWide ? clubWideLoading || clubWidePartsLoading : membersLoading) || participationsLoading

  const handleStatusChange = useCallback(async (memberId: string, newStatus: string) => {
    setEditingMemberId(null)
    if (!activityId) return

    const currentParticipation = participations.find(p => p.member === memberId)
    const currentStatus = currentParticipation?.status ?? null

    // No change — user selected same status or cleared when already no response
    if (newStatus === (currentStatus ?? '')) return

    setSavingMemberIds(prev => new Set(prev).add(memberId))
    try {
      if (newStatus === '') {
        // Clear → delete participation record
        if (currentParticipation) {
          await remove(currentParticipation.id)
        }
      } else if (currentParticipation) {
        // Update existing record
        await update(currentParticipation.id, { status: newStatus })
      } else {
        // Create new record
        await create({
          member: memberId,
          activity_type: activityType,
          activity_id: activityId,
          status: newStatus,
          note: '',
          guest_count: 0,
          is_staff: false,
        })
      }
    } catch {
      // useMutation logs the error; UI reverts via refetch
    } finally {
      setSavingMemberIds(prev => {
        const next = new Set(prev)
        next.delete(memberId)
        return next
      })
    }
  }, [activityId, activityType, participations, create, update, remove])

  // Fetch staff participations (coaches/team_responsible who aren't in member_teams)
  useEffect(() => {
    if (!open || !activityId || isClubWide) return
    fetchAllItems<Participation>('participations', {
        filter: {
          _and: [
            { activity_type: { _eq: activityType } },
            { activity_id: { _eq: activityId } },
            { is_staff: { _eq: true } },
          ],
        },
      })
      .then(async (staffParts) => {
        // Filter out any that are already in the member list
        const staffOnlyParts = staffParts.filter((p) => !memberIds.includes(p.member))
        if (staffOnlyParts.length === 0) {
          setStaffMembers([])
          return
        }
        const staffMemberIds = [...new Set(staffOnlyParts.map((p) => p.member))]
        const members = await fetchAllItems<Member>('members', {
          filter: { id: { _in: staffMemberIds } },
          fields: ['id', 'first_name', 'last_name', 'photo'],
        })
        setStaffMembers(members.sort((a, b) => (a.last_name ?? '').localeCompare(b.last_name ?? '')))
      })
      .catch(() => setStaffMembers([]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activityId, activityType, isClubWide, memberIds.join(',')])

  // For the overall tab, compute per-member session counts
  const memberSessionCounts = useMemo(() => {
    if (!hasSessionMode || activeSessionTab !== null) return new Map<string, { confirmed: number; total: number }>()
    const map = new Map<string, { confirmed: number; total: number }>()
    const totalSessions = eventSessions!.length
    for (const m of memberList) {
      const memberParts = allParticipations.filter((p) => String(p.member) === String(m.id))
      const confirmed = memberParts.filter((p) => p.status === 'confirmed').length
      map.set(m.id, { confirmed, total: totalSessions })
    }
    return map
  }, [hasSessionMode, activeSessionTab, eventSessions, memberList, allParticipations])

  // Fetch absences overlapping activity date (same pattern as AttendanceSheet)
  const fetchAbsences = useCallback(async () => {
    if (!activityDate || memberIds.length === 0) return
    try {
      const dateStr = activityDate.split(' ')[0]
      const result = await fetchAllItems<Absence>('absences', {
        filter: {
          _and: [
            { member: { _in: memberIds } },
            { start_date: { _lte: dateStr } },
            { end_date: { _gte: dateStr } },
          ],
        },
      })
      setAbsences(result)
    } catch {
      // ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityDate, memberIds.join(',')])

  useEffect(() => {
    if (open && activityDate) fetchAbsences()
  }, [open, fetchAbsences, activityDate])

  // Members who are both players (in memberList) and staff (coach/TR) should be
  // treated as players — their is_staff participation counts as player participation.
  const memberIdSet = new Set(memberList.map(m => m.id))

  // Reclassify: if a participation is marked is_staff but the member is in the player list,
  // treat it as a player participation (not staff-only).
  const playerParticipations = participations.filter(p => !p.is_staff || memberIdSet.has(p.member))

  // For the overall tab on multi-session events, deduplicate by member so summary
  // counts reflect unique people, not slot-count. Use "best status" priority:
  // confirmed > tentative > waitlisted > declined (same logic as ParticipationSummary).
  const statusPriority: Record<string, number> = { confirmed: 4, tentative: 3, waitlisted: 2, declined: 1 }
  const summaryParticipations = (hasSessionMode && activeSessionTab === null)
    ? (() => {
        const byMember = new Map<string, Participation>()
        for (const p of playerParticipations) {
          const existing = byMember.get(p.member)
          if (!existing || (statusPriority[p.status] ?? 0) > (statusPriority[existing.status] ?? 0)) {
            byMember.set(p.member, p)
          }
        }
        return Array.from(byMember.values())
      })()
    : playerParticipations

  const confirmedParts = summaryParticipations.filter(p => p.status === 'confirmed')
  const confirmed = confirmedParts.length
  const confirmedGuests = confirmedParts.reduce((sum, p) => sum + (p.guest_count ?? 0), 0)
  const tentativeParts = summaryParticipations.filter(p => p.status === 'tentative')
  const tentative = tentativeParts.length
  const tentativeGuests = tentativeParts.reduce((sum, p) => sum + (p.guest_count ?? 0), 0)
  // Count absent members without a participation record as declined too
  const absentMemberIds = new Set(absences.map(a => a.member))
  const absentWithoutParticipation = memberList.filter(m =>
    absentMemberIds.has(String(m.id)) && !summaryParticipations.some(p => String(p.member) === String(m.id))
  ).length
  const declined = summaryParticipations.filter(p => p.status === 'declined').length + absentWithoutParticipation
  const waitlistedParts = summaryParticipations.filter(p => p.status === 'waitlisted')
    .sort((a, b) => (a.waitlisted_at ?? '').localeCompare(b.waitlisted_at ?? ''))
  const waitlisted = waitlistedParts.length
  const notResponded = memberList.length - summaryParticipations.length - absentWithoutParticipation
  const totalGuests = confirmedGuests + tentativeGuests

  // Staff counts — only staff who are NOT also players
  const staffParticipations = participations.filter(p => p.is_staff && !memberIdSet.has(p.member))
  // "Coach present" = staff-only confirmed + player-coaches confirmed
  const staffOnlyConfirmed = staffParticipations.filter(p => p.status === 'confirmed').length
  const playerCoachConfirmed = summaryParticipations.filter(p =>
    p.status === 'confirmed' && leadershipRoles.has(p.member)
  ).length
  const staffConfirmed = staffOnlyConfirmed + playerCoachConfirmed

  const deadlinePassed = respondBy
    ? getDeadlineDate(respondBy, activityStartTime) < new Date()
    : false

  function getInitials(member: Member) {
    return `${(member.first_name ?? '')[0] ?? ''}${(member.last_name ?? '')[0] ?? ''}`.toUpperCase()
  }

  function getMemberStatus(memberId: string): Participation['status'] | null {
    const absence = absences.find(a => a.member === memberId)
    if (absence) return 'declined'
    const p = participations.find(p => p.member === memberId)
    return p?.status ?? null
  }

  const reasonLabels: Record<string, string> = {
    injury: ta('reasonInjury'),
    vacation: ta('reasonVacation'),
    work: ta('reasonWork'),
    personal: ta('reasonPersonal'),
    other: ta('reasonOther'),
  }

  function getMemberAbsenceReason(memberId: string): string | null {
    const absence = absences.find(a => a.member === memberId)
    if (!absence) return null
    return reasonLabels[absence.reason] ?? null
  }

  function getStaffMemberStatus(memberId: string): Participation['status'] | null {
    const p = staffParticipations.find(p => p.member === memberId)
    return p?.status ?? null
  }

  const filteredMemberList = useMemo(() => {
    if (statusFilter === null) return memberList
    return memberList.filter((m) => {
      const s = getMemberStatus(m.id)
      if (statusFilter === 'confirmed') return s === 'confirmed'
      if (statusFilter === 'tentative') return s === 'tentative'
      if (statusFilter === 'declined') return s === 'declined' || (absentMemberIds.has(String(m.id)) && !participations.some(p => String(p.member) === String(m.id)))
      if (statusFilter === 'no_response') return s === null && !absentMemberIds.has(String(m.id))
      return true
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, memberList, participations, absences])

  // Compute short display names: first name only, disambiguate with last-name initials
  const displayNames = useMemo(() => {
    const names = new Map<string, string>()
    const allMembers = [...memberList, ...staffMembers]

    // Group by first name
    const byFirstName = new Map<string, typeof allMembers>()
    for (const m of allMembers) {
      const key = m.first_name ?? ''
      if (!byFirstName.has(key)) byFirstName.set(key, [])
      byFirstName.get(key)!.push(m)
    }

    for (const [firstName, group] of byFirstName) {
      if (group.length === 1) {
        names.set(String(group[0].id), firstName)
      } else {
        for (const m of group) {
          const others = group.filter(o => String(o.id) !== String(m.id))
          const lastName = m.last_name ?? ''
          let len = 1
          while (len < lastName.length) {
            const prefix = lastName.slice(0, len).toLowerCase()
            if (!others.some(o => (o.last_name ?? '').slice(0, len).toLowerCase() === prefix)) break
            len++
          }
          if (len >= lastName.length) {
            names.set(String(m.id), `${firstName} ${lastName}`)
          } else {
            names.set(String(m.id), `${firstName} ${lastName.slice(0, len)}.`)
          }
        }
      }
    }
    return names
  }, [memberList, staffMembers])

  const statusColors: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    tentative: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    declined: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    waitlisted: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  }

  const statusLabels: Record<string, string> = {
    confirmed: t('confirmed'),
    tentative: t('tentative'),
    declined: t('declined'),
    waitlisted: t('waitlisted'),
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      {/* Session tabs */}
      {hasSessionMode && (
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-600 dark:bg-gray-800">
          <button
            onClick={() => setActiveSessionTab(null)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeSessionTab === null
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {te('overallView')}
          </button>
          {eventSessions!.map((session) => (
            <button
              key={session.id}
              onClick={() => setActiveSessionTab(session.id)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeSessionTab === session.id
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {formatSessionLabel(session)}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">...</div>
      ) : (<>
      {/* Summary header */}
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <span className="text-green-600 dark:text-green-400">
          {confirmed}{confirmedGuests > 0 && `+${confirmedGuests}`} {t('confirmed')}
        </span>
        <span className="text-yellow-600 dark:text-yellow-400">
          {tentative}{tentativeGuests > 0 && `+${tentativeGuests}`} {t('tentative')}
        </span>
        <span className="text-red-600 dark:text-red-400">{declined} {t('declined')}</span>
        {waitlisted > 0 && (
          <span className="text-orange-600 dark:text-orange-400">{waitlisted} {t('waitlisted')}</span>
        )}
        <span className="text-gray-500 dark:text-gray-400">{notResponded} {t('notResponded')}</span>
        {totalGuests > 0 && (
          <span className="text-brand-600 dark:text-brand-400">
            {totalGuests} {t('guests')}
          </span>
        )}
        {staffConfirmed > 0 && (
          <span className="text-brand-600 dark:text-brand-400">
            {staffConfirmed} {t('staffPresent')}
          </span>
        )}
      </div>

      {/* Status filter chips */}
      {memberList.length > 0 && (
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
          {([
            { key: null, label: t('all'), count: memberList.length, activeClass: 'bg-gray-600 text-white dark:bg-gray-400 dark:text-gray-900' },
            { key: 'confirmed', label: t('confirmed'), count: confirmed, activeClass: 'bg-green-600 text-white dark:bg-green-500 dark:text-white' },
            { key: 'tentative', label: t('tentative'), count: tentative, activeClass: 'bg-yellow-500 text-white dark:bg-yellow-500 dark:text-white' },
            { key: 'declined', label: t('declined'), count: declined, activeClass: 'bg-red-600 text-white dark:bg-red-500 dark:text-white' },
            { key: 'no_response', label: t('notResponded'), count: notResponded, activeClass: 'bg-gray-500 text-white dark:bg-gray-500 dark:text-white' },
          ] as const).map((chip) => (
            <button
              key={chip.key ?? 'all'}
              onClick={() => setStatusFilter(chip.key)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                statusFilter === chip.key
                  ? chip.activeClass
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              {chip.key === null ? chip.label : `${chip.label} (${chip.count})`}
            </button>
          ))}
        </div>
      )}

      {/* Deadline banner */}
      {respondBy && (
        <div className={`mb-4 rounded-lg px-3 py-2 text-sm ${
          deadlinePassed
            ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
            : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
        }`}>
          {t('respondBy')}: {formatDate(respondBy.split(' ')[0])}{(() => {
            const [, rbTime] = (respondBy || '').split(' ')
            return rbTime && rbTime !== '00:00:00' ? `, ${rbTime.slice(0, 5)}` : ''
          })()}
          {deadlinePassed && ` — ${t('deadlinePassed')}`}
        </div>
      )}

      {/* Max players indicator for tournaments */}
      {maxPlayers != null && maxPlayers > 0 && (() => {
        const totalConfirmed = confirmed + confirmedGuests
        return (
          <div className={`mb-4 rounded-lg px-3 py-2 text-sm ${
            totalConfirmed >= maxPlayers
              ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
              : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
          }`}>
            {totalConfirmed >= maxPlayers
              ? t('full')
              : t('spotsLeft', { count: maxPlayers - totalConfirmed })}
            {` (${totalConfirmed}/${maxPlayers})`}
          </div>
        )
      })()}

      {/* Member list */}
      {memberList.length === 0 ? (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">{t('noResponses')}</div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto rounded-lg border dark:border-gray-700">
          {filteredMemberList.map((member) => {
            const status = getMemberStatus(member.id)
            const participation = participations.find(p => p.member === member.id)

            return (
              <div
                key={member.id}
                className="border-b last:border-b-0 dark:border-gray-700"
              >
                <div className="flex min-h-[44px] items-center gap-3 px-3 py-2 sm:min-h-0">
                {/* Avatar */}
                {member.photo ? (
                  <img
                    src={getFileUrl('members', member.id, member.photo)}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                    {getInitials(member)}
                  </div>
                )}

                {/* Name */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-900 dark:text-gray-100">
                    {displayNames.get(String(member.id)) ?? member.first_name}
                    {leadershipRoles.has(member.id) && (
                      <span className="ml-1.5 inline-block rounded bg-brand-100 px-1 py-px text-[10px] font-medium leading-tight text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                        {leadershipRoles.get(member.id) === 'coach' ? 'Coach' : leadershipRoles.get(member.id) === 'captain' ? 'C' : 'TR'}
                      </span>
                    )}
                    {participation && (participation.guest_count ?? 0) > 0 && (
                      <span className="ml-1 text-xs text-brand-600 dark:text-brand-400">
                        +{participation.guest_count} {t('guests')}
                      </span>
                    )}
                  </p>
                  {showRsvpTime && participation?.updated && (
                    <RsvpTimestamp datetime={participation.updated} locale={i18n.language} />
                  )}
                  {participation?.position_1 && (
                    <p className="truncate text-xs text-gray-400">
                      {[participation.position_1, participation.position_2, participation.position_3].filter(Boolean).join(' > ')}
                    </p>
                  )}
                </div>

                {/* Status badge + edit controls */}
                {hasSessionMode && activeSessionTab === null ? (
                  // Session count badge — no editing in overall tab
                  (() => {
                    const counts = memberSessionCounts.get(member.id)
                    if (!counts) return <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">{t('notResponded')}</span>
                    return (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        counts.confirmed === counts.total
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : counts.confirmed > 0
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {te('sessionsConfirmed', { confirmed: counts.confirmed, total: counts.total })}
                      </span>
                    )
                  })()
                ) : editingMemberId === member.id ? (
                  // Inline select dropdown (editing mode)
                  <select
                    autoFocus
                    defaultValue={participations.find(p => p.member === member.id)?.status ?? ''}
                    onChange={(e) => handleStatusChange(member.id, e.target.value)}
                    onBlur={() => setTimeout(() => setEditingMemberId(prev => prev === member.id ? null : prev), 150)}
                    className="shrink-0 rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="">{t('clearStatus')}</option>
                    <option value="confirmed">{t('confirmed')}</option>
                    {allowMaybe && <option value="tentative">{t('tentative')}</option>}
                    <option value="declined">{t('declined')}</option>
                  </select>
                ) : (
                  // Status badge + optional pencil icon
                  <div className="flex shrink-0 items-center gap-1">
                    {status ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[status] ?? ''}`}>
                        {absentMemberIds.has(member.id) ? t('declinedAbsence') : t(status)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {t('notResponded')}
                      </span>
                    )}
                    {canEditRoster && !savingMemberIds.has(member.id) && (
                      <button
                        type="button"
                        onClick={() => setEditingMemberId(member.id)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {savingMemberIds.has(member.id) && (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-500" />
                    )}
                  </div>
                )}
                </div>
                {/* Note on its own row — skip if note is just a duplicate of position preferences */}
                {(() => {
                  const absenceReason = getMemberAbsenceReason(member.id)
                  const note = absenceReason || participation?.note
                  if (!note) return null
                  // Deduplicate: if note matches the positions string, don't show it again
                  if (participation?.position_1) {
                    const posStr = [participation.position_1, participation.position_2, participation.position_3].filter(Boolean).join(' > ')
                    if (note === posStr) return null
                  }
                  return <p className="break-words px-3 pb-2 pl-14 text-xs italic text-gray-400">{note}</p>
                })()}
              </div>
            )
          })}

          {/* Waitlist section */}
          {waitlistedParts.length > 0 && (
            <>
              <div className="border-b bg-orange-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-orange-600 dark:border-gray-700 dark:bg-orange-900/20 dark:text-orange-400">
                {t('waitlisted')} ({waitlistedParts.length})
              </div>
              {waitlistedParts.map((wp, idx) => {
                const member = memberList.find(m => m.id === wp.member)
                if (!member) return null
                return (
                  <div
                    key={wp.id}
                    className="flex min-h-[44px] items-center gap-3 border-b px-3 py-2 last:border-b-0 dark:border-gray-700 sm:min-h-0"
                  >
                    <span className="w-5 shrink-0 text-center text-xs font-medium text-orange-500 dark:text-orange-400">
                      #{idx + 1}
                    </span>
                    {member.photo ? (
                      <img
                        src={getFileUrl('members', member.id, member.photo)}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-medium text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                        {getInitials(member)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-gray-900 dark:text-gray-100">
                        {displayNames.get(String(member.id)) ?? member.first_name}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {editingMemberId === wp.member ? (
                        <select
                          autoFocus
                          defaultValue={wp.status}
                          onChange={(e) => handleStatusChange(wp.member, e.target.value)}
                          onBlur={() => setTimeout(() => setEditingMemberId(prev => prev === wp.member ? null : prev), 150)}
                          className="rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                        >
                          <option value="">{t('clearStatus')}</option>
                          <option value="confirmed">{t('confirmed')}</option>
                          {allowMaybe && <option value="tentative">{t('tentative')}</option>}
                          <option value="declined">{t('declined')}</option>
                        </select>
                      ) : (
                        <>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors.waitlisted}`}>
                            {statusLabels.waitlisted}
                          </span>
                          {canEditRoster && !savingMemberIds.has(wp.member) && (
                            <button
                              type="button"
                              onClick={() => setEditingMemberId(wp.member)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {savingMemberIds.has(wp.member) && (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-500" />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* Staff section — coaches/team_responsible not in roster */}
          {staffMembers.length > 0 && (
            <>
              <div className="border-b bg-gray-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                {t('staff')}
              </div>
              {staffMembers.map((member) => {
                const status = getStaffMemberStatus(member.id)
                return (
                  <div
                    key={member.id}
                    className="flex min-h-[44px] items-center gap-3 border-b px-3 py-2 last:border-b-0 dark:border-gray-700 sm:min-h-0"
                  >
                    {member.photo ? (
                      <img
                        src={getFileUrl('members', member.id, member.photo)}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                        {getInitials(member)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-gray-900 dark:text-gray-100">
                        {displayNames.get(String(member.id)) ?? member.first_name}
                      </p>
                      {showRsvpTime && (() => {
                        const sp = staffParticipations.find(p => p.member === member.id)
                        return sp?.updated ? (
                          <RsvpTimestamp datetime={sp.updated} locale={i18n.language} />
                        ) : null
                      })()}
                    </div>
                    {status ? (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[status] ?? ''}`}>
                        {statusLabels[status] ?? t('notResponded')}
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                        {t('notResponded')}
                      </span>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
      </>)}
    </Modal>
  )
}
