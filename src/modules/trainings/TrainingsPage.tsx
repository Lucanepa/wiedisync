import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { usePB } from '../../hooks/usePB'
import { useRealtime } from '../../hooks/useRealtime'
import { useMutation } from '../../hooks/useMutation'
import TeamFilter from '../../components/TeamFilter'
import EmptyState from '../../components/EmptyState'
import ConfirmDialog from '../../components/ConfirmDialog'
import ParticipationRosterModal from '../../components/ParticipationRosterModal'
import TrainingCard from './TrainingCard'
import TrainingForm from './TrainingForm'
import RecurringTrainingModal from './RecurringTrainingModal'
import RecurringEditDialog from './RecurringEditDialog'
import type { RecurringEditScope } from './RecurringEditDialog'
import AttendanceSheet from './AttendanceSheet'
import CoachDashboard from './CoachDashboard'
import LoadingSpinner from '../../components/LoadingSpinner'
import type { Training, Team, Hall, Member } from '../../types'

type TrainingExpanded = Training & {
  expand?: { team?: Team; hall?: Hall; coach?: Member }
}

export default function TrainingsPage() {
  const { t } = useTranslation('trainings')
  const { isCoach, isCoachOf } = useAuth()
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'trainings' | 'dashboard'>('trainings')
  const [attendanceTraining, setAttendanceTraining] = useState<string | null>(null)
  const [attendanceTeam, setAttendanceTeam] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTraining, setEditingTraining] = useState<Training | null>(null)
  const [editScope, setEditScope] = useState<RecurringEditScope>('this')
  const [recurringEditDialogOpen, setRecurringEditDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [recurringOpen, setRecurringOpen] = useState(false)
  const [rosterTraining, setRosterTraining] = useState<{ id: string; teamId: string; date: string } | null>(null)

  const { data: trainings, isLoading, refetch } = usePB<TrainingExpanded>('trainings', {
    filter: selectedTeam ? `team="${selectedTeam}"` : '',
    sort: '-date',
    expand: 'team,hall,coach',
    perPage: 50,
  })

  const { remove } = useMutation<Training>('trainings')

  useRealtime('trainings', () => refetch())

  function handleOpenAttendance(trainingId: string, teamId: string) {
    setAttendanceTraining(trainingId)
    setAttendanceTeam(teamId)
  }

  function handleEdit(training: Training) {
    setEditingTraining(training)
    if (training.hall_slot) {
      // Recurring training — ask what scope to edit
      setRecurringEditDialogOpen(true)
    } else {
      // Non-recurring — edit directly
      setEditScope('this')
      setFormOpen(true)
    }
  }

  function handleRecurringEditSelect(scope: RecurringEditScope) {
    setEditScope(scope)
    setRecurringEditDialogOpen(false)
    setFormOpen(true)
  }

  function handleFormSave() {
    setFormOpen(false)
    setEditingTraining(null)
    setEditScope('this')
    refetch()
  }

  async function handleDelete() {
    if (!deletingId) return
    await remove(deletingId)
    setDeletingId(null)
    refetch()
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-gray-100">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('subtitle')}</p>
        </div>
        {isCoach && (
          <div className="flex gap-2">
            <button
              onClick={() => setRecurringOpen(true)}
              className="rounded-lg border border-brand-500 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:border-brand-400 dark:text-brand-400 dark:hover:bg-brand-900/20"
            >
              {t('recurringTitle')}
            </button>
            <button
              onClick={() => {
                setEditingTraining(null)
                setEditScope('this')
                setFormOpen(true)
              }}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              {t('newTraining')}
            </button>
          </div>
        )}
      </div>

      <div className="mt-6">
        <TeamFilter selected={selectedTeam} onChange={setSelectedTeam} />
      </div>

      {/* Tabs (coach view) */}
      {isCoach && selectedTeam && (
        <div className="mt-4">
          <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
            <button
              onClick={() => setActiveTab('trainings')}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'trainings' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {t('tabTrainings')}
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'dashboard' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {t('tabCoachDashboard')}
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mt-6">
        {activeTab === 'dashboard' && selectedTeam ? (
          <CoachDashboard teamId={selectedTeam} />
        ) : isLoading ? (
          <LoadingSpinner />
        ) : trainings.length === 0 ? (
          <EmptyState
            icon={
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M16.05 10.966a5 2.5 0 0 1-8.1 0" />
                <path d="m16.923 14.049 4.48 2.04a1 1 0 0 1 .001 1.831l-8.574 3.9a2 2 0 0 1-1.66 0l-8.574-3.91a1 1 0 0 1 0-1.83l4.484-2.04" />
                <path d="M16.949 14.14a5 2.5 0 1 1-9.9 0L10.063 3.5a2 2 0 0 1 3.874 0z" />
                <path d="M9.194 6.57a5 2.5 0 0 0 5.61 0" />
              </svg>
            }
            title={t('noTrainings')}
            description={t('noTrainingsDescription')}
          />
        ) : (
          <div className="space-y-3">
            {trainings.map((training) => (
              <TrainingCard
                key={training.id}
                training={training}
                onOpenAttendance={handleOpenAttendance}
                onOpenRoster={(id, teamId, date) => setRosterTraining({ id, teamId, date })}
                onEdit={isCoachOf(training.team) ? handleEdit : undefined}
                onDelete={isCoachOf(training.team) ? setDeletingId : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <AttendanceSheet
        trainingId={attendanceTraining}
        teamId={attendanceTeam}
        onClose={() => {
          setAttendanceTraining(null)
          setAttendanceTeam(null)
        }}
      />

      <RecurringEditDialog
        open={recurringEditDialogOpen}
        onClose={() => {
          setRecurringEditDialogOpen(false)
          setEditingTraining(null)
        }}
        onSelect={handleRecurringEditSelect}
      />

      <TrainingForm
        open={formOpen}
        training={editingTraining}
        editScope={editScope}
        onSave={handleFormSave}
        onCancel={() => {
          setFormOpen(false)
          setEditingTraining(null)
          setEditScope('this')
        }}
      />

      <RecurringTrainingModal
        open={recurringOpen}
        onClose={() => setRecurringOpen(false)}
        onGenerated={refetch}
      />

      <ConfirmDialog
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title={t('deleteTraining')}
        message={t('deleteConfirm')}
        confirmLabel={t('deleteTraining')}
        danger
      />

      <ParticipationRosterModal
        open={rosterTraining !== null}
        onClose={() => setRosterTraining(null)}
        activityType="training"
        activityId={rosterTraining?.id ?? ''}
        activityDate={rosterTraining?.date ?? ''}
        teamId={rosterTraining?.teamId ?? null}
        title={t('participation')}
      />
    </div>
  )
}
