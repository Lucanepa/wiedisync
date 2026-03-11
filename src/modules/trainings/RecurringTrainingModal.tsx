import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../../components/Modal'
import { useAuth } from '../../hooks/useAuth'
import { useAdminMode } from '../../hooks/useAdminMode'
import { usePB } from '../../hooks/usePB'
import { formatDate, formatDateCompact, toISODate } from '../../utils/dateHelpers'
import pb from '../../pb'
import { logActivity } from '../../utils/logActivity'
import type { HallSlot, HallClosure, Team, Hall } from '../../types'
import TeamChip from '../../components/TeamChip'

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

  const { hasAdminAccessToTeam, coachTeamIds } = useAuth()
  const { effectiveIsAdmin } = useAdminMode()
  const { data: allSlots } = usePB<SlotExpanded>('hall_slots', {
    filter: 'slot_type="training"',
    sort: 'day_of_week,start_time',
    expand: 'team,hall',
    perPage: 100,
  })

  // Filter by selected team, or fall back to coach's teams (non-admin)
  // Sort: current/past slots first (by valid_from asc), then future slots (by valid_from asc)
  const slots = useMemo(() => {
    const filtered = selectedTeamId
      ? allSlots.filter((s) => s.team === selectedTeamId)
      : allSlots.filter((s) => (effectiveIsAdmin && hasAdminAccessToTeam(s.team)) || coachTeamIds.includes(s.team))
    const today = new Date().toISOString().slice(0, 10)
    return [...filtered].sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week
      if (a.start_time !== b.start_time) return a.start_time.localeCompare(b.start_time)
      const aFuture = (a.valid_from?.slice(0, 10) || '') > today ? 1 : 0
      const bFuture = (b.valid_from?.slice(0, 10) || '') > today ? 1 : 0
      if (aFuture !== bFuture) return aFuture - bFuture
      return (a.valid_from || '').localeCompare(b.valid_from || '')
    })
  }, [selectedTeamId, allSlots, effectiveIsAdmin, hasAdminAccessToTeam, coachTeamIds])

  const { data: halls } = usePB<Hall>('halls', { sort: 'name', perPage: 50 })
  const { data: closures } = usePB<HallClosure>('hall_closures', { all: true })

  const [selectedSlot, setSelectedSlot] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [untilSeasonEnd, setUntilSeasonEnd] = useState(false)
  const [hallId, setHallId] = useState('')
  const [notes, setNotes] = useState('')
  const [respondByAmount, setRespondByAmount] = useState('')
  const [respondByUnit, setRespondByUnit] = useState<'hours' | 'days' | 'weeks' | 'months'>('days')
  const [minParticipants, setMinParticipants] = useState('')
  const [maxParticipants, setMaxParticipants] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [existingDates, setExistingDates] = useState<Set<string>>(new Set())
  const [done, setDone] = useState(false)

  const slot = slots.find((s) => s.id === selectedSlot)

  // Fetch existing training dates for selected slot's team to prevent duplicates
  useEffect(() => {
    if (!slot) { setExistingDates(new Set()); return }
    pb.collection('trainings').getFullList<{ date: string }>({
      filter: `team="${slot.team}" && hall_slot="${slot.id}"`,
      fields: 'date',
    }).then((trainings) => {
      setExistingDates(new Set(trainings.map((t) => t.date.slice(0, 10))))
    }).catch(() => setExistingDates(new Set()))
  }, [slot?.id, slot?.team]) // eslint-disable-line react-hooks/exhaustive-deps

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
      if (!isClosed && !existingDates.has(dateStr)) dates.push(dateStr)
      current.setDate(current.getDate() + 7)
    }
    return dates
  }, [slot, startDate, effectiveEndDate, effectiveHallId, closures, existingDates])

  function computeRespondBy(trainingDate: string): string {
    if (!respondByAmount) return ''
    const amount = Number(respondByAmount)
    if (!amount || amount <= 0) return ''
    const d = new Date(trainingDate)
    switch (respondByUnit) {
      case 'hours': d.setHours(d.getHours() - amount); break
      case 'days': d.setDate(d.getDate() - amount); break
      case 'weeks': d.setDate(d.getDate() - amount * 7); break
      case 'months': d.setMonth(d.getMonth() - amount); break
    }
    return toISODate(d)
  }

  async function handleGenerate() {
    if (!slot || previewDates.length === 0) return
    setLoading(true)
    setError('')
    setGenerated(0)
    setSkipped(0)

    try {
      // Re-fetch existing dates right before creating to prevent race conditions
      const existing = await pb.collection('trainings').getFullList<{ date: string }>({
        filter: `team="${slot.team}" && hall_slot="${slot.id}"`,
        fields: 'date',
      })
      const existingSet = new Set(existing.map((t) => t.date.slice(0, 10)))

      let count = 0
      let skipCount = 0
      for (const date of previewDates) {
        if (existingSet.has(date)) { skipCount++; continue }
        const rec = await pb.collection('trainings').create({
          team: slot.team,
          hall_slot: slot.id,
          date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          hall: effectiveHallId,
          cancelled: false,
          notes,
          respond_by: computeRespondBy(date) || null,
          min_participants: minParticipants ? Number(minParticipants) : null,
          max_participants: maxParticipants ? Number(maxParticipants) : null,
        })
        logActivity('create', 'trainings', rec.id, { team: slot.team, date, hall: effectiveHallId })
        count++
      }
      setGenerated(count)
      setSkipped(skipCount)
      setDone(true)
      onGenerated()
    } catch {
      setError(tc('errorSaving'))
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300'

  if (done) {
    const teamName = slot?.expand?.team?.name ?? ''
    const hallName = halls.find((h) => h.id === effectiveHallId)?.name ?? ''
    return (
      <Modal open={open} onClose={onClose} title={t('recurringTitle')} size="sm">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('trainingsGenerated', { count: generated })}
          </p>
          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            {teamName && <div className="flex justify-center"><TeamChip team={teamName} size="sm" /></div>}
            {hallName && <p>{hallName}</p>}
            {previewDates.length > 0 && (
              <p>{formatDate(previewDates[0])} — {formatDate(previewDates[previewDates.length - 1])}</p>
            )}
          </div>
          {skipped > 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {t('trainingsSkipped', { count: skipped })}
            </p>
          )}
          <div className="pt-2">
            <button
              onClick={onClose}
              className="rounded-lg bg-brand-500 px-6 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              {tc('close')}
            </button>
          </div>
        </div>
      </Modal>
    )
  }

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
            {slots.map((s) => {
              const today = new Date().toISOString().slice(0, 10)
              const from = s.valid_from?.slice(0, 10) || ''
              const until = s.valid_until?.slice(0, 10) || ''
              const isFuture = from > today
              const hasEnd = !s.indefinite && until
              const dateSuffix = isFuture && hasEnd
                ? ` [${t('slotFrom')} ${formatDateCompact(from)} ${t('slotUntil')} ${formatDateCompact(until)}]`
                : isFuture
                  ? ` [${t('slotFrom')} ${formatDateCompact(from)}]`
                  : hasEnd
                    ? ` [${t('slotUntil')} ${formatDateCompact(until)}]`
                    : ''
              return (
                <option key={s.id} value={s.id}>
                  {s.expand?.team?.name ?? '?'} — {tc(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][s.day_of_week])} {s.start_time}–{s.end_time} ({s.expand?.hall?.name ?? '?'}){dateSuffix}
                </option>
              )
            })}
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
          {untilSeasonEnd ? (
            <div className="flex items-end">
              <label className="flex items-center gap-2 pb-2 text-sm text-gray-700 dark:text-gray-300">
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
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <label className={labelCls}>{tc('to')}</label>
                <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
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
              </div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setUntilSeasonEnd(false) }}
                min={startDate}
                className={inputCls}
              />
            </div>
          )}
        </div>

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
          <div className="mt-1 grid grid-cols-3 gap-2">
            <input
              type="number"
              value={respondByAmount}
              onChange={(e) => setRespondByAmount(e.target.value)}
              min={0}
              placeholder="0"
              className="appearance-none rounded-lg border px-3 py-2 text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
            <select
              value={respondByUnit}
              onChange={(e) => setRespondByUnit(e.target.value as 'hours' | 'days' | 'weeks' | 'months')}
              className="rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="hours">{t('respondByHours')}</option>
              <option value="days">{t('respondByDays')}</option>
              <option value="weeks">{t('respondByWeeks')}</option>
              <option value="months">{t('respondByMonths')}</option>
            </select>
            <span className="flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">{t('respondByBefore')}</span>
          </div>
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
