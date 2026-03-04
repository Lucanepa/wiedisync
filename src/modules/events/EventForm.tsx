import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../../components/Modal'
import { useAuth } from '../../hooks/useAuth'
import { useMutation } from '../../hooks/useMutation'
import { usePB } from '../../hooks/usePB'
import type { Event, Team } from '../../types'

interface EventFormProps {
  open: boolean
  event?: Event | null
  onSave: () => void
  onCancel: () => void
}

export default function EventForm({ open, event, onSave, onCancel }: EventFormProps) {
  const { t } = useTranslation('events')
  const { t: tc } = useTranslation('common')
  const { user } = useAuth()
  const { create, update, isLoading } = useMutation<Event>('events')
  const { data: teams } = usePB<Team>('teams', { filter: 'active=true', sort: 'name', perPage: 50 })

  const [title, setTitle] = useState('')
  const [eventType, setEventType] = useState<Event['event_type']>('verein')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [allDay, setAllDay] = useState(true)
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [respondBy, setRespondBy] = useState('')
  const [maxPlayers, setMaxPlayers] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (event) {
      setTitle(event.title)
      setEventType(event.event_type)
      setStartDate(event.start_date?.split(' ')[0] ?? '')
      setEndDate(event.end_date?.split(' ')[0] ?? '')
      setAllDay(event.all_day)
      setLocation(event.location ?? '')
      setDescription(event.description ?? '')
      setSelectedTeams(event.teams ?? [])
      setRespondBy(event.respond_by?.split(' ')[0] ?? '')
      setMaxPlayers(event.max_players ? String(event.max_players) : '')
    } else {
      setTitle('')
      setEventType('verein')
      setStartDate('')
      setEndDate('')
      setAllDay(true)
      setLocation('')
      setDescription('')
      setSelectedTeams([])
      setRespondBy('')
      setMaxPlayers('')
    }
    setError('')
  }, [event, open])

  function toggleTeam(teamId: string) {
    setSelectedTeams((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!title || !startDate) {
      setError(tc('required'))
      return
    }

    const data = {
      title,
      event_type: eventType,
      start_date: startDate,
      end_date: endDate || startDate,
      all_day: allDay,
      location,
      description,
      teams: selectedTeams,
      created_by: user?.id,
      respond_by: respondBy || null,
      max_players: maxPlayers ? Number(maxPlayers) : null,
    }

    try {
      if (event) {
        await update(event.id, data)
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
      title={event ? t('editEvent') : t('newEvent')}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('eventTitle')}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('eventType')}</label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as Event['event_type'])}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="verein">{t('club')}</option>
            <option value="social">{t('social')}</option>
            <option value="meeting">{t('meeting')}</option>
            <option value="tournament">{t('tournament')}</option>
            <option value="other">{t('other')}</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('startDate')}</label>
            <input
              type={allDay ? 'date' : 'datetime-local'}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                if (!endDate || endDate < e.target.value) setEndDate(e.target.value)
              }}
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('endDate')}</label>
            <input
              type={allDay ? 'date' : 'datetime-local'}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          {t('allDay')}
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('location')}</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('description')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('respondBy')}</label>
          <input
            type="date"
            value={respondBy}
            onChange={(e) => setRespondBy(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{t('respondByHint')}</p>
        </div>

        {eventType === 'tournament' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('maxPlayers')}</label>
            <input
              type="number"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value)}
              min={0}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('teamsInvolved')}</label>
          <div className="mt-2 flex flex-wrap gap-3">
            {teams.map((team) => (
              <label key={team.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={selectedTeams.includes(team.id)}
                  onChange={() => toggleTeam(team.id)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                {team.name}
              </label>
            ))}
          </div>
        </div>

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
