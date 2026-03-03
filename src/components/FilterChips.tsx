import { getTeamColor } from '../utils/teamColors'

interface FilterChipOption {
  value: string
  label: string
  /** Tailwind classes for selected state (e.g. "bg-brand-100 text-brand-800 border-brand-200") */
  colorClasses?: string
}

interface FilterChipsProps {
  options: FilterChipOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  multiple?: boolean
  /** Compact mode: smaller chips for use below calendar */
  compact?: boolean
}

export default function FilterChips({
  options,
  selected,
  onChange,
  multiple = true,
  compact = false,
}: FilterChipsProps) {
  function handleClick(value: string) {
    if (multiple) {
      if (selected.includes(value)) {
        onChange(selected.filter((v) => v !== value))
      } else {
        onChange([...selected, value])
      }
    } else {
      onChange(selected.includes(value) ? [] : [value])
    }
  }

  const sizeClasses = compact
    ? 'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors'
    : 'min-h-[44px] rounded-full border px-3 py-2 text-sm font-medium transition-colors sm:min-h-0 sm:py-1 sm:text-xs'

  const unselectedClasses = 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'

  return (
    <div className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-2 sm:gap-1.5'}`}>
      {options.map((option) => {
        const isSelected = selected.includes(option.value)

        if (option.colorClasses) {
          return (
            <button
              key={option.value}
              onClick={() => handleClick(option.value)}
              className={`${sizeClasses} ${isSelected ? option.colorClasses : unselectedClasses}`}
            >
              {option.label}
            </button>
          )
        }

        const teamColor = getTeamColor(option.label)
        return (
          <button
            key={option.value}
            onClick={() => handleClick(option.value)}
            className={`${sizeClasses} ${!isSelected ? unselectedClasses : ''}`}
            style={
              isSelected
                ? {
                    backgroundColor: teamColor.bg,
                    color: teamColor.text,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: teamColor.border,
                  }
                : undefined
            }
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
