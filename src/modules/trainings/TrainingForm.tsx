import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../../components/Modal'
import { useAuth } from '../../hooks/useAuth'
import { useMutation } from '../../hooks/useMutation'
import { usePB } from '../../hooks/usePB'
import pb from '../../pb'
import type { Training, Team, Hall, HallSlot, SlotClaim } from '../../types'
import type { RecurringEditScope } from './RecurringEditDialog'

// day_of_week in DB: 0=Mon, 1=Tue, ..., 6=Sun
const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Convert JS Date.getDay() (0=Sun) to DB day_of_week (0=Mon) */
function jsToDbDay(jsDay: number): number {
  return (jsDay + 6) % 7
}

interface SlotOption {
  key: string        // 'slot-{id}' or 'claim-{id}'
  label: string
  startTime: string
  endTime: string
  hallId: string
  hallSlotId: string // only for regular slots
  type: 'regular' | 'claimed'
}

interface TrainingFormProps {
  open: boolean
  training?: Training | null
  editScope?: RecurringEditScope
  onSave: () => void
  onCancel: () => void
}

export default function TrainingForm({ open, training, editScope = 'this', onSave, onCancel }: TrainingFormProps) {
  const { t } = useTranslation('trainings')
  const { t: tc } = useTranslation('common')
  const { create, update, isLoading: isMutating } = useMutation<Training>('trainings')
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
  const [isLoading, setIsLoading] = useState(false)

  // Slot mode state
  const [slotMode, setSlotMode] = useState<'auto' | 'manual'>('auto')
  const [teamSlots, setTeamSlots] = useState<HallSlot[]>([])
  const [teamClaims, setTeamClaims] = useState<SlotClaim[]>([])
  const [selectedSlotKey, setSelectedSlotKey] = useState('')

  // Fetch team's hall_slots and active claims when teamId changes
  useEffect(() => {
    if (!teamId) {
      setTeamSlots([])
      setTeamClaims([])
      return
    }
    pb.collection('hall_slots').getFullList<HallSlot>({
      filter: `team="${teamId}" && slot_type="training" && recurring=true`,
      expand: 'hall',
      sort: 'day_of_week,start_time',
    }).then(setTeamSlots).catch(() => setTeamSlots([]))

    const today = new Date().toISOString().split('T')[0]
    pb.collection('slot_claims').getFullList<SlotClaim>({
      filter: `claimed_by_team="${teamId}" && status="active" && date>="${today}"`,
      expand: 'hall',
      sort: 'date,start_time',
    }).then(setTeamClaims).catch(() => setTeamClaims([]))
  }, [teamId])

  // Build matching slot options for the selected date
  const slotOptions = useMemo<SlotOption[]>(() => {
    if (!teamId || !date || slotMode === 'manual') return []
    const dayOfWeek = jsToDbDay(new Date(date).getDay())

    const regularOptions: SlotOption[] = teamSlots
      .filter((s) => {
        if (s.day_of_week !== dayOfWeek) return false
        if (s.valid_from && date < s.valid_from.split(' ')[0]) return false
        if (s.valid_until && date > s.valid_until.split(' ')[0]) return false
        return true
      })
      .map((s) => ({
        key: `slot-${s.id}`,
        label: `${DAY_NAMES[s.day_of_week]} ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}${(s.expand as Record<string, Hall>)?.hall?.name ? `, ${(s.expand as Record<string, Hall>).hall.name}` : ''}`,
        startTime: s.start_time,
        endTime: s.end_time,
        hallId: s.hall,
        hallSlotId: s.id,
        type: 'regular',
      }))

    const claimOptions: SlotOption[] = teamClaims
      .filter((c) => c.date.split(' ')[0] === date)
      .map((c) => ({
        key: `claim-${c.id}`,
        label: `${c.start_time.slice(0, 5)}–${c.end_time.slice(0, 5)}${(c.expand as Record<string, Hall>)?.hall?.name ? `, ${(c.expand as Record<string, Hall>).hall.name}` : ''}`,
        startTime: c.start_time,
        endTime: c.end_time,
        hallId: c.hall,
        hallSlotId: '',
        type: 'claimed',
      }))

    return [...regularOptions, ...claimOptions]
  }, [teamId, date, slotMode, teamSlots, teamClaims])

  // Auto-select slot when options change
  useEffect(() => {
    if (slotMode !== 'auto' || slotOptions.length === 0) {
      if (slotMode === 'auto') setSelectedSlotKey('')
      return
    }
    // If current selection is still valid, keep it
    if (selectedSlotKey && slotOptions.some((o) => o.key === selectedSlotKey)) return
    // Auto-select if exactly one option
    if (slotOptions.length === 1) {
      applySlot(slotOptions[0])
    } else {
      setSelectedSlotKey('')
    }
  }, [slotOptions]) // eslint-disable-line react-hooks/exhaustive-deps

  function applySlot(option: SlotOption) {
    setSelectedSlotKey(option.key)
    setStartTime(option.startTime)
    setEndTime(option.endTime)
    setHallId(option.hallId)
  }

  function switchToManual() {
    setSlotMode('manual')
    setSelectedSlotKey('')
  }

  function switchToAuto() {
    setSlotMode('auto')
    // Will re-trigger auto-select via the effect above
  }

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
      // Edit mode: if training has a hall_slot, start in auto mode with it pre-selected
      if (training.hall_slot) {
        setSlotMode('auto')
        setSelectedSlotKey(`slot-${training.hall_slot}`)
      } else {
        setSlotMode('manual')
        setSelectedSlotKey('')
      }
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
      setSlotMode('auto')
      setSelectedSlotKey('')
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

    // Resolve hall_slot relation: only for regular slots in auto mode
    const activeSlot = slotOptions.find((o) => o.key === selectedSlotKey)
    const hallSlotId = slotMode === 'auto' && activeSlot?.type === 'regular' ? activeSlot.hallSlotId : ''

    const data = {
      team: teamId,
      date,
      start_time: startTime,
      end_time: endTime,
      hall: hallId || undefined,
      hall_slot: hallSlotId,
      notes,
      cancelled,
      cancel_reason: cancelled ? cancelReason : '',
      respond_by: respondBy || null,
      min_participants: minParticipants ? Number(minParticipants) : null,
      max_participants: maxParticipants ? Number(maxParticipants) : null,
    }

    setIsLoading(true)
    try {
      if (training) {
        await update(training.id, data)

        // Bulk update siblings if editing recurring
        if (editScope !== 'this' && training.hall_slot) {
          await bulkUpdateSiblings(training, data)
        }
      } else {
        await create(data)
      }
      onSave()
    } catch {
      setError(tc('errorSaving'))
    } finally {
      setIsLoading(false)
    }
  }

  async function bulkUpdateSiblings(
    source: Training,
    data: Record<string, unknown>,
  ) {
    // Fields to propagate (exclude date-specific fields)
    const bulkData: Record<string, unknown> = {
      start_time: data.start_time,
      end_time: data.end_time,
      hall: data.hall,
      notes: data.notes,
      respond_by: data.respond_by,
      min_participants: data.min_participants,
      max_participants: data.max_participants,
    }

    // Find sibling trainings with same hall_slot, excluding the one we already updated
    let filter = `hall_slot="${source.hall_slot}" && id!="${source.id}" && date>="${new Date().toISOString().split('T')[0]}"`

    if (editScope === 'same_day') {
      // Same day of week: compute from source training date
      const dayOfWeek = new Date(source.date).getDay()
      // PB doesn't have day-of-week filter, so we fetch all and filter client-side
      const allSiblings = await pb.collection('trainings').getFullList<Training>({
        filter,
        sort: 'date',
      })
      const sameDaySiblings = allSiblings.filter(
        (t) => new Date(t.date).getDay() === dayOfWeek,
      )
      for (const sibling of sameDaySiblings) {
        await pb.collection('trainings').update(sibling.id, bulkData)
      }
    } else {
      // All recurring
      const allSiblings = await pb.collection('trainings').getFullList<Training>({
        filter,
        sort: 'date',
      })
      for (const sibling of allSiblings) {
        await pb.collection('trainings').update(sibling.id, bulkData)
      }
    }
  }

  const scopeLabel = editScope === 'all'
    ? t('editAllRecurring')
    : editScope === 'same_day'
      ? t('editSameDay')
      : ''

  const loading = isLoading || isMutating

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={training ? t('editTraining') : t('newTraining')}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {training && editScope !== 'this' && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            {scopeLabel}
          </div>
        )}

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

        {/* Slot mode indicator */}
        {slotMode === 'auto' && teamId && date && (
          <div>
            {slotOptions.length === 0 ? (
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                <span>{t('noSlotForDay')}</span>
                <button type="button" onClick={switchToManual} className="text-brand-500 hover:underline">
                  {t('enterManually')}
                </button>
              </div>
            ) : slotOptions.length === 1 ? (
              <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
                <span>
                  {slotOptions[0].type === 'claimed' ? t('claimedSlot') : t('slotDetected')}: {slotOptions[0].label}
                </span>
                <button type="button" onClick={switchToManual} className="text-green-600 hover:underline dark:text-green-400">
                  {t('enterManually')}
                </button>
              </div>
            ) : (
              <div className="space-y-2 rounded-lg bg-green-50 px-3 py-2 dark:bg-green-900/20">
                <div className="flex items-center justify-between text-sm text-green-800 dark:text-green-300">
                  <span>{t('slotDetected')}</span>
                  <button type="button" onClick={switchToManual} className="text-green-600 hover:underline dark:text-green-400">
                    {t('enterManually')}
                  </button>
                </div>
                {slotOptions.map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="radio"
                      name="slotOption"
                      checked={selectedSlotKey === opt.key}
                      onChange={() => applySlot(opt)}
                      className="text-brand-500"
                    />
                    <span>
                      {opt.type === 'claimed' ? `${t('claimedSlot')}: ` : `${t('regularSlot')}: `}
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {slotMode === 'manual' && teamId && teamSlots.length > 0 && (
          <div className="text-right">
            <button type="button" onClick={switchToAuto} className="text-sm text-brand-500 hover:underline">
              {t('useSlot')}
            </button>
          </div>
        )}

        {/* Time and hall fields — read-only when a slot is active */}
        {(() => {
          const slotActive = slotMode === 'auto' && !!selectedSlotKey
          return (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{tc('from')}</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    readOnly={slotActive}
                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 ${slotActive ? 'opacity-60' : ''}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{tc('to')}</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    readOnly={slotActive}
                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 ${slotActive ? 'opacity-60' : ''}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{tc('hall')}</label>
                <select
                  value={hallId}
                  onChange={(e) => setHallId(e.target.value)}
                  disabled={slotActive}
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 ${slotActive ? 'opacity-60' : ''}`}
                >
                  <option value="">{tc('select')}</option>
                  {halls.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
            </>
          )
        })()}

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
            disabled={loading}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {loading ? tc('saving') : tc('save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
