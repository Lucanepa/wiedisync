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
  const { isAdmin, isVorstand, isCoach, memberTeamIds } = useAuth()
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

  const hasElevatedAccess = isAdmin || isVorstand || isCoach
  const visibleTeams = hasElevatedAccess
    ? teams
    : teams.filter((t) => memberTeamIds.includes(t.id))

  const countByTeam = memberTeams.reduce<Record<string, number>>((acc, mt) => {
    acc[mt.team] = (acc[mt.team] ?? 0) + 1
    return acc
  }, {})

  const { vbTeams, bbTeams } = useMemo(() => {
    const vb = visibleTeams.filter((t) => t.sport === 'volleyball')
    const bb = visibleTeams.filter((t) => t.sport === 'basketball')
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
