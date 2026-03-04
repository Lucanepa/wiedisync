import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from './Modal'
import { useTeamMembers } from '../hooks/useTeamMembers'
import { useTeamParticipations } from '../hooks/useParticipation'
import pb from '../pb'
import { getFileUrl } from '../utils/pbFile'
import type { Participation, Absence, Member } from '../types'
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
}: ParticipationRosterModalProps) {
  const { t } = useTranslation('participation')
  const { members } = useTeamMembers(teamId ?? undefined)
  const [absences, setAbsences] = useState<Absence[]>([])

  const memberList: Member[] = members
    .map((mt) => mt.expand?.member)
    .filter((m): m is Member => m !== undefined)
    .sort((a, b) => (a.last_name ?? '').localeCompare(b.last_name ?? ''))

  const memberIds = memberList.map((m) => m.id)

  const { participations, isLoading } = useTeamParticipations(
    activityType,
    activityId ?? '',
    memberIds,
  )

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

  const confirmed = participations.filter(p => p.status === 'confirmed').length
  const tentative = participations.filter(p => p.status === 'tentative').length
  const declined = participations.filter(p => p.status === 'declined').length
  const notResponded = memberList.length - participations.length

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

  const statusColors: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    tentative: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    declined: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    absent: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  }

  const statusLabels: Record<string, string> = {
    confirmed: t('confirmed'),
    tentative: t('tentative'),
    declined: t('declined'),
    absent: t('absent'),
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      {/* Summary header */}
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <span className="text-green-600 dark:text-green-400">{confirmed} {t('confirmed')}</span>
        <span className="text-yellow-600 dark:text-yellow-400">{tentative} {t('tentative')}</span>
        <span className="text-red-600 dark:text-red-400">{declined} {t('declined')}</span>
        <span className="text-gray-500 dark:text-gray-400">{notResponded} {t('notResponded')}</span>
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
      {maxPlayers != null && maxPlayers > 0 && (
        <div className={`mb-4 rounded-lg px-3 py-2 text-sm ${
          confirmed >= maxPlayers
            ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
            : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
        }`}>
          {confirmed >= maxPlayers
            ? t('full')
            : t('spotsLeft', { count: maxPlayers - confirmed })}
          {` (${confirmed}/${maxPlayers})`}
        </div>
      )}

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
                  </p>
                  {participation?.note && (
                    <p className="truncate text-xs text-gray-400">{participation.note}</p>
                  )}
                </div>

                {/* Status badge */}
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
        </div>
      )}
    </Modal>
  )
}
