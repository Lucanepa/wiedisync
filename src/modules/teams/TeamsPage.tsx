import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { usePB } from '../../hooks/usePB'
import { useAuth } from '../../hooks/useAuth'
import EmptyState from '../../components/EmptyState'
import TeamCard from './TeamCard'
import type { Team, MemberTeam } from '../../types'
import LoadingSpinner from '../../components/LoadingSpinner'
import { getCurrentSeason } from '../../utils/dateHelpers'

export default function TeamsPage() {
  const { t } = useTranslation('teams')
  const { isAdmin, isVorstand, coachTeamIds, memberTeamIds } = useAuth()
  const { data: teams, isLoading } = usePB<Team>('teams', {
    filter: 'active=true',
    sort: 'name',
    perPage: 50,
  })
  const season = getCurrentSeason()
  const { data: memberTeams } = usePB<MemberTeam>('member_teams', {
    filter: `season="${season}"`,
    perPage: 500,
  })

  const hasElevatedAccess = isAdmin || isVorstand
  const visibleTeams = hasElevatedAccess
    ? teams
    : teams.filter((t) => memberTeamIds.includes(t.id) || coachTeamIds.includes(t.id))

  const countByTeam = memberTeams.reduce<Record<string, number>>((acc, mt) => {
    acc[mt.team] = (acc[mt.team] ?? 0) + 1
    return acc
  }, {})

  const { vbTeams, bbTeams } = useMemo(() => {
    // Women first, then men, then mixed
    const genderGroup = (name: string): number => {
      // Volleyball: D1, DU23 etc. Basketball: "Lions D1", "Rhinos D3", "Damen D-Classics", DU18
      if (/^D\d|^DU\d|Lions|Rhinos|Damen/i.test(name)) return 0
      if (/^MU?\d/i.test(name)) return 2
      return 1 // H1, HU23, Herren, Legends, H-Classics etc.
    }
    // Within gender: main teams (1,2,3…), specials (Legends/Classics), then youth (U-teams descending)
    const teamOrder = (name: string): number => {
      // VB: H1, D2 etc. BB: "Herren 1 H1" → extract trailing number
      const mainMatch = name.match(/[HD](\d+)$/)
      if (mainMatch) return parseInt(mainMatch[1], 10)
      // Sub-brands: "Lions D1" → D1, "Rhinos D3" → D3
      const subMatch = name.match(/[HD](\d+)/)
      if (subMatch && /Lions|Rhinos/i.test(name)) return parseInt(subMatch[1], 10)
      // Legends, Classics → after main teams, before youth
      if (/Legends|Classics/i.test(name)) return 5
      // Youth: U23, U20 etc. — higher age first
      const uMatch = name.match(/U(\d+)/)
      if (uMatch) return 100 - parseInt(uMatch[1], 10)
      return 200
    }
    const sortTeams = (a: Team, b: Team) => {
      const ga = genderGroup(a.name), gb = genderGroup(b.name)
      if (ga !== gb) return ga - gb
      return teamOrder(a.name) - teamOrder(b.name)
    }
    const nonClassics = visibleTeams.filter((t) => !/Classics/i.test(t.name))
    const vb = nonClassics.filter((t) => t.sport === 'volleyball').sort(sortTeams)
    const bb = nonClassics.filter((t) => t.sport === 'basketball').sort(sortTeams)
    return { vbTeams: vb, bbTeams: bb }
  }, [visibleTeams])

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (visibleTeams.length === 0) {
    return (
      <EmptyState
        icon="👥"
        title={hasElevatedAccess ? t('noTeams') : t('noTeamMembership')}
        description={hasElevatedAccess ? t('noTeamsDescription') : t('noTeamMembershipDescription')}
      />
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-gray-100">{t('title')}</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('subtitleSeason', { season })}</p>

      {vbTeams.length > 0 && (
        <>
          {bbTeams.length > 0 && (
            <h2 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100">Volleyball</h2>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vbTeams.map((team) => (
              <TeamCard key={team.id} team={team} memberCount={countByTeam[team.id] ?? 0} />
            ))}
          </div>
        </>
      )}

      {bbTeams.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold text-gray-900 dark:text-gray-100">Basketball</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bbTeams.map((team) => (
              <TeamCard key={team.id} team={team} memberCount={countByTeam[team.id] ?? 0} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
