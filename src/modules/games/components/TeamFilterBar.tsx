import { useTranslation } from 'react-i18next'
import TeamMultiSelect from '../../../components/TeamMultiSelect'
import { teamColors, teamSport } from '../../../utils/teamColors'
import type { SportView } from '../../../hooks/useSportPreference'

const TEAM_ORDER = Object.keys(teamColors).filter((k) => k !== 'Other')

interface TeamFilterBarProps {
  selected: string[]
  onChange: (selected: string[]) => void
  multiSelect?: boolean
  showAll?: boolean
  sport?: SportView
  /** When set, only show these team names (non-admin mode) */
  limitToTeams?: string[]
  /** Enforce radio behaviour: selecting a team replaces the array instead of toggling. */
  singleSelect?: boolean
}

export default function TeamFilterBar({
  selected,
  onChange,
  sport = 'all',
  limitToTeams,
  singleSelect = false,
}: TeamFilterBarProps) {
  const { t } = useTranslation('common')

  // Filter team chips by sport (and optionally by user's teams)
  const visibleTeams = TEAM_ORDER.filter((team) => {
    if (limitToTeams && !limitToTeams.includes(team)) return false
    if (sport === 'all') return true
    const s = teamSport[team]
    if (!s) return false
    return sport === 'vb' ? s === 'volleyball' : s === 'basketball'
  })

  const showGroups = sport === 'all'

  const options = visibleTeams.map((team) => {
    const s = teamSport[team]
    // When showing both sports: prefix VB- for volleyball, keep BB- for basketball
    let label: string
    if (showGroups) {
      label = s === 'volleyball' ? `VB-${team}` : team
    } else if (sport === 'bb') {
      label = team.replace(/^BB-/, '')
    } else {
      label = team
    }

    return {
      value: team,
      label,
      colorKey: team,
      group: showGroups
        ? (s === 'volleyball' ? t('volleyball') : t('basketball'))
        : undefined,
    }
  })

  // In single-select mode, collapse the next array to a single membership:
  // pick the newest addition (or fall back to the last entry / empty).
  function handleChange(next: string[]) {
    if (!singleSelect) {
      onChange(next)
      return
    }
    if (next.length === 0) {
      onChange([])
      return
    }
    const previous = new Set(selected)
    const added = next.find((v) => !previous.has(v))
    onChange([added ?? next[next.length - 1]!])
  }

  return (
    <div className="max-w-sm">
      <TeamMultiSelect
        options={options}
        selected={selected}
        onChange={handleChange}
        placeholder={t('allTeams')}
      />
    </div>
  )
}
