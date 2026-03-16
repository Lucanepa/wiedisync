import { useTranslation } from 'react-i18next'
import Modal from '@/components/Modal'
import FilterChips from '../../components/FilterChips'
import TeamMultiSelect from '../../components/TeamMultiSelect'
import { useTeams } from '../../hooks/useTeams'
import { pbNameToColorKey } from '../../utils/teamColors'
import type { CalendarFilterState, SourceFilter } from '../../types/calendar'

interface CalendarFiltersProps {
  open: boolean
  onClose: () => void
  filters: CalendarFilterState
  onChange: (filters: CalendarFilterState) => void
  allowedSources?: SourceFilter[]
}

export default function CalendarFilters({ open, onClose, filters, onChange, allowedSources }: CalendarFiltersProps) {
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

  const hasVB = teams.some((t) => t.sport === 'volleyball')
  const hasBB = teams.some((t) => t.sport === 'basketball')
  const showGroups = hasVB && hasBB

  const teamOptions = teams
    .filter((team) => team.sport === 'volleyball' || team.sport === 'basketball')
    .map((team) => {
      const colorKey = pbNameToColorKey(team.name, team.sport)
      const sportLabel = team.sport === 'volleyball' ? tc('volleyball') : tc('basketball')
      const label = showGroups
        ? (team.sport === 'volleyball' ? `VB-${team.name}` : `BB-${team.name}`)
        : team.name
      return { value: team.id, label, colorKey, group: showGroups ? sportLabel : undefined }
    })

  return (
    <Modal open={open} onClose={onClose} title={t('filterTitle')} size="sm">
      <div className="space-y-5">
        {/* Source type chips */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('filterCategories')}
          </label>
          <FilterChips
            options={sourceOptions}
            selected={filters.sources}
            onChange={(sources) => onChange({ ...filters, sources: sources as SourceFilter[] })}
            showBulkToggle
          />
        </div>

        {/* Team filter */}
        {teamOptions.length > 0 && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {tc('team')}
            </label>
            <TeamMultiSelect
              options={teamOptions}
              selected={filters.selectedTeamIds}
              onChange={(ids) => onChange({ ...filters, selectedTeamIds: ids })}
              placeholder={tc('allTeams')}
            />
          </div>
        )}
      </div>
    </Modal>
  )
}

/** Count active filters (deselected sources + selected teams) */
export function getActiveFilterCount(
  filters: CalendarFilterState,
  totalSources: number,
): number {
  let count = 0
  if (filters.sources.length < totalSources) count += 1
  if (filters.selectedTeamIds.length > 0) count += 1
  return count
}
