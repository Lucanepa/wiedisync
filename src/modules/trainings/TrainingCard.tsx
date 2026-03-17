import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X, HelpCircle, Hourglass, Award } from 'lucide-react'
import TeamChip from '../../components/TeamChip'
import { useAuth } from '../../hooks/useAuth'
import { useMutation } from '../../hooks/useMutation'
import { formatDate, formatWeekday, formatTime } from '../../utils/dateHelpers'
import type { Training, Team, Hall, Member, Participation } from '../../types'

type TrainingExpanded = Training & {
  expand?: { team?: Team; hall?: Hall; coach?: Member }
}

interface TrainingCardProps {
  training: TrainingExpanded
  /** Pre-fetched participations for this training (from batch query) */
  participations?: Participation[]
  /** Pre-fetched current user's participation (from batch query) */
  myParticipation?: Participation
  onOpenRoster?: (trainingId: string, teamId: string, date: string) => void
  onEdit?: (training: Training) => void
  onDelete?: (trainingId: string) => void
}

export default function TrainingCard({ training, participations, myParticipation, onOpenRoster, onEdit, onDelete }: TrainingCardProps) {
  const { t } = useTranslation('trainings')
  const { user, canParticipateIn } = useAuth()
  const team = training.expand?.team
  const hall = training.expand?.hall
  const coach = training.expand?.coach

  return (
    <div className={`overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-card ${training.cancelled ? 'opacity-60' : ''}`}>
      {/* Top row: team chip + date + counters */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {team && <TeamChip team={team.name} size="sm" />}
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {formatWeekday(training.date)}, {formatDate(training.date)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!training.cancelled && participations && participations.length > 0 && (
            <InlineParticipationSummary participations={participations} />
          )}
          {training.cancelled && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              {t('cancelled')}
            </span>
          )}
        </div>
      </div>

      {/* Details */}
      <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
        {formatTime(training.start_time)} – {formatTime(training.end_time)}
        {(hall || training.hall_name) && <span> · {hall?.name || training.hall_name}</span>}
        {coach && <span> · {coach.name}</span>}
      </p>

      {training.cancelled && training.cancel_reason && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{training.cancel_reason}</p>
      )}
      {training.notes && !training.cancelled && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{training.notes}</p>
      )}

      {/* Bottom row: participation + actions */}
      {!training.cancelled && (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {user && canParticipateIn(training.team) && (
              <TrainingParticipation training={training} existingParticipation={myParticipation} />
            )}
          </div>
          <div className="flex items-center gap-1">
            {onOpenRoster && (
              <button
                onClick={() => onOpenRoster(training.id, training.team, training.date)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
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
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
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
                className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                title={t('deleteTraining')}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Inline participation summary using pre-fetched data (no API call) */
function InlineParticipationSummary({ participations }: { participations: Participation[] }) {
  const { t } = useTranslation('participation')
  const playerData = participations.filter(p => !p.is_staff)
  const confirmedParts = playerData.filter(p => p.status === 'confirmed')
  const confirmed = confirmedParts.length
  const confirmedGuests = confirmedParts.reduce((sum, p) => sum + (p.guest_count ?? 0), 0)
  const tentativeParts = playerData.filter(p => p.status === 'tentative')
  const tentative = tentativeParts.length
  const tentativeGuests = tentativeParts.reduce((sum, p) => sum + (p.guest_count ?? 0), 0)
  const declined = playerData.filter(p => p.status === 'declined').length
  const waitlisted = playerData.filter(p => p.status === 'waitlisted').length
  const staffConfirmed = participations.filter(p => p.is_staff && p.status === 'confirmed').length

  if (participations.length === 0) return null

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      {confirmed > 0 && (
        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
          {confirmed}{confirmedGuests > 0 && <span className="text-[10px] opacity-75">+{confirmedGuests}</span>}
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-600 text-white dark:bg-green-500"><Check className="h-2.5 w-2.5" /></span>
        </span>
      )}
      {tentative > 0 && (
        <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
          {tentative}{tentativeGuests > 0 && <span className="text-[10px] opacity-75">+{tentativeGuests}</span>}
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-white"><HelpCircle className="h-2.5 w-2.5" /></span>
        </span>
      )}
      {declined > 0 && (
        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
          {declined}
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white dark:bg-red-500"><X className="h-2.5 w-2.5" /></span>
        </span>
      )}
      {waitlisted > 0 && (
        <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400">
          {waitlisted}
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-white"><Hourglass className="h-2.5 w-2.5" /></span>
        </span>
      )}
      {staffConfirmed > 0 && (
        <span className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400" title={t('staffPresent')}>
          {staffConfirmed}
          <Award className="h-3.5 w-3.5" />
        </span>
      )}
    </span>
  )
}

/** Participation buttons using pre-fetched data — only writes trigger API calls */
function TrainingParticipation({ training, existingParticipation }: { training: TrainingExpanded; existingParticipation?: Participation }) {
  const { t } = useTranslation('participation')
  const { user, isCoachOf } = useAuth()
  const isStaff = isCoachOf(training.team)
  const { create, update } = useMutation<Participation>('participations')

  const [optimisticStatus, setOptimisticStatus] = useState<Participation['status'] | null>(null)
  const [saveConfirmed, setSaveConfirmed] = useState(false)

  const serverStatus = existingParticipation?.status ?? null
  const displayStatus = optimisticStatus ?? serverStatus

  // Auto-dismiss confirmation after 2s
  useEffect(() => {
    if (!saveConfirmed) return
    const timer = setTimeout(() => setSaveConfirmed(false), 2000)
    return () => clearTimeout(timer)
  }, [saveConfirmed])

  const setStatus = useCallback(async (status: Participation['status']) => {
    if (!user) return
    setOptimisticStatus(status)
    setSaveConfirmed(false)
    try {
      if (existingParticipation) {
        await update(existingParticipation.id, { status })
      } else {
        await create({
          member: user.id,
          activity_type: 'training' as const,
          activity_id: training.id,
          status,
          note: '',
          guest_count: 0,
          is_staff: isStaff,
        })
      }
      setSaveConfirmed(true)
    } catch {
      setOptimisticStatus(null)
    }
  }, [user, existingParticipation, training.id, isStaff, create, update])

  return (
    <div className="relative flex items-center gap-1.5">
      <button
        onClick={() => setStatus('confirmed')}
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
          displayStatus === 'confirmed'
            ? 'bg-green-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-green-900/30 dark:hover:text-green-400'
        }`}
      >
        {t('yes')}
      </button>
      <button
        onClick={() => setStatus('tentative')}
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
          displayStatus === 'tentative'
            ? 'bg-yellow-500 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-yellow-100 hover:text-yellow-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-yellow-900/30 dark:hover:text-yellow-400'
        }`}
      >
        {t('maybe')}
      </button>
      <button
        onClick={() => setStatus('declined')}
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
          displayStatus === 'declined'
            ? 'bg-red-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-red-900/30 dark:hover:text-red-400'
        }`}
      >
        {t('no')}
      </button>

      {/* Save confirmation popover */}
      {saveConfirmed && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1 whitespace-nowrap rounded-md bg-green-600 px-2 py-0.5 text-[11px] font-medium text-white shadow-lg animate-fade-in">
          <Check className="h-3 w-3" />
          {t('saved')}
        </span>
      )}
    </div>
  )
}
