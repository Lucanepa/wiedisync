import { useTranslation } from 'react-i18next'
import type { SportView } from '../hooks/useSportPreference'

interface SportToggleProps {
  value: SportView
  onChange: (value: SportView) => void
  showAll?: boolean
  className?: string
}

const OPTIONS: { value: SportView; labelKey: string }[] = [
  { value: 'vb', labelKey: 'VB' },
  { value: 'bb', labelKey: 'BB' },
  { value: 'all', labelKey: 'all' },
]

export default function SportToggle({ value, onChange, showAll = true, className = '' }: SportToggleProps) {
  const { t } = useTranslation('common')
  const items = showAll ? OPTIONS : OPTIONS.filter((o) => o.value !== 'all')

  return (
    <div className={`flex overflow-hidden rounded-md border border-gray-300 dark:border-gray-600 ${className}`}>
      {items.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${
            value === opt.value
              ? 'bg-brand-100 text-brand-800 dark:bg-brand-700 dark:text-white'
              : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
          } ${i > 0 ? 'border-l border-gray-300 dark:border-gray-600' : ''}`}
        >
          {opt.value === 'all' ? t('all') : opt.labelKey}
        </button>
      ))}
    </div>
  )
}
