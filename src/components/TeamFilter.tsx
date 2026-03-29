import { useMemo } from 'react'
import { useCollection } from '../lib/query'
import TeamChip from './TeamChip'
import type { Team } from '../types'

interface TeamFilterProps {
  selected: string | null
  onChange: (teamId: string | null) => void
  /** When set, only show these team IDs (non-admin mode) */
  limitToTeamIds?: string[]
  /** Group teams by sport (VB/BB rows) — typically for admin view */
  groupBySport?: boolean
}

export default function TeamFilter({ selected, onChange, limitToTeamIds, groupBySport }: TeamFilterProps) {
  const { data: allTeamsRaw } = useCollection<Team>('teams', { filter: { active: { _eq: true } }, sort: ['name'], limit: 50 })
  const allTeams = allTeamsRaw ?? []

  const teams = useMemo(() => {
    if (!limitToTeamIds || limitToTeamIds.length === 0) return allTeams
    const idSet = new Set(limitToTeamIds)
    return allTeams.filter((t) => idSet.has(t.id))
  }, [allTeams, limitToTeamIds])

  const { vbTeams, bbTeams } = useMemo(() => ({
    vbTeams: teams.filter((t) => t.sport === 'volleyball'),
    bbTeams: teams.filter((t) => t.sport === 'basketball'),
  }), [teams])

  const hasBothSports = vbTeams.length > 0 && bbTeams.length > 0

  const renderChip = (team: Team) => (
    <button key={team.id} onClick={() => onChange(team.id)}>
      <TeamChip
        team={team.name}
        size="sm"
        className={selected === team.id ? 'ring-2 ring-offset-1 ring-gray-400' : 'opacity-60 hover:opacity-100'}
      />
    </button>
  )

  const alleButton = teams.length > 1 && (
    <button
      onClick={() => onChange(null)}
      className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
        selected === null
          ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
      }`}
    >
      Alle
    </button>
  )

  if (groupBySport && hasBothSports) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {alleButton}
          {vbTeams.map(renderChip)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {bbTeams.map(renderChip)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {alleButton}
      {teams.map(renderChip)}
    </div>
  )
}
