import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../../../components/Modal'
import Button from '../../../components/ui/Button'
import { Input, Textarea, Select } from '../../../components/ui/Input'
import pb from '../../../pb'
import { logActivity } from '../../../utils/logActivity'
import { useConflictChecker } from '../hooks/useConflictChecker'
import { minutesToTime, timeToMinutes } from '../../../utils/dateHelpers'
import type { Hall, HallSlot, Team } from '../../../types'

interface SlotEditorProps {
  slot: HallSlot | null
  prefill: { day: number; time: string; hall: string } | null
  halls: Hall[]
  teams: Team[]
  allSlots: HallSlot[]
  isAdmin?: boolean
  coachTeamIds?: string[]
  adminTeamIds?: string[]
  onClose: () => void
  onSaved: () => void
}

export default function SlotEditor({
  slot,
  prefill,
  halls,
  teams,
  allSlots,
  isAdmin = true,
  coachTeamIds = [],
  adminTeamIds = [],
  onClose,
  onSaved,
}: SlotEditorProps) {
  const { t } = useTranslation('hallenplan')

  const DAY_OPTIONS = [
    { value: 0, label: t('dayMonday') },
    { value: 1, label: t('dayTuesday') },
    { value: 2, label: t('dayWednesday') },
    { value: 3, label: t('dayThursday') },
    { value: 4, label: t('dayFriday') },
    { value: 5, label: t('daySaturday') },
    { value: 6, label: t('daySunday') },
  ]

  const TYPE_OPTIONS = [
    { value: 'training', label: t('typeTraining') },
    { value: 'game', label: t('typeGame') },
    { value: 'event', label: t('typeEvent') },
    { value: 'other', label: t('typeOther') },
  ]

  const defaultEnd = prefill?.time
    ? minutesToTime(timeToMinutes(prefill.time) + 90)
    : '19:30'

  const todayStr = new Date().toISOString().slice(0, 10)

  // Filter teams for coaches (own teams only) vs scoped admins
  const visibleTeams = isAdmin
    ? teams.filter((tm) => adminTeamIds.length === 0 || adminTeamIds.includes(tm.id))
    : teams.filter((tm) => coachTeamIds.includes(tm.id))
  const defaultTeam = slot?.team ?? (!isAdmin && coachTeamIds.length === 1 ? coachTeamIds[0] : '')
  const canDelete = isAdmin
    ? (slot?.team ? adminTeamIds.length === 0 || adminTeamIds.includes(slot.team) : true)
    : (slot?.team ? coachTeamIds.includes(slot.team) : false)

  // Build a synthetic "KWI A+B" option
  const kwiA = halls.find((h) => h.name === 'KWI A')
  const kwiB = halls.find((h) => h.name === 'KWI B')
  const COMBO_VALUE = kwiA && kwiB ? `${kwiA.id}+${kwiB.id}` : ''

  const [form, setForm] = useState({
    hall: slot?.hall ?? prefill?.hall ?? (halls[0]?.id ?? ''),
    team: defaultTeam,
    day_of_week: slot?.day_of_week ?? prefill?.day ?? 0,
    start_time: slot?.start_time ?? prefill?.time ?? '18:00',
    end_time: slot?.end_time ?? defaultEnd,
    slot_type: slot?.slot_type ?? ('training' as const),
    recurring: slot?.recurring ?? true,
    valid_from: (slot?.valid_from?.slice(0, 10)) || todayStr,
    valid_until: (slot?.valid_until?.slice(0, 10)) || '',
    label: slot?.label ?? '',
    notes: slot?.notes ?? '',
  })

  const [indefinitely, setIndefinitely] = useState(slot ? !!slot.indefinite : true)

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const conflicts = useConflictChecker(form, allSlots, slot?.id)

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const isCombo = COMBO_VALUE && form.hall === COMBO_VALUE

  async function handleSave() {
    if (!form.hall) {
      setError(t('hallRequired'))
      return
    }
    if (timeToMinutes(form.start_time) >= timeToMinutes(form.end_time)) {
      setError(t('common:endAfterStart'))
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const payload = {
        ...form,
        indefinite: indefinitely,
        valid_until: indefinitely ? '' : form.valid_until,
      }
      if (isCombo && kwiA && kwiB) {
        // Create/update a slot for each hall in the combo
        const hallIds = [kwiA.id, kwiB.id]
        if (slot) {
          await pb.collection('hall_slots').update(slot.id, { ...payload, hall: hallIds[0] })
          logActivity('update', 'hall_slots', slot.id, payload)
        } else {
          for (const hid of hallIds) {
            const rec = await pb.collection('hall_slots').create({ ...payload, hall: hid })
            logActivity('create', 'hall_slots', rec.id, { ...payload, hall: hid })
          }
        }
      } else if (slot) {
        await pb.collection('hall_slots').update(slot.id, payload)
        logActivity('update', 'hall_slots', slot.id, payload)
      } else {
        const rec = await pb.collection('hall_slots').create(payload)
        logActivity('create', 'hall_slots', rec.id, payload)
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common:errorSaving'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!slot || !window.confirm(t('deleteSlotConfirm'))) return
    setIsSaving(true)
    try {
      await pb.collection('hall_slots').delete(slot.id)
      logActivity('delete', 'hall_slots', slot.id)
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common:errorSaving'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={slot ? t('editSlotTitle') : t('newSlotTitle')}
      size="lg"
    >
      <div className="space-y-4">
        {/* Row 1: Hall + Team */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label={t('hall')}
            value={form.hall}
            onChange={(e) => update('hall', e.target.value)}
          >
            <option value="">{t('selectPlaceholder')}</option>
            {halls.flatMap((h) => {
              const items = [<option key={h.id} value={h.id}>{h.name}</option>]
              if (COMBO_VALUE && h.name === 'KWI A') {
                items.push(<option key="kwi-ab" value={COMBO_VALUE}>KWI A+B</option>)
              }
              return items
            })}
          </Select>
          <Select
            label={t('team')}
            value={form.team}
            onChange={(e) => update('team', e.target.value)}
          >
            <option value="">{t('selectPlaceholder')}</option>
            {visibleTeams.map((tm) => (
              <option key={tm.id} value={tm.id}>{tm.name}</option>
            ))}
          </Select>
        </div>

        {/* Row 2: Day + Type */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label={t('dayOfWeek')}
            value={form.day_of_week}
            onChange={(e) => update('day_of_week', Number(e.target.value))}
          >
            {DAY_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </Select>
          <Select
            label={t('slotType')}
            value={form.slot_type}
            onChange={(e) => update('slot_type', e.target.value as typeof form.slot_type)}
          >
            {TYPE_OPTIONS.map((tp) => (
              <option key={tp.value} value={tp.value}>{tp.label}</option>
            ))}
          </Select>
        </div>

        {/* Row 3: Times */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            type="time"
            label={t('startTime')}
            value={form.start_time}
            onChange={(e) => update('start_time', e.target.value)}
          />
          <Input
            type="time"
            label={t('endTime')}
            value={form.end_time}
            onChange={(e) => update('end_time', e.target.value)}
          />
        </div>

        {/* Row 4: Recurring */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.recurring}
            onChange={(e) => update('recurring', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">{t('recurring')}</span>
        </label>

        {/* Row 5: Validity dates (only if recurring) */}
        {form.recurring && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('validFrom')}</label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => update('valid_from', e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => update('valid_from', todayStr)}
                  className="shrink-0"
                >
                  {t('today')}
                </Button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('validTo')}</label>
              <div className="flex gap-2">
                {!indefinitely && (
                  <Input
                    type="date"
                    value={form.valid_until}
                    onChange={(e) => update('valid_until', e.target.value)}
                  />
                )}
                <label className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-2 text-xs font-medium ${indefinitely ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'}`}>
                  <input
                    type="checkbox"
                    checked={indefinitely}
                    onChange={(e) => {
                      setIndefinitely(e.target.checked)
                      if (e.target.checked) {
                        update('valid_until', '')
                      } else {
                        update('valid_until', '')
                      }
                    }}
                    className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
                  />
                  {t('indefinitely')}
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Row 6: Label */}
        <Input
          type="text"
          label={t('label')}
          value={form.label}
          onChange={(e) => update('label', e.target.value)}
          placeholder="e.g. Training H3, Home game vs. TVA"
        />

        {/* Row 7: Notes */}
        <Textarea
          label={t('notes')}
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          rows={3}
        />

        {/* Conflict warning */}
        {conflicts.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="font-medium text-amber-800">{t('common:overlapDetected')}</p>
            <ul className="mt-1 list-inside list-disc text-sm text-amber-700">
              {conflicts.map((c) => (
                <li key={c.id}>
                  {DAY_OPTIONS[c.day_of_week]?.label} {c.start_time}–{c.end_time}
                  {c.label ? ` (${c.label})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between border-t pt-4">
          <div>
            {slot && canDelete && (
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={isSaving}
                className="bg-transparent text-red-600 hover:bg-red-50 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-900/20"
              >
                {t('common:delete')}
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose}>
              {t('common:cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={isSaving}
              loading={isSaving}
            >
              {isSaving ? t('common:saving') : t('common:save')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
