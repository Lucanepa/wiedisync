import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, X } from 'lucide-react'

const AFFECTS_OPTIONS = ['trainings', 'games', 'events'] as const
const ALL_VALUE = 'all'

interface AffectsMultiSelectProps {
  selected: string[]
  onChange: (selected: string[]) => void
  label?: string
}

const AFFECTS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  trainings: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  games: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-800' },
  events: { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  all: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300', border: 'border-gray-200 dark:border-gray-600' },
}

export default function AffectsMultiSelect({ selected, onChange, label }: AffectsMultiSelectProps) {
  const { t } = useTranslation('absences')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const isAll = selected.includes(ALL_VALUE) || selected.length === 0

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function toggle(value: string) {
    if (value === ALL_VALUE) {
      onChange([ALL_VALUE])
      return
    }

    const without = selected.filter((a) => a !== ALL_VALUE)
    const toggled = without.includes(value)
      ? without.filter((a) => a !== value)
      : [...without, value]

    // All three selected → collapse to 'all'; none selected → default to 'all'
    if (toggled.length === 0 || toggled.length === AFFECTS_OPTIONS.length) {
      onChange([ALL_VALUE])
    } else {
      onChange(toggled)
    }
  }

  function handleClear() {
    onChange([ALL_VALUE])
  }

  const labelMap: Record<string, string> = {
    trainings: t('affectsTrainings'),
    games: t('affectsGames'),
    events: t('affectsEvents'),
    all: t('affectsAll'),
  }

  const displayItems = isAll ? [] : selected.filter((s) => s !== ALL_VALUE)

  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      )}
      <div ref={ref} className="relative w-full">
        {/* Trigger */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex min-h-[44px] w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 sm:min-h-0"
        >
          <div className="flex flex-1 flex-wrap items-center gap-1.5 overflow-hidden">
            {isAll ? (
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${AFFECTS_COLORS.all.bg} ${AFFECTS_COLORS.all.text} ${AFFECTS_COLORS.all.border}`}>
                {labelMap.all}
              </span>
            ) : (
              displayItems.map((value) => {
                const colors = AFFECTS_COLORS[value] ?? AFFECTS_COLORS.all
                return (
                  <span key={value} className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text} ${colors.border}`}>
                    {labelMap[value] ?? value}
                  </span>
                )
              })
            )}
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* Clear button */}
        {!isAll && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleClear()
            }}
            className="absolute right-8 top-1/2 z-10 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label={t('affectsAll')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Dropdown */}
        {open && (
          <div className="absolute left-0 z-50 mt-1 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
            {/* All option */}
            <button
              type="button"
              onClick={() => toggle(ALL_VALUE)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isAll ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              <CheckboxIcon checked={isAll} />
              {labelMap.all}
            </button>

            {AFFECTS_OPTIONS.map((value) => {
              const checked = !isAll && selected.includes(value)
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggle(value)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    checked ? 'bg-gray-100 dark:bg-gray-700/50' : ''
                  }`}
                >
                  <CheckboxIcon checked={checked} />
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${AFFECTS_COLORS[value].bg} ${AFFECTS_COLORS[value].text} ${AFFECTS_COLORS[value].border}`}>
                    {labelMap[value]}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function CheckboxIcon({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
        checked ? 'border-brand-500 bg-brand-500' : 'border-gray-300 dark:border-gray-500'
      }`}
    >
      {checked && (
        <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}
