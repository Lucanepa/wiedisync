import { useTranslation } from 'react-i18next'
import FilterChips from '../../components/FilterChips'
import { useTeams } from '../../hooks/useTeams'
import type { CalendarFilterState, SourceFilter } from '../../types/calendar'

interface CalendarFiltersProps {
  filters: CalendarFilterState
  onChange: (filters: CalendarFilterState) => void
  allowedSources?: SourceFilter[]
  /** Compact mode: smaller chips for use below the calendar */
  compact?: boolean
}

export default function CalendarFilters({ filters, onChange, allowedSources, compact }: CalendarFiltersProps) {
  const { t } = useTranslation('calendar')

  const allSourceOptions = [
    { value: 'game-home', label: t('gameTypeHome'), colorClasses: 'bg-brand-100 text-brand-800 border-brand-200' },
    { value: 'game-away', label: t('gameTypeAway'), colorClasses: 'bg-amber-100 text-amber-800 border-amber-200' },
    { value: 'training', label: t('sourceTrainings'), colorClasses: 'bg-green-100 text-green-800 border-green-200' },
    { value: 'closure', label: t('sourceClosures'), colorClasses: 'bg-red-100 text-red-800 border-red-200' },
    { value: 'event', label: t('sourceEvents'), colorClasses: 'bg-purple-100 text-purple-800 border-purple-200' },
    { value: 'hall', label: t('sourceHallHW'), colorClasses: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  ]
  const sourceOptions = allowedSources
    ? allSourceOptions.filter((o) => allowedSources.includes(o.value as SourceFilter))
    : allSourceOptions
  const { data: teams } = useTeams()

  const teamChipOptions = teams.map((t) => ({
    value: t.id,
    label: t.name,
  }))

  return (
    <div className={`flex flex-col ${compact ? 'gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3' : 'gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4'}`}>
      <FilterChips
        options={sourceOptions}
        selected={filters.sources}
        onChange={(sources) => onChange({ ...filters, sources: sources as SourceFilter[] })}
        compact={compact}
      />

      {teamChipOptions.length > 0 && (
        <div className={`${compact ? 'border-t border-gray-200 pt-2 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0 dark:border-gray-700' : 'border-t border-gray-200 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 dark:border-gray-700'}`}>
          <FilterChips
            options={teamChipOptions}
            selected={filters.selectedTeamIds}
            onChange={(ids) => onChange({ ...filters, selectedTeamIds: ids })}
            compact={compact}
          />
        </div>
      )}
    </div>
  )
}
