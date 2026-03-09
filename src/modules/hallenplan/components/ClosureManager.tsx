import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../../../components/Modal'
import pb from '../../../pb'
import { logActivity } from '../../../utils/logActivity'
import type { Hall, HallClosure } from '../../../types'

interface ClosureManagerProps {
  halls: Hall[]
  closures: HallClosure[]
  onClose: () => void
  onChanged: () => void
}

interface ClosureGroup {
  key: string
  reason: string
  start_date: string
  end_date: string
  source: HallClosure['source']
  hallNames: string[]
  records: HallClosure[]
}

const emptyForm: {
  hall: string
  start_date: string
  end_date: string
  reason: string
  source: HallClosure['source']
} = {
  hall: '',
  start_date: '',
  end_date: '',
  reason: '',
  source: 'admin',
}

const SOURCE_COLORS: Record<string, string> = {
  schulferien: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  gcal: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  hauswart: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  admin: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  auto: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
}

export default function ClosureManager({ halls, closures, onClose, onChanged }: ClosureManagerProps) {
  const { t } = useTranslation('hallenplan')

  const SOURCE_OPTIONS = [
    { value: 'hauswart', label: t('sourceCaretaker') },
    { value: 'admin', label: t('sourceAdmin') },
    { value: 'auto', label: t('sourceAutomatic') },
    { value: 'gcal', label: t('sourceGcal') },
    { value: 'schulferien', label: t('sourceSchulferien') },
  ]

  const sourceLabel = (s: string) => SOURCE_OPTIONS.find((o) => o.value === s)?.label ?? s

  const [form, setForm] = useState(emptyForm)
  const [editingGroup, setEditingGroup] = useState<ClosureGroup | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function getHallName(hallId: string): string {
    return halls.find((h) => h.id === hallId)?.name ?? hallId
  }

  // Group closures by reason + date range + source
  const groups = useMemo<ClosureGroup[]>(() => {
    const map = new Map<string, ClosureGroup>()
    for (const c of closures) {
      const startStr = c.start_date.split('T')[0].split(' ')[0]
      const endStr = c.end_date.split('T')[0].split(' ')[0]
      const key = `${c.reason}|${startStr}|${endStr}|${c.source}`
      const existing = map.get(key)
      if (existing) {
        existing.hallNames.push(getHallName(c.hall))
        existing.records.push(c)
      } else {
        map.set(key, {
          key,
          reason: c.reason,
          start_date: startStr,
          end_date: endStr,
          source: c.source,
          hallNames: [getHallName(c.hall)],
          records: [c],
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.start_date.localeCompare(b.start_date))
  }, [closures, halls])

  function formatDateDisplay(dateStr: string): string {
    if (!dateStr) return ''
    const parts = dateStr.split('-')
    if (parts.length !== 3) return dateStr
    return `${parts[2]}.${parts[1]}.${parts[0]}`
  }

  function startEdit(group: ClosureGroup) {
    setEditingGroup(group)
    setForm({
      hall: group.records[0].hall,
      start_date: group.start_date,
      end_date: group.end_date,
      reason: group.reason,
      source: group.source,
    })
  }

  function cancelEdit() {
    setEditingGroup(null)
    setForm(emptyForm)
    setError(null)
  }

  async function handleSave() {
    if (!form.hall || !form.start_date || !form.end_date || !form.reason) {
      setError(t('common:required'))
      return
    }
    if (form.start_date > form.end_date) {
      setError(t('common:endAfterStart'))
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      if (editingGroup) {
        // Update all records in the group
        for (const rec of editingGroup.records) {
          await pb.collection('hall_closures').update(rec.id, {
            ...form,
            hall: rec.hall, // Keep each record's original hall
          })
          logActivity('update', 'hall_closures', rec.id, form)
        }
      } else {
        const rec = await pb.collection('hall_closures').create(form)
        logActivity('create', 'hall_closures', rec.id, form)
      }
      setForm(emptyForm)
      setEditingGroup(null)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common:errorSaving'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteGroup(group: ClosureGroup) {
    const msg = group.records.length > 1
      ? `${t('deleteClosureConfirm')} (${group.records.length} ${t('halls')})`
      : t('deleteClosureConfirm')
    if (!window.confirm(msg)) return
    try {
      for (const rec of group.records) {
        await pb.collection('hall_closures').delete(rec.id)
        logActivity('delete', 'hall_closures', rec.id)
      }
      if (editingGroup?.key === group.key) cancelEdit()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common:errorSaving'))
    }
  }

  const allHalls = halls.length > 0 && groups.length > 0

  return (
    <Modal open onClose={onClose} title={t('closuresTitle')} size="lg">
      <div className="space-y-6">
        {/* Existing closures grouped */}
        {groups.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('currentClosures')}</h3>
            <div className="max-h-80 divide-y overflow-y-auto rounded-md border dark:border-gray-700">
              {groups.map((group) => {
                const isAllHalls = allHalls && group.records.length >= halls.length
                const dateRange = group.start_date === group.end_date
                  ? formatDateDisplay(group.start_date)
                  : `${formatDateDisplay(group.start_date)} – ${formatDateDisplay(group.end_date)}`

                return (
                  <div key={group.key} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{group.reason}</span>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${SOURCE_COLORS[group.source] ?? SOURCE_COLORS.admin}`}>
                            {sourceLabel(group.source)}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {dateRange}
                          <span className="mx-1.5">·</span>
                          {isAllHalls ? (
                            <span className="font-medium text-gray-600 dark:text-gray-300">{t('allHalls')}</span>
                          ) : (
                            group.hallNames.sort().join(', ')
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => startEdit(group)}
                          className="min-h-[44px] rounded px-2 py-1 text-xs text-brand-600 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-gray-800 sm:min-h-0"
                        >
                          {t('common:edit')}
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group)}
                          className="min-h-[44px] rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-800 dark:hover:bg-gray-800 sm:min-h-0"
                        >
                          {t('common:delete')}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('noClosures')}</p>
        )}

        {/* Add/edit form */}
        <div className="space-y-4 rounded-lg border bg-gray-50 dark:bg-gray-900 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {editingGroup ? t('editClosure') : t('addNewClosure')}
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('hall')}</label>
              <select
                value={form.hall}
                onChange={(e) => update('hall', e.target.value)}
                disabled={!!editingGroup}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50"
              >
                <option value="">{t('selectPlaceholder')}</option>
                {halls.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
              {editingGroup && editingGroup.records.length > 1 && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t('editAppliesToAllHalls', { count: editingGroup.records.length })}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('source')}</label>
              <select
                value={form.source}
                onChange={(e) => update('source', e.target.value as typeof form.source)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('common:from')}</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => update('start_date', e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('common:to')}</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => update('end_date', e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('common:reason')}</label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => update('reason', e.target.value)}
              placeholder="e.g. Holidays, maintenance, renovation"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            {editingGroup && (
              <button
                onClick={cancelEdit}
                className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {t('common:cancel')}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {isSaving ? t('common:saving') : editingGroup ? t('common:update') : t('common:add')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
