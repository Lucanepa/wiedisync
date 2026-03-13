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
}

export default function TeamFilterBar({
  selected,
  onChange,
  sport = 'all',
  limitToTeams,
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

  return (
    <div className="max-w-sm">
      <TeamMultiSelect
        options={options}
        selected={selected}
        onChange={onChange}
        placeholder={t('allTeams')}
      />
    </div>
  )
}
