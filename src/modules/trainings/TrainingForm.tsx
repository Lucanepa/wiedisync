import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../../components/Modal'
import { useAuth } from '../../hooks/useAuth'
import { useMutation } from '../../hooks/useMutation'
import { usePB } from '../../hooks/usePB'
import type { Training, Team, Hall } from '../../types'

interface TrainingFormProps {
  open: boolean
  training?: Training | null
  onSave: () => void
  onCancel: () => void
}

export default function TrainingForm({ open, training, onSave, onCancel }: TrainingFormProps) {
  const { t } = useTranslation('trainings')
  const { t: tc } = useTranslation('common')
  const { create, update, isLoading } = useMutation<Training>('trainings')
  const { isAdmin, coachTeamIds } = useAuth()

  const { data: allTeams } = usePB<Team>('teams', { filter: 'active=true', sort: 'name', perPage: 50 })
  const { data: halls } = usePB<Hall>('halls', { sort: 'name', perPage: 50 })

  // Non-admin coaches only see their own teams
  const teams = useMemo(
    () => isAdmin ? allTeams : allTeams.filter((t) => coachTeamIds.includes(t.id)),
    [isAdmin, allTeams, coachTeamIds],
  )

  const [teamId, setTeamId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [hallId, setHallId] = useState('')
  const [notes, setNotes] = useState('')
  const [cancelled, setCancelled] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [respondBy, setRespondBy] = useState('')
  const [minParticipants, setMinParticipants] = useState('')
  const [maxParticipants, setMaxParticipants] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (training) {
      setTeamId(training.team)
      setDate(training.date.split(' ')[0])
      setStartTime(training.start_time)
      setEndTime(training.end_time)
      setHallId(training.hall ?? '')
      setNotes(training.notes ?? '')
      setCancelled(training.cancelled)
      setCancelReason(training.cancel_reason ?? '')
      setRespondBy(training.respond_by?.split(' ')[0] ?? '')
      setMinParticipants(training.min_participants ? String(training.min_participants) : '')
      setMaxParticipants(training.max_participants ? String(training.max_participants) : '')
    } else {
      setTeamId('')
      setDate('')
      setStartTime('')
      setEndTime('')
      setHallId('')
      setNotes('')
      setCancelled(false)
      setCancelReason('')
      setRespondBy('')
      setMinParticipants('')
      setMaxParticipants('')
    }
    setError('')
  }, [training, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!teamId || !date || !startTime || !endTime) {
      setError(tc('required'))
      return
    }

    const data = {
      team: teamId,
      date,
      start_time: startTime,
      end_time: endTime,
      hall: hallId || undefined,
      notes,
      cancelled,
      cancel_reason: cancelled ? cancelReason : '',
      respond_by: respondBy || null,
      min_participants: minParticipants ? Number(minParticipants) : null,
      max_participants: maxParticipants ? Number(maxParticipants) : null,
    }

    try {
      if (training) {
        await update(training.id, data)
      } else {
        await create(data)
      }
      onSave()
    } catch {
      setError(tc('errorSaving'))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={training ? t('editTraining') : t('newTraining')}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{tc('team')}</label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">{tc('select')}</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{tc('date')}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{tc('from')}</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{tc('to')}</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{tc('hall')}</label>
          <select
            value={hallId}
            onChange={(e) => setHallId(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">{tc('select')}</option>
            {halls.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('minParticipants')}</label>
            <input
              type="number"
              value={minParticipants}
              onChange={(e) => setMinParticipants(e.target.value)}
              min={0}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('maxParticipants')}</label>
            <input
              type="number"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              min={0}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{tc('notes')}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('respondBy')}</label>
          <input
            type="date"
            value={respondBy}
            onChange={(e) => setRespondBy(e.target.value)}
            max={date}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{t('respondByHint')}</p>
        </div>

        {training && (
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={cancelled}
                onChange={(e) => setCancelled(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              {t('cancelTraining')}
            </label>
            {cancelled && (
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={2}
                placeholder={t('cancelReason')}
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {tc('cancel')}
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {isLoading ? tc('saving') : tc('save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
