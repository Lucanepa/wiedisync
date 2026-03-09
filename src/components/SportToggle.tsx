import { useTranslation } from 'react-i18next'
import type { SportView } from '../hooks/useSportPreference'

interface SportToggleProps {
  value: SportView
  onChange: (value: SportView) => void
  showAll?: boolean
  className?: string
}

function VolleyballIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2C12 2 8 6 8 12s4 10 4 10" />
      <path d="M12 2c0 0 4 4 4 10s-4 10-4 10" />
      <path d="M2 12h20" />
      <path d="M4.5 5.5C7 8 9.5 9.5 12 10c2.5.5 5 .5 7.5-1.5" />
      <path d="M4.5 18.5C7 16 9.5 14.5 12 14c2.5-.5 5-.5 7.5 1.5" />
    </svg>
  )
}

function BasketballIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v20" />
      <path d="M2 12h20" />
      <path d="M4.93 4.93c4.08 2.64 8.74 3.2 14.14 0" />
      <path d="M4.93 19.07c4.08-2.64 8.74-3.2 14.14 0" />
    </svg>
  )
}

export { VolleyballIcon, BasketballIcon }

const OPTIONS: { value: SportView }[] = [
  { value: 'vb' },
  { value: 'bb' },
  { value: 'all' },
]

function SportIcon({ sport }: { sport: SportView }) {
  if (sport === 'vb') return <VolleyballIcon />
  if (sport === 'bb') return <BasketballIcon />
  return null
}

export default function SportToggle({ value, onChange, showAll = true, className = '' }: SportToggleProps) {
  const { t } = useTranslation('common')
  const items = showAll ? OPTIONS : OPTIONS.filter((o) => o.value !== 'all')

  return (
    <div className={`flex items-center overflow-hidden rounded-md border border-gray-300 dark:border-gray-600 ${className}`}>
      {items.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex items-center justify-center px-3 py-1.5 text-sm font-medium transition-colors ${
            value === opt.value
              ? 'bg-brand-100 text-brand-800 dark:bg-brand-700 dark:text-white'
              : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
          } ${i > 0 ? 'border-l border-gray-300 dark:border-gray-600' : ''}`}
        >
          {opt.value === 'all' ? t('all') : <SportIcon sport={opt.value} />}
        </button>
      ))}
    </div>
  )
}
