import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../../components/Modal'
import { useAuth } from '../../hooks/useAuth'
import { useMutation } from '../../hooks/useMutation'
import { usePB } from '../../hooks/usePB'
import pb from '../../pb'
import type { Event, EventSession, Team } from '../../types'

interface SessionDraft {
  id?: string // existing PB record id (for edit mode)
  date: string
  start_time: string
  end_time: string
  label: string
  sort_order: number
}

interface EventFormProps {
  open: boolean
  event?: Event | null
  onSave: () => void
  onCancel: () => void
}

/** Generate dates between start and end (inclusive) as YYYY-MM-DD strings */
function getDateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  while (s <= e) {
    dates.push(s.toISOString().slice(0, 10))
    s.setDate(s.getDate() + 1)
  }
  return dates
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

const inputClass = 'mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100'

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
  const [participationMode, setParticipationMode] = useState<'whole' | 'per_day' | 'per_session'>('whole')
  const [sessions, setSessions] = useState<SessionDraft[]>([])
  const [error, setError] = useState('')

  // Fetch existing sessions when editing
  const { data: existingSessions } = usePB<EventSession>('event_sessions', {
    filter: event ? `event="${event.id}"` : '',
    sort: 'sort_order,date,start_time',
    perPage: 100,
    enabled: !!event,
  })

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
      setParticipationMode((event.participation_mode as 'whole' | 'per_day' | 'per_session') || 'whole')
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
      setParticipationMode('whole')
      setSessions([])
    }
    setError('')
  }, [event, open])

  // Load existing sessions into drafts
  useEffect(() => {
    if (event && existingSessions.length > 0) {
      setSessions(existingSessions.map((s) => ({
        id: s.id,
        date: s.date?.split(' ')[0] ?? '',
        start_time: s.start_time ?? '',
        end_time: s.end_time ?? '',
        label: s.label ?? '',
        sort_order: s.sort_order ?? 0,
      })))
    }
  }, [event, existingSessions])

  // Is this a multi-day event?
  const isMultiDay = useMemo(() => {
    if (!startDate || !endDate) return false
    return endDate > startDate
  }, [startDate, endDate])

  // Auto-generate per-day sessions when switching to per_day mode
  function generatePerDaySessions() {
    if (!startDate || !endDate) return
    const dates = getDateRange(startDate, endDate)
    setSessions(dates.map((d, i) => ({
      date: d,
      start_time: '',
      end_time: '',
      label: formatDateShort(d),
      sort_order: i,
    })))
  }

  // Handle participation mode change
  function handleModeChange(mode: 'whole' | 'per_day' | 'per_session') {
    setParticipationMode(mode)
    if (mode === 'per_day') {
      generatePerDaySessions()
    } else if (mode === 'per_session') {
      // Start with one session per day, user can add time blocks
      if (!startDate || !endDate) return
      const dates = getDateRange(startDate, endDate)
      setSessions(dates.map((d, i) => ({
        date: d,
        start_time: '09:00',
        end_time: '17:00',
        label: '',
        sort_order: i,
      })))
    } else {
      setSessions([])
    }
  }

  function addSessionForDate(date: string) {
    const maxOrder = sessions.reduce((m, s) => Math.max(m, s.sort_order), 0)
    setSessions((prev) => [...prev, {
      date,
      start_time: '09:00',
      end_time: '12:00',
      label: '',
      sort_order: maxOrder + 1,
    }])
  }

  function removeSession(index: number) {
    setSessions((prev) => prev.filter((_, i) => i !== index))
  }

  function updateSession(index: number, field: keyof SessionDraft, value: string | number) {
    setSessions((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

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

    const effectiveMode = isMultiDay ? participationMode : 'whole'

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
      participation_mode: effectiveMode,
    }

    try {
      let eventId: string
      if (event) {
        await update(event.id, data)
        eventId = event.id
      } else {
        const rec = await create(data)
        eventId = rec.id
      }

      // Sync sessions
      if (effectiveMode !== 'whole') {
        await syncSessions(eventId, sessions, existingSessions)
      } else if (event) {
        // Switching from per_day/per_session back to whole — delete all sessions
        for (const s of existingSessions) {
          await pb.collection('event_sessions').delete(s.id)
        }
      }

      onSave()
    } catch {
      setError(tc('errorSaving'))
    }
  }

  // Group sessions by date for per_session display
  const sessionsByDate = useMemo(() => {
    if (!isMultiDay || participationMode === 'whole') return new Map<string, SessionDraft[]>()
    const map = new Map<string, SessionDraft[]>()
    const dates = getDateRange(startDate, endDate)
    for (const d of dates) {
      map.set(d, [])
    }
    for (const s of sessions) {
      const arr = map.get(s.date)
      if (arr) arr.push(s)
      else map.set(s.date, [s])
    }
    return map
  }, [sessions, startDate, endDate, isMultiDay, participationMode])

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
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('eventType')}</label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as Event['event_type'])}
            className={inputClass}
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
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('endDate')}</label>
            <input
              type={allDay ? 'date' : 'datetime-local'}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className={inputClass}
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
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('description')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('respondBy')}</label>
          <input
            type="date"
            value={respondBy}
            onChange={(e) => setRespondBy(e.target.value)}
            className={inputClass}
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
              className={inputClass}
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

        {/* Participation mode selector — only for multi-day events */}
        {isMultiDay && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('participationMode')}</label>
            <div className="mt-2 flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-600 dark:bg-gray-800">
              {(['whole', 'per_day', 'per_session'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleModeChange(mode)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    participationMode === mode
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  {t(mode === 'whole' ? 'modeWhole' : mode === 'per_day' ? 'modePerDay' : 'modePerSession')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Session list for per_day mode */}
        {isMultiDay && participationMode === 'per_day' && sessions.length > 0 && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">
              {t('sessions')} ({sessions.length})
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {sessions.map((s, i) => (
                <div key={`${s.date}-${i}`} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-[100px] text-sm font-medium text-gray-700 dark:text-gray-300">
                    {formatDateShort(s.date)}
                  </span>
                  <input
                    type="text"
                    value={s.label}
                    onChange={(e) => updateSession(i, 'label', e.target.value)}
                    placeholder={t('sessionLabel')}
                    className="flex-1 rounded border border-gray-200 bg-transparent px-2 py-1 text-sm dark:border-gray-600 dark:text-gray-100"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Session builder for per_session mode */}
        {isMultiDay && participationMode === 'per_session' && (
          <div className="space-y-3">
            {Array.from(sessionsByDate.entries()).map(([date, dateSessions]) => (
              <div key={date} className="rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {formatDateShort(date)}
                  </span>
                  <button
                    type="button"
                    onClick={() => addSessionForDate(date)}
                    className="rounded px-2 py-0.5 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/30"
                  >
                    + {t('addTimeBlock')}
                  </button>
                </div>
                {dateSessions.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-400">{t('addTimeBlock')}</div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {dateSessions.map((s) => {
                      const idx = sessions.indexOf(s)
                      return (
                        <div key={idx} className="flex items-center gap-2 px-3 py-2">
                          <input
                            type="time"
                            value={s.start_time}
                            onChange={(e) => updateSession(idx, 'start_time', e.target.value)}
                            className="w-24 rounded border border-gray-200 bg-transparent px-2 py-1 text-sm dark:border-gray-600 dark:text-gray-100"
                          />
                          <span className="text-gray-400">–</span>
                          <input
                            type="time"
                            value={s.end_time}
                            onChange={(e) => updateSession(idx, 'end_time', e.target.value)}
                            className="w-24 rounded border border-gray-200 bg-transparent px-2 py-1 text-sm dark:border-gray-600 dark:text-gray-100"
                          />
                          <input
                            type="text"
                            value={s.label}
                            onChange={(e) => updateSession(idx, 'label', e.target.value)}
                            placeholder={t('sessionLabel')}
                            className="flex-1 rounded border border-gray-200 bg-transparent px-2 py-1 text-sm dark:border-gray-600 dark:text-gray-100"
                          />
                          <button
                            type="button"
                            onClick={() => removeSession(idx)}
                            className="text-red-400 hover:text-red-600"
                            title={t('removeSession')}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
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

/** Sync session drafts with PB: create new, update changed, delete removed */
async function syncSessions(
  eventId: string,
  drafts: SessionDraft[],
  existing: EventSession[],
) {
  const existingIds = new Set(existing.map((s) => s.id))
  const draftIds = new Set(drafts.filter((d) => d.id).map((d) => d.id!))

  // Delete removed
  for (const s of existing) {
    if (!draftIds.has(s.id)) {
      await pb.collection('event_sessions').delete(s.id)
    }
  }

  // Create or update
  for (const d of drafts) {
    const payload = {
      event: eventId,
      date: d.date,
      start_time: d.start_time,
      end_time: d.end_time,
      label: d.label,
      sort_order: d.sort_order,
    }
    if (d.id && existingIds.has(d.id)) {
      await pb.collection('event_sessions').update(d.id, payload)
    } else {
      await pb.collection('event_sessions').create(payload)
    }
  }
}
