import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/components/Modal'
import TeamChip from '../../components/TeamChip'
import ParticipationSummary from '../../components/ParticipationSummary'
import ParticipationRosterModal from '../../components/ParticipationRosterModal'
import { useAuth } from '../../hooks/useAuth'
import { useParticipation } from '../../hooks/useParticipation'
import { formatDate, formatWeekday, formatTime } from '../../utils/dateHelpers'
import type { Training, Team, Hall, Member } from '../../types'
import { MapPin, Clock, User, Users, Calendar } from 'lucide-react'

type TrainingExpanded = Training & {
  expand?: { team?: Team; hall?: Hall; coach?: Member }
}

interface TrainingDetailModalProps {
  training: TrainingExpanded | null
  onClose: () => void
}

export default function TrainingDetailModal({ training, onClose }: TrainingDetailModalProps) {
  const { t } = useTranslation('trainings')
  const { user, canParticipateIn, isStaffOnly } = useAuth()
  const [rosterOpen, setRosterOpen] = useState(false)

  const canParticipate = !!user && !!training?.team && canParticipateIn(training.team)
  const staffOnly = !!training?.team && isStaffOnly(training.team)

  if (!training) return null

  const team = training.expand?.team
  const hall = training.expand?.hall
  const coach = training.expand?.coach

  return (
    <>
      <Modal open={!!training} onClose={onClose} title={t('title')} size="sm">
        <div className="space-y-4">
          {/* Team + Date header */}
          <div className="flex items-center gap-2">
            {team && <TeamChip team={team.name} size="sm" />}
            {training.cancelled && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {t('cancelled')}
              </span>
            )}
          </div>

          {/* Details */}
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
              <span>{formatWeekday(training.date)}, {formatDate(training.date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
              <span>{formatTime(training.start_time)} – {formatTime(training.end_time)}</span>
            </div>
            {(hall || training.hall_name) && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
                <span>{hall?.name || training.hall_name}</span>
              </div>
            )}
            {coach && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
                <span>{coach.first_name} {coach.last_name}</span>
              </div>
            )}
          </div>

          {/* Cancellation reason */}
          {training.cancelled && training.cancel_reason && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {training.cancel_reason}
            </p>
          )}

          {/* Notes */}
          {training.notes && !training.cancelled && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{training.notes}</p>
          )}

          {/* Participation section */}
          {!training.cancelled && (
            <div className="space-y-3 border-t border-gray-200 pt-3 dark:border-gray-700">
              {/* Participation buttons */}
              {canParticipate && (
                <TrainingParticipation training={training} staffOnly={staffOnly} />
              )}

              {/* Summary + roster button */}
              <div className="flex items-center justify-between">
                <ParticipationSummary activityType="training" activityId={training.id} />
                <button
                  onClick={() => setRosterOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/20"
                >
                  <Users className="h-4 w-4" />
                  {t('participation')}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {training.team && (
        <ParticipationRosterModal
          open={rosterOpen}
          onClose={() => setRosterOpen(false)}
          activityType="training"
          activityId={training.id}
          activityDate={training.date}
          teamId={training.team}
          title={`${team?.name ?? ''} — ${formatDate(training.date)}`}
          respondBy={training.respond_by}
          activityStartTime={training.start_time}
        />
      )}
    </>
  )
}

function TrainingParticipation({ training, staffOnly }: { training: TrainingExpanded; staffOnly: boolean }) {
  const { t } = useTranslation('participation')
  const { effectiveStatus, hasAbsence, setStatus } = useParticipation(
    'training',
    training.id,
    training.date,
    undefined,
    staffOnly,
  )

  if (hasAbsence) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t('absent')}</p>
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('yourStatus')}:</span>
      <div className="flex items-center gap-1.5">
        {(['confirmed', 'tentative', 'declined'] as const).map((status) => {
          const labels = { confirmed: t('yes'), tentative: t('maybe'), declined: t('no') }
          const colors = {
            confirmed: effectiveStatus === 'confirmed'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-green-900/30 dark:hover:text-green-400',
            tentative: effectiveStatus === 'tentative'
              ? 'bg-yellow-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-yellow-100 hover:text-yellow-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-yellow-900/30 dark:hover:text-yellow-400',
            declined: effectiveStatus === 'declined'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-red-900/30 dark:hover:text-red-400',
          }
          return (
            <button
              key={status}
              onClick={() => setStatus(status)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${colors[status]}`}
            >
              {labels[status]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
