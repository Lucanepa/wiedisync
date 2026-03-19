import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/components/Modal'
import TeamChip from '../../components/TeamChip'
import ParticipationSummary from '../../components/ParticipationSummary'
import ParticipationRosterModal from '../../components/ParticipationRosterModal'
import { useAuth } from '../../hooks/useAuth'
import { useParticipation } from '../../hooks/useParticipation'
import { formatDate, formatWeekday, formatTime } from '../../utils/dateHelpers'
import type { Training, Team, Hall, Member } from '../../types'
import { MapPin, Clock, MessageSquare, User, Users, Calendar, Check, UserPlus } from 'lucide-react'

type TrainingExpanded = Training & {
  expand?: { team?: Team; hall?: Hall; coach?: Member }
}

interface TrainingDetailModalProps {
  training: TrainingExpanded | null
  onClose: () => void
}

export default function TrainingDetailModal({ training, onClose }: TrainingDetailModalProps) {
  const { t } = useTranslation('trainings')
  const { user, canParticipateIn, isCoachOf } = useAuth()
  const [rosterOpen, setRosterOpen] = useState(false)

  const canParticipate = !!user && !!training?.team && canParticipateIn(training.team)
  const isStaff = !!training?.team && isCoachOf(training.team)

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
                <TrainingParticipation training={training} isStaff={isStaff} />
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

function TrainingParticipation({ training, isStaff }: { training: TrainingExpanded; isStaff: boolean }) {
  const { t } = useTranslation('participation')
  const { participation, effectiveStatus, hasAbsence, note: savedNote, setStatus, saveConfirmed, dismissConfirmed } = useParticipation(
    'training',
    training.id,
    training.date,
    undefined,
    isStaff,
  )
  const [noteText, setNoteText] = useState(savedNote)
  const [noteSaved, setNoteSaved] = useState(false)
  const noteInitRef = useRef(savedNote)
  const [guestCount, setGuestCount] = useState(0)

  // Sync guest count from existing participation
  useEffect(() => {
    setGuestCount(participation?.guest_count ?? 0)
  }, [participation?.guest_count])
  // Sync note text when server data loads/changes
  if (savedNote !== noteInitRef.current) {
    noteInitRef.current = savedNote
    setNoteText(savedNote)
  }

  // Auto-dismiss status confirmation after 2s
  useEffect(() => {
    if (!saveConfirmed) return
    const timer = setTimeout(dismissConfirmed, 2000)
    return () => clearTimeout(timer)
  }, [saveConfirmed, dismissConfirmed])

  // Auto-dismiss note confirmation after 2s
  useEffect(() => {
    if (!noteSaved) return
    const timer = setTimeout(() => setNoteSaved(false), 2000)
    return () => clearTimeout(timer)
  }, [noteSaved])

  const saveNote = () => {
    if (noteText !== savedNote && effectiveStatus) {
      setStatus(effectiveStatus as 'confirmed' | 'tentative' | 'declined', noteText, guestCount)
      setNoteSaved(true)
    }
  }

  async function handleGuestChange(delta: number) {
    const newCount = Math.max(0, guestCount + delta)
    setGuestCount(newCount)
    if (effectiveStatus) {
      await setStatus(effectiveStatus as 'confirmed' | 'tentative' | 'declined', noteText, newCount)
    }
  }

  if (hasAbsence) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t('absent')}</p>
  }

  return (
    <div className="space-y-2">
      <div className="relative flex items-center gap-2">
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
                onClick={() => setStatus(status, noteText, guestCount)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${colors[status]}`}
              >
                {labels[status]}
              </button>
            )
          })}
        </div>
        {/* Save confirmation popover */}
        {saveConfirmed && (
          <span className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1 whitespace-nowrap rounded-md bg-green-600 px-2 py-0.5 text-[11px] font-medium text-white shadow-lg animate-fade-in">
            <Check className="h-3 w-3" />
            {t('saved')}
          </span>
        )}
      </div>
      {/* Participation note */}
      {effectiveStatus && (
        <div className="relative flex items-center gap-2">
          <MessageSquare className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveNote()
            }}
            placeholder={t('notePlaceholder')}
            className="min-w-0 flex-1 rounded-md border border-gray-200 bg-transparent px-2.5 py-1 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-600 dark:text-gray-300 dark:placeholder:text-gray-500 dark:focus:border-brand-500"
          />
          <button
            onClick={saveNote}
            disabled={noteText === savedNote}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-green-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-green-400"
          >
            <Check className="h-4 w-4" />
          </button>
          {/* Note saved confirmation */}
          {noteSaved && (
            <span className="absolute -top-7 right-0 flex items-center gap-1 whitespace-nowrap rounded-md bg-green-600 px-2 py-0.5 text-[11px] font-medium text-white shadow-lg animate-fade-in">
              <Check className="h-3 w-3" />
              {t('noteSaved')}
            </span>
          )}
        </div>
      )}
      {/* Guest counter — coaches/TR only */}
      {effectiveStatus && isStaff && (
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="text-sm text-gray-500 dark:text-gray-400">{t('guests')}</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleGuestChange(-1)}
              disabled={guestCount <= 0}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-30 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              −
            </button>
            <span className="min-w-[1.5rem] text-center text-sm font-medium text-gray-900 dark:text-gray-100">
              {guestCount}
            </span>
            <button
              onClick={() => handleGuestChange(1)}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
