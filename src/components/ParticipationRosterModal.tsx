import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/components/Modal'
import { useMultiTeamMembers } from '../hooks/useTeamMembers'
import { useTeamParticipations, useAllEventParticipations } from '../hooks/useParticipation'
import { useCollection } from '../lib/query'
import { fetchAllItems } from '../lib/api'
import { getFileUrl } from '../utils/pbFile'
import type { Participation, Absence, Member, Team, EventSession } from '../types'

function asObj<T>(val: T | string | null | undefined): T | null {
  return val != null && typeof val === 'object' ? val as T : null
}
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
}: ParticipationRosterModalProps) {
  const { t, i18n } = useTranslation('participation')
  const { t: te } = useTranslation('events')
  const { t: ta } = useTranslation('absences')
  const { members, isLoading: membersLoading } = useMultiTeamMembers(teamIds)
  const [absences, setAbsences] = useState<Absence[]>([])
  const [staffMembers, setStaffMembers] = useState<Member[]>([])
  const [activeSessionTab, setActiveSessionTab] = useState<string | null>(null) // null = overall

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
      for (const id of team.coach ?? []) if (!map.has(id)) map.set(id, 'coach')
      for (const id of team.captain ?? []) if (!map.has(id)) map.set(id, 'captain')
      for (const id of team.team_responsible ?? []) if (!map.has(id)) map.set(id, 'tr')
    }
    return map
  }, [teams])

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
      const memberParts = allParticipations.filter((p) => p.member === m.id)
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

  // Counts — only players (non-staff)
  const playerParticipations = participations.filter(p => !p.is_staff)

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
    absentMemberIds.has(m.id) && !summaryParticipations.some(p => p.member === m.id)
  ).length
  const declined = summaryParticipations.filter(p => p.status === 'declined').length + absentWithoutParticipation
  const waitlistedParts = summaryParticipations.filter(p => p.status === 'waitlisted')
    .sort((a, b) => (a.waitlisted_at ?? '').localeCompare(b.waitlisted_at ?? ''))
  const waitlisted = waitlistedParts.length
  const notResponded = memberList.length - summaryParticipations.length - absentWithoutParticipation
  const totalGuests = confirmedGuests + tentativeGuests

  // Staff counts
  const staffParticipations = participations.filter(p => p.is_staff)
  const staffConfirmed = staffParticipations.filter(p => p.status === 'confirmed').length

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
          {memberList.map((member) => {
            const status = getMemberStatus(member.id)
            const participation = participations.find(p => p.member === member.id)

            return (
              <div
                key={member.id}
                className="flex min-h-[44px] items-center gap-3 border-b px-3 py-2 last:border-b-0 dark:border-gray-700 sm:min-h-0"
              >
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
                    {member.first_name} {member.last_name}
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
                  {(() => {
                    const absenceReason = getMemberAbsenceReason(member.id)
                    const note = absenceReason || participation?.note
                    return note ? <p className="truncate text-xs italic text-gray-400">{note}</p> : null
                  })()}
                </div>

                {/* Status badge — show session count in overall tab */}
                {hasSessionMode && activeSessionTab === null ? (
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
                ) : status ? (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[status] ?? ''}`}>
                    {absentMemberIds.has(member.id) ? t('declinedAbsence') : t(status)}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                    {t('notResponded')}
                  </span>
                )}
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
                        {member.first_name} {member.last_name}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColors.waitlisted}`}>
                      {statusLabels.waitlisted}
                    </span>
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
                        {member.first_name} {member.last_name}
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
