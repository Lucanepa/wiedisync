import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, X } from 'lucide-react'
import TeamChip from './TeamChip'
import { getTeamColor } from '../utils/teamColors'

interface TeamOption {
  value: string
  label: string
  /** Key into teamColors for coloring (defaults to label) */
  colorKey?: string
  /** Optional group label (e.g. "Volleyball", "Basketball") */
  group?: string
}

interface TeamMultiSelectProps {
  options: TeamOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  /** Placeholder when nothing is selected (defaults to t('common:all')) */
  placeholder?: string
}

export default function TeamMultiSelect({ options, selected, onChange, placeholder }: TeamMultiSelectProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const allSelected = selected.length === 0

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
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  function handleSelectAll() {
    onChange([])
  }

  // Group options if any have a group
  const hasGroups = options.some((o) => o.group)
  const groups = hasGroups
    ? [...new Set(options.map((o) => o.group ?? ''))].filter(Boolean)
    : []

  // Selected chips to display
  const selectedOptions = allSelected ? [] : options.filter((o) => selected.includes(o.value))

  return (
    <div ref={ref} className="relative w-full">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-h-[44px] w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 sm:min-h-0"
      >
        <div className="flex flex-1 flex-wrap items-center gap-1.5 overflow-hidden">
          {allSelected ? (
            <span className="text-gray-500 dark:text-gray-400">{placeholder ?? t('all')}</span>
          ) : selectedOptions.length <= 5 ? (
            selectedOptions.map((o) => (
              <TeamChip key={o.value} team={o.colorKey ?? o.label} label={o.label} size="xs" />
            ))
          ) : (
            <span className="text-gray-700 dark:text-gray-300">
              {selectedOptions.length} {t('team')}{selectedOptions.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {!allSelected && selected.length > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleSelectAll() }}
            className="shrink-0 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            title={t('selectNone')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
          {/* All option */}
          <button
            type="button"
            onClick={handleSelectAll}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
              allSelected ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded border border-gray-300 dark:border-gray-500">
              {allSelected && <span className="h-2 w-2 rounded-sm bg-brand-600" />}
            </span>
            {placeholder ?? t('all')}
          </button>

          {hasGroups ? (
            groups.map((group) => (
              <div key={group}>
                <div className="sticky top-0 bg-gray-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  {group}
                </div>
                {options
                  .filter((o) => o.group === group)
                  .map((o) => (
                    <DropdownOption
                      key={o.value}
                      option={o}
                      isSelected={!allSelected && selected.includes(o.value)}
                      onToggle={() => toggle(o.value)}
                    />
                  ))}
              </div>
            ))
          ) : (
            options.map((o) => (
              <DropdownOption
                key={o.value}
                option={o}
                isSelected={!allSelected && selected.includes(o.value)}
                onToggle={() => toggle(o.value)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function DropdownOption({ option, isSelected, onToggle }: { option: TeamOption; isSelected: boolean; onToggle: () => void }) {
  const color = getTeamColor(option.colorKey ?? option.label)

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
        isSelected ? 'bg-gray-50 dark:bg-gray-700/50' : ''
      }`}
    >
      <span
        className="flex h-4 w-4 items-center justify-center rounded border"
        style={{ borderColor: color.border }}
      >
        {isSelected && (
          <span
            className="h-2 w-2 rounded-sm"
            style={{ backgroundColor: color.bg }}
          />
        )}
      </span>
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
        style={{ backgroundColor: color.bg, color: color.text, borderColor: color.border, borderWidth: '1px', borderStyle: 'solid' }}
      >
        {option.label}
      </span>
    </button>
  )
}
