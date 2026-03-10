import TeamChip from '../../../components/TeamChip'
import { VolleyballIcon, BasketballIcon } from '../../../components/SportToggle'
import { teamColors, teamSport } from '../../../utils/teamColors'
import type { SportView } from '../../../hooks/useSportPreference'

const TEAM_ORDER = Object.keys(teamColors).filter((k) => k !== 'Other')

interface TeamFilterBarProps {
  selected: string[]
  onChange: (selected: string[]) => void
  multiSelect?: boolean
  showAll?: boolean
  sport?: SportView
}

export default function TeamFilterBar({
  selected,
  onChange,
  multiSelect = true,
  showAll = true,
  sport = 'all',
}: TeamFilterBarProps) {
  const allSelected = selected.length === 0

  // Filter team chips by sport
  const visibleTeams = TEAM_ORDER.filter((team) => {
    if (sport === 'all') return true
    const s = teamSport[team]
    if (!s) return false
    return sport === 'vb' ? s === 'volleyball' : s === 'basketball'
  })

  const vbTeams = visibleTeams.filter((t) => teamSport[t] === 'volleyball')
  const bbTeams = visibleTeams.filter((t) => teamSport[t] === 'basketball')
  const showGroups = sport === 'all' && vbTeams.length > 0 && bbTeams.length > 0

  function handleClick(team: string) {
    if (multiSelect) {
      if (selected.includes(team)) {
        onChange(selected.filter((t) => t !== team))
      } else {
        onChange([...selected, team])
      }
    } else {
      onChange(selected.includes(team) ? [] : [team])
    }
  }

  // Label logic:
  // - "all" view: show sport icon inside chip, strip "BB-" prefix from basketball teams
  // - single sport bb: strip "BB-" prefix (redundant)
  // - single sport vb: names are already clean
  function chipLabel(team: string): string | undefined {
    if (sport === 'all') {
      // Strip "BB-" prefix — the icon distinguishes the sport
      if (teamSport[team] === 'basketball') return team.replace(/^BB-/, '')
      return undefined // volleyball names are already clean
    }
    if (sport === 'bb') {
      return team.replace(/^BB-/, '')
    }
    return undefined
  }

  function chipIcon(team: string) {
    if (sport !== 'all') return undefined
    const s = teamSport[team]
    if (s === 'volleyball') return <VolleyballIcon className="h-3.5 w-3.5" />
    if (s === 'basketball') return <BasketballIcon className="h-3.5 w-3.5" />
    return undefined
  }

  function renderChip(team: string) {
    return (
      <button
        key={team}
        onClick={() => handleClick(team)}
        className={`shrink-0 transition-opacity ${
          !allSelected && !selected.includes(team) ? 'opacity-40 hover:opacity-70' : ''
        }`}
      >
        <TeamChip team={team} label={chipLabel(team)} icon={chipIcon(team)} />
      </button>
    )
  }

  return (
    <div className="space-y-2">
      {showGroups ? (
        <>
          {showAll && (
            <div className="flex items-center gap-2 pb-1">
              <button
                onClick={() => onChange([])}
                className={`shrink-0 rounded-full border px-3 py-1 text-sm font-semibold transition-opacity ${
                  allSelected
                    ? 'border-gray-400 bg-gray-600 text-white'
                    : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 opacity-50 hover:opacity-75'
                }`}
              >
                Alle
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <VolleyballIcon className="h-4 w-4 shrink-0 text-amber-400 dark:text-amber-300" />
            {vbTeams.map(renderChip)}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <BasketballIcon className="h-4 w-4 shrink-0 text-orange-500 dark:text-orange-400" />
            {bbTeams.map(renderChip)}
          </div>
        </>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {showAll && (
            <button
              onClick={() => onChange([])}
              className={`shrink-0 rounded-full border px-3 py-1 text-sm font-semibold transition-opacity ${
                allSelected
                  ? 'border-gray-400 bg-gray-600 text-white'
                  : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 opacity-50 hover:opacity-75'
              }`}
            >
              Alle
            </button>
          )}
          {visibleTeams.map(renderChip)}
        </div>
      )}
    </div>
  )
}
