import { Volleyball } from 'lucide-react'
import type { SportView } from '../hooks/useSportPreference'

interface SportToggleProps {
  value: SportView
  onChange: (value: SportView) => void
  showAll?: boolean
  className?: string
}

function VolleyballIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return <Volleyball className={className} />
}

function BasketballIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M4.93 4.93c4.08 2.64 8.74 3.2 14.14 0" />
      <path d="M4.93 19.07c4.08-2.64 8.74-3.2 14.14 0" />
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
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
          {opt.value === 'all' ? (
            <span className="flex items-center gap-1">
              <VolleyballIcon className="h-4 w-4" />
              <BasketballIcon className="h-4 w-4" />
            </span>
          ) : <SportIcon sport={opt.value} />}
        </button>
      ))}
    </div>
  )
}
