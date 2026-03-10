import { useTranslation } from 'react-i18next'
import FilterChips from '../../components/FilterChips'
import TeamMultiSelect from '../../components/TeamMultiSelect'
import { useTeams } from '../../hooks/useTeams'
import { pbNameToColorKey } from '../../utils/teamColors'
import type { CalendarFilterState, SourceFilter } from '../../types/calendar'

interface CalendarFiltersProps {
  filters: CalendarFilterState
  onChange: (filters: CalendarFilterState) => void
  allowedSources?: SourceFilter[]
  /** Compact mode: smaller chips for use below the calendar */
  compact?: boolean
  /** Show All/None toggle for each section */
  showBulkToggle?: boolean
}

export default function CalendarFilters({ filters, onChange, allowedSources, compact, showBulkToggle }: CalendarFiltersProps) {
  const { t } = useTranslation('calendar')
  const { t: tc } = useTranslation('common')

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

  // Check if we have both volleyball and basketball teams
  const hasVB = teams.some((t) => t.sport === 'volleyball')
  const hasBB = teams.some((t) => t.sport === 'basketball')
  const showGroups = hasVB && hasBB

  const teamOptions = teams
    .filter((team) => team.sport === 'volleyball' || team.sport === 'basketball')
    .map((team) => {
      const colorKey = pbNameToColorKey(team.name, team.sport)
      const sportLabel = team.sport === 'volleyball' ? tc('volleyball') : tc('basketball')
      // When both sports shown, prefix VB-/BB- for clarity
      const label = showGroups
        ? (team.sport === 'volleyball' ? `VB-${team.name}` : `BB-${team.name}`)
        : team.name

      return {
        value: team.id,
        label,
        colorKey,
        group: showGroups ? sportLabel : undefined,
      }
    })

  // For teams: empty selectedTeamIds means "all teams" in the data layer.
  function handleTeamChange(ids: string[]) {
    onChange({ ...filters, selectedTeamIds: ids })
  }

  return (
    <div className={`flex flex-col ${compact ? 'gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3' : 'gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4'}`}>
      <FilterChips
        options={sourceOptions}
        selected={filters.sources}
        onChange={(sources) => onChange({ ...filters, sources: sources as SourceFilter[] })}
        compact={compact}
        showBulkToggle={showBulkToggle}
      />

      {teamOptions.length > 0 && (
        <div className={`${compact ? 'border-t border-gray-200 pt-2 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0 dark:border-gray-700' : 'border-t border-gray-200 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 dark:border-gray-700'}`}>
          <div className={compact ? 'w-48' : 'w-64'}>
            <TeamMultiSelect
              options={teamOptions}
              selected={filters.selectedTeamIds}
              onChange={handleTeamChange}
              placeholder={tc('allTeams')}
            />
          </div>
        </div>
      )}
    </div>
  )
}
