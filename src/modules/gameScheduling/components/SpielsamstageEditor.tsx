import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Hall, SpielsamstagConfig } from '../../../types'
import DatePicker from '@/components/ui/DatePicker'
import { fetchAllItems } from '../../../lib/api'

const DEFAULT_TIMES = ['11:00', '13:30', '16:00']

interface Props {
  spielsamstage: SpielsamstagConfig[]
  onUpdate: (spielsamstage: SpielsamstagConfig[]) => Promise<void>
}

export default function SpielsamstageEditor({ spielsamstage, onUpdate }: Props) {
  const { t } = useTranslation('gameScheduling')
  const [halls, setHalls] = useState<Hall[]>([])
  const [localData, setLocalData] = useState<SpielsamstagConfig[]>(spielsamstage)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLocalData(spielsamstage)
  }, [spielsamstage])

  useEffect(() => {
    fetchAllItems<Hall>('halls', { sort: ['name'] }).then(setHalls).catch(() => {})
  }, [])

  const addSamstag = () => {
    const newEntry: SpielsamstagConfig = {
      date: '',
      slots: DEFAULT_TIMES.map(time => ({ time, hall_id: '' })),
    }
    setLocalData([...localData, newEntry])
  }

  const removeSamstag = (index: number) => {
    setLocalData(localData.filter((_, i) => i !== index))
  }

  const updateDate = (index: number, date: string) => {
    const updated = [...localData]
    updated[index] = { ...updated[index], date }
    setLocalData(updated)
  }

  const updateSlotHall = (sIdx: number, slotIdx: number, hallId: string) => {
    const updated = [...localData]
    const slots = [...updated[sIdx].slots]
    slots[slotIdx] = { ...slots[slotIdx], hall_id: hallId }
    updated[sIdx] = { ...updated[sIdx], slots }
    setLocalData(updated)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(localData.filter(s => s.date))
    } finally {
      setSaving(false)
    }
  }

  // KWI halls for priority display
  const kwiHalls = halls.filter(h => h.name.toLowerCase().includes('kwi'))

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('spielsamstage')}</h2>
        <button
          onClick={addSamstag}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          + {t('addSpielssamstag')}
        </button>
      </div>

      {localData.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Noch keine Spielsamstage konfiguriert.</p>
      )}

      <div className="space-y-4">
        {localData.map((ss, sIdx) => (
          <div key={sIdx} className="rounded-md border border-gray-100 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700">
            <div className="mb-3 flex items-center gap-3">
              <DatePicker
                value={ss.date}
                onChange={(v) => updateDate(sIdx, v)}
              />
              <button
                onClick={() => removeSamstag(sIdx)}
                className="text-sm text-red-600 hover:text-red-800 dark:text-red-400"
              >
                {t('removeSpielssamstag')}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {ss.slots.map((slot, slotIdx) => (
                <div key={slotIdx} className="flex items-center gap-2">
                  <span className="w-14 text-sm font-medium text-gray-700 dark:text-gray-300">{slot.time}</span>
                  <select
                    value={slot.hall_id}
                    onChange={e => updateSlotHall(sIdx, slotIdx, e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-500 dark:bg-gray-600 dark:text-gray-100"
                  >
                    <option value="">{t('hall')}...</option>
                    {kwiHalls.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                    <optgroup label="Andere">
                      {halls.filter(h => !h.name.toLowerCase().includes('kwi')).map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {localData.length > 0 && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '...' : 'Speichern'}
        </button>
      )}
    </div>
  )
}
