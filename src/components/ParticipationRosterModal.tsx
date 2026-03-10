import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from './Modal'
import { useTeamMembers } from '../hooks/useTeamMembers'
import { useTeamParticipations, useAllEventParticipations } from '../hooks/useParticipation'
import pb from '../pb'
import { getFileUrl } from '../utils/pbFile'
import type { Participation, Absence, Member, EventSession } from '../types'
import { formatDate } from '../utils/dateHelpers'

interface ParticipationRosterModalProps {
  open: boolean
  onClose: () => void
  activityType: Participation['activity_type']
  activityId: string | null
  activityDate: string
  teamId: string | null
  title: string
  respondBy?: string
  maxPlayers?: number
  eventSessions?: EventSession[]
  participationMode?: 'whole' | 'per_day' | 'per_session' | ''
}

function formatSessionLabel(session: EventSession): string {
  const dateStr = session.date?.split(' ')[0] ?? ''
  const d = new Date(dateStr + 'T00:00:00')
  const datePart = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  if (session.label) return session.label
  if (session.start_time) return `${datePart} ${session.start_time}${session.end_time ? '–' + session.end_time : ''}`
  return datePart
}

export default function ParticipationRosterModal({
  open,
  onClose,
  activityType,
  activityId,
  activityDate,
  teamId,
  title,
  respondBy,
  maxPlayers,
  eventSessions,
  participationMode,
}: ParticipationRosterModalProps) {
  const { t } = useTranslation('participation')
  const { t: te } = useTranslation('events')
  const { members } = useTeamMembers(teamId ?? undefined)
  const [absences, setAbsences] = useState<Absence[]>([])
  const [staffMembers, setStaffMembers] = useState<Member[]>([])
  const [activeSessionTab, setActiveSessionTab] = useState<string | null>(null) // null = overall

  const hasSessionMode = participationMode && participationMode !== 'whole' && eventSessions && eventSessions.length > 0

  const memberList: Member[] = members
    .map((mt) => mt.expand?.member)
    .filter((m): m is Member => m !== undefined)
    .sort((a, b) => (a.last_name ?? '').localeCompare(b.last_name ?? ''))

  const memberIds = memberList.map((m) => m.id)

  // For regular (non-session) mode, filter by session tab if active
  const { participations: regularParticipations, isLoading: regularLoading } = useTeamParticipations(
    activityType,
    activityId ?? '',
    memberIds,
    hasSessionMode ? (activeSessionTab ?? undefined) : undefined,
  )

  // For session mode overall tab: fetch ALL participations across sessions
  const { participations: allParticipations, isLoading: allLoading } = useAllEventParticipations(
    hasSessionMode && activeSessionTab === null ? (activityId ?? '') : '',
    memberIds,
  )

  const participations = hasSessionMode && activeSessionTab === null ? allParticipations : regularParticipations
  const isLoading = hasSessionMode && activeSessionTab === null ? allLoading : regularLoading

  // Fetch staff participations (coaches/team_responsible who aren't in member_teams)
  useEffect(() => {
    if (!open || !activityId) return
    pb.collection('participations')
      .getFullList<Participation>({
        filter: `activity_type="${activityType}" && activity_id="${activityId}" && is_staff=true`,
        perPage: 50,
      })
      .then(async (staffParts) => {
        // Filter out any that are already in the member list
        const staffOnlyParts = staffParts.filter((p) => !memberIds.includes(p.member))
        if (staffOnlyParts.length === 0) {
          setStaffMembers([])
          return
        }
        const staffMemberIds = [...new Set(staffOnlyParts.map((p) => p.member))]
        const filter = staffMemberIds.map((id) => `id="${id}"`).join(' || ')
        const members = await pb.collection('members').getFullList<Member>({
          filter,
          fields: 'id,first_name,last_name,photo',
        })
        setStaffMembers(members.sort((a, b) => (a.last_name ?? '').localeCompare(b.last_name ?? '')))
      })
      .catch(() => setStaffMembers([]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activityId, activityType, memberIds.join(',')])

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
      const memberFilter = memberIds.map((id) => `member="${id}"`).join(' || ')
      const result = await pb.collection('absences').getFullList<Absence>({
        filter: `(${memberFilter}) && start_date<="${dateStr}" && end_date>="${dateStr}"`,
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
  const confirmedParts = playerParticipations.filter(p => p.status === 'confirmed')
  const confirmed = confirmedParts.length
  const confirmedGuests = confirmedParts.reduce((sum, p) => sum + (p.guest_count ?? 0), 0)
  const tentativeParts = playerParticipations.filter(p => p.status === 'tentative')
  const tentative = tentativeParts.length
  const tentativeGuests = tentativeParts.reduce((sum, p) => sum + (p.guest_count ?? 0), 0)
  const declined = playerParticipations.filter(p => p.status === 'declined').length
  const waitlistedParts = playerParticipations.filter(p => p.status === 'waitlisted')
    .sort((a, b) => (a.waitlisted_at ?? '').localeCompare(b.waitlisted_at ?? ''))
  const waitlisted = waitlistedParts.length
  const notResponded = memberList.length - playerParticipations.length
  const totalGuests = confirmedGuests + tentativeGuests

  // Staff counts
  const staffParticipations = participations.filter(p => p.is_staff)
  const staffConfirmed = staffParticipations.filter(p => p.status === 'confirmed').length

  const deadlinePassed = respondBy ? new Date(respondBy) < new Date() : false

  function getInitials(member: Member) {
    return `${(member.first_name ?? '')[0] ?? ''}${(member.last_name ?? '')[0] ?? ''}`.toUpperCase()
  }

  function getMemberStatus(memberId: string): Participation['status'] | 'absent' | null {
    const absence = absences.find(a => a.member === memberId)
    if (absence) return 'absent'
    const p = participations.find(p => p.member === memberId)
    return p?.status ?? null
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
    absent: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  }

  const statusLabels: Record<string, string> = {
    confirmed: t('confirmed'),
    tentative: t('tentative'),
    declined: t('declined'),
    waitlisted: t('waitlisted'),
    absent: t('absent'),
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
          {t('respondBy')}: {formatDate(respondBy)}
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
      {isLoading ? (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">...</div>
      ) : memberList.length === 0 ? (
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
                    {participation && (participation.guest_count ?? 0) > 0 && (
                      <span className="ml-1 text-xs text-brand-600 dark:text-brand-400">
                        +{participation.guest_count} {t('guests')}
                      </span>
                    )}
                  </p>
                  {participation?.note && (
                    <p className="truncate text-xs text-gray-400">{participation.note}</p>
                  )}
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
    </Modal>
  )
}
