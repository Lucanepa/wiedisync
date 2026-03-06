import { useTranslation } from 'react-i18next'
import TeamChip from '../../components/TeamChip'
import ParticipationSummary from '../../components/ParticipationSummary'
import { useAuth } from '../../hooks/useAuth'
import { useParticipation } from '../../hooks/useParticipation'
import { formatDate, formatWeekday, formatTime } from '../../utils/dateHelpers'
import type { Training, Team, Hall, Member } from '../../types'

type TrainingExpanded = Training & {
  expand?: { team?: Team; hall?: Hall; coach?: Member }
}

interface TrainingCardProps {
  training: TrainingExpanded
  onOpenAttendance: (trainingId: string, teamId: string) => void
  onOpenRoster?: (trainingId: string, teamId: string, date: string) => void
  onEdit?: (training: Training) => void
  onDelete?: (trainingId: string) => void
}

export default function TrainingCard({ training, onOpenAttendance, onOpenRoster, onEdit, onDelete }: TrainingCardProps) {
  const { t } = useTranslation('trainings')
  const { user, memberTeamIds } = useAuth()
  const team = training.expand?.team
  const hall = training.expand?.hall
  const coach = training.expand?.coach

  return (
    <div className={`rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 p-4 ${training.cancelled ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {team && <TeamChip team={team.name} size="sm" />}
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {formatWeekday(training.date)}, {formatDate(training.date)}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {formatTime(training.start_time)} – {formatTime(training.end_time)}
            {hall && <span> · {hall.name}</span>}
            {coach && <span> · {coach.name}</span>}
          </p>
          {training.cancelled && (
            <span className="mt-1 inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {t('cancelled')}{training.cancel_reason ? `: ${training.cancel_reason}` : ''}
            </span>
          )}
          {training.notes && !training.cancelled && (
            <p className="mt-1 text-sm text-gray-400">{training.notes}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {user && !training.cancelled && memberTeamIds.includes(training.team) && (
            <div className="flex items-center gap-1.5">
              <TrainingParticipation training={training} />
              <ParticipationSummary activityType="training" activityId={training.id} compact />
            </div>
          )}
          {!training.cancelled && (
            <button
              onClick={() => onOpenAttendance(training.id, training.team)}
              className="min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:min-h-0 sm:py-1.5 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {t('attendance')}
            </button>
          )}
          {onOpenRoster && !training.cancelled && (
            <button
              onClick={() => onOpenRoster(training.id, training.team, training.date)}
              className="min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:min-h-0 sm:py-1.5 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              title={t('participation')}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(training)}
              className="rounded-lg p-2.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 sm:p-1.5 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              title={t('editTraining')}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(training.id)}
              className="rounded-lg p-2.5 text-gray-400 hover:bg-red-50 hover:text-red-600 sm:p-1.5 dark:hover:bg-red-900/20 dark:hover:text-red-400"
              title={t('deleteTraining')}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function TrainingParticipation({ training }: { training: TrainingExpanded }) {
  const { t } = useTranslation('participation')
  const { effectiveStatus, hasAbsence, setStatus } = useParticipation('training', training.id, training.date)

  if (hasAbsence) {
    return <span className="text-xs text-gray-500 dark:text-gray-400">{t('absent')}</span>
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => setStatus('confirmed')}
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
          effectiveStatus === 'confirmed'
            ? 'bg-green-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-green-900/30 dark:hover:text-green-400'
        }`}
      >
        {t('yes')}
      </button>
      <button
        onClick={() => setStatus('tentative')}
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
          effectiveStatus === 'tentative'
            ? 'bg-yellow-500 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-yellow-100 hover:text-yellow-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-yellow-900/30 dark:hover:text-yellow-400'
        }`}
      >
        {t('maybe')}
      </button>
      <button
        onClick={() => setStatus('declined')}
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
          effectiveStatus === 'declined'
            ? 'bg-red-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-red-900/30 dark:hover:text-red-400'
        }`}
      >
        {t('no')}
      </button>
    </div>
  )
}
