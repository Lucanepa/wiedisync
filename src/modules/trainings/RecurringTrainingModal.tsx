import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../../components/Modal'
import { useAuth } from '../../hooks/useAuth'
import { usePB } from '../../hooks/usePB'
import { formatDate, toISODate } from '../../utils/dateHelpers'
import pb from '../../pb'
import { logActivity } from '../../utils/logActivity'
import type { HallSlot, HallClosure, Team, Hall } from '../../types'

type SlotExpanded = HallSlot & { expand?: { team?: Team; hall?: Hall } }

interface RecurringTrainingModalProps {
  open: boolean
  onClose: () => void
  onGenerated: () => void
  selectedTeamId?: string | null
}

function getSeasonEndDate(): string {
  const now = new Date()
  const year = now.getMonth() < 5 ? now.getFullYear() : now.getFullYear() + 1
  return `${year}-05-31`
}

export default function RecurringTrainingModal({ open, onClose, onGenerated, selectedTeamId }: RecurringTrainingModalProps) {
  const { t } = useTranslation('trainings')
  const { t: tc } = useTranslation('common')

  const { isAdmin, coachTeamIds } = useAuth()
  const { data: allSlots } = usePB<SlotExpanded>('hall_slots', {
    filter: 'slot_type="training"',
    sort: 'day_of_week,start_time',
    expand: 'team,hall',
    perPage: 100,
  })

  // Filter by selected team, or fall back to coach's teams (non-admin)
  const slots = useMemo(() => {
    if (selectedTeamId) return allSlots.filter((s) => s.team === selectedTeamId)
    if (isAdmin) return allSlots
    return allSlots.filter((s) => coachTeamIds.includes(s.team))
  }, [selectedTeamId, isAdmin, allSlots, coachTeamIds])

  const { data: halls } = usePB<Hall>('halls', { sort: 'name', perPage: 50 })
  const { data: closures } = usePB<HallClosure>('hall_closures', { perPage: 500 })

  const [selectedSlot, setSelectedSlot] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [untilSeasonEnd, setUntilSeasonEnd] = useState(false)
  const [hallId, setHallId] = useState('')
  const [notes, setNotes] = useState('')
  const [respondBy, setRespondBy] = useState('')
  const [minParticipants, setMinParticipants] = useState('')
  const [maxParticipants, setMaxParticipants] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState(0)

  const slot = slots.find((s) => s.id === selectedSlot)

  // When slot changes, default the hall to the slot's hall
  const effectiveHallId = hallId || slot?.hall || ''

  const effectiveEndDate = untilSeasonEnd ? getSeasonEndDate() : endDate

  const previewDates = useMemo(() => {
    if (!slot || !startDate || !effectiveEndDate) return []
    const dates: string[] = []
    const start = new Date(startDate)
    const end = new Date(effectiveEndDate)
    // DB: 0=Mon..6=Sun → convert to JS: 0=Sun..6=Sat
    const targetJsDay = (slot.day_of_week + 1) % 7
    const closureHallId = effectiveHallId || slot.hall || ''

    const current = new Date(start)
    // Advance to first matching day
    while (current.getDay() !== targetJsDay && current <= end) {
      current.setDate(current.getDate() + 1)
    }

    while (current <= end) {
      const dateStr = toISODate(current)
      // Skip dates where the hall is closed
      const isClosed = closures.some(
        (c) => c.hall === closureHallId && c.start_date <= dateStr && c.end_date >= dateStr,
      )
      if (!isClosed) dates.push(dateStr)
      current.setDate(current.getDate() + 7)
    }
    return dates
  }, [slot, startDate, effectiveEndDate, effectiveHallId, closures])

  async function handleGenerate() {
    if (!slot || previewDates.length === 0) return
    setLoading(true)
    setError('')
    setGenerated(0)

    try {
      let count = 0
      for (const date of previewDates) {
        const rec = await pb.collection('trainings').create({
          team: slot.team,
          hall_slot: slot.id,
          date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          hall: effectiveHallId,
          cancelled: false,
          notes,
          respond_by: respondBy || null,
          min_participants: minParticipants ? Number(minParticipants) : null,
          max_participants: maxParticipants ? Number(maxParticipants) : null,
        })
        logActivity('create', 'trainings', rec.id, { team: slot.team, date, hall: effectiveHallId })
        count++
      }
      setGenerated(count)
      onGenerated()
    } catch {
      setError(tc('errorSaving'))
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100'
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300'

  return (
    <Modal open={open} onClose={onClose} title={t('recurringTitle')} size="md">
      <div className="space-y-4">
        <div>
          <label className={labelCls}>{t('selectSlot')}</label>
          <select
            value={selectedSlot}
            onChange={(e) => {
              const id = e.target.value
              setSelectedSlot(id)
              setHallId('')
              const picked = slots.find((s) => s.id === id)
              if (picked) {
                if (picked.valid_from) setStartDate(picked.valid_from.slice(0, 10))
                if (picked.indefinite) {
                  setUntilSeasonEnd(true)
                  setEndDate(getSeasonEndDate())
                } else if (picked.valid_until) {
                  setEndDate(picked.valid_until.slice(0, 10))
                  setUntilSeasonEnd(false)
                }
              }
            }}
            className={inputCls}
          >
            <option value="">{tc('select')}</option>
            {slots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.expand?.team?.name ?? '?'} — {tc(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][s.day_of_week])} {s.start_time}–{s.end_time} ({s.expand?.hall?.name ?? '?'})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>{tc('hall')}</label>
          <select
            value={effectiveHallId}
            onChange={(e) => setHallId(e.target.value)}
            className={inputCls}
          >
            <option value="">{tc('select')}</option>
            {halls.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{tc('from')}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{tc('to')}</label>
            <input
              type="date"
              value={untilSeasonEnd ? getSeasonEndDate() : endDate}
              onChange={(e) => { setEndDate(e.target.value); setUntilSeasonEnd(false) }}
              min={startDate}
              disabled={untilSeasonEnd}
              className={inputCls}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={untilSeasonEnd}
            onChange={(e) => {
              setUntilSeasonEnd(e.target.checked)
              if (e.target.checked) setEndDate(getSeasonEndDate())
            }}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          {t('untilSeasonEnd')}
        </label>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t('minParticipants')}</label>
            <input
              type="number"
              value={minParticipants}
              onChange={(e) => setMinParticipants(e.target.value)}
              min={0}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t('maxParticipants')}</label>
            <input
              type="number"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              min={0}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>{t('respondBy')}</label>
          <input
            type="date"
            value={respondBy}
            onChange={(e) => setRespondBy(e.target.value)}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{t('respondByHint')}</p>
        </div>

        <div>
          <label className={labelCls}>{tc('notes')}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputCls}
          />
        </div>

        {previewDates.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('generatePreview')} ({previewDates.length})
            </p>
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-800">
              {previewDates.map((d) => (
                <p key={d} className="py-0.5 text-sm text-gray-600 dark:text-gray-400">{formatDate(d)}</p>
              ))}
            </div>
          </div>
        )}

        {generated > 0 && (
          <p className="text-sm font-medium text-green-600 dark:text-green-400">
            {t('trainingsGenerated', { count: generated })}
          </p>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {tc('close')}
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || previewDates.length === 0}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {loading ? tc('saving') : t('generate')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
