import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SlotData } from '../hooks/useAvailableSlots'

interface Props {
  slots: SlotData[]
  onPickSlot: (slotId: string) => Promise<void>
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
  return `${weekdays[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`
}

export default function HomeSlotPicker({ slots, onPickSlot }: Props) {
  const { t } = useTranslation('gameScheduling')
  const [selected, setSelected] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  if (slots.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t('noSlotsAvailable')}</p>
  }

  const handleConfirm = async () => {
    if (!selected) return
    setConfirming(true)
    try {
      await onPickSlot(selected)
    } finally {
      setConfirming(false)
      setSelected(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {slots.map(slot => (
          <button
            key={slot.id}
            onClick={() => setSelected(slot.id === selected ? null : slot.id)}
            className={`w-full rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
              selected === slot.id
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500 dark:bg-blue-900/30'
                : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {formatDate(slot.date)}
                </span>
                <span className="ml-2 text-gray-600 dark:text-gray-400">
                  {slot.start_time} – {slot.end_time}
                </span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">{slot.hall_name}</span>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <button
          onClick={handleConfirm}
          disabled={confirming}
          className="mt-3 w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {confirming ? '...' : t('confirmSlot')}
        </button>
      )}
    </div>
  )
}
