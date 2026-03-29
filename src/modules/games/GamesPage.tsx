import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useAdminMode } from '../../hooks/useAdminMode'
import { useSportPreference } from '../../hooks/useSportPreference'
import type { Game, Ranking, Team, Participation, ParticipationWithMember } from '../../types'
import { useCollection } from '../../lib/query'
import { useRealtime } from '../../hooks/useRealtime'
import { teamIds } from '../../utils/teamColors'
import SportToggle from '../../components/SportToggle'
import TeamFilterBar from './components/TeamFilterBar'
import GameTabs from './components/GameTabs'
import type { TabKey } from './components/GameTabs'
import GameCard from './components/GameCard'
import RankingsTable from './components/RankingsTable'
import KscwScoreboard from './components/KscwScoreboard'
import GameDetailModal from './components/GameDetailModal'
import LoadingSpinner from '../../components/LoadingSpinner'
import SharedEmptyState from '../../components/EmptyState'
import { getGameWarnings, type Warning } from '../../utils/participationWarnings'
import { Calendar, Trophy, BarChart3, LayoutGrid } from 'lucide-react'

function buildTeamFilter(teamPbIds: string[]): Record<string, unknown> | null {
  if (teamPbIds.length === 0) return null
  if (teamPbIds.length === 1) return { kscw_team: { _eq: teamPbIds[0] } }
  return { kscw_team: { _in: teamPbIds } }
}

export default function GamesPage() {
  const { t } = useTranslation('games')
  const { user, memberTeamIds, memberTeamNames, coachTeamIds, coachTeamNames, primarySport, teamsLoading } = useAuth()
  // Merge member + coach teams for visibility (coaches see teams they manage)
  const allUserTeamIds = useMemo(() => [...new Set([...memberTeamIds, ...coachTeamIds])], [memberTeamIds, coachTeamIds])
  const allUserTeamNames = useMemo(() => [...new Set([...memberTeamNames, ...coachTeamNames])], [memberTeamNames, coachTeamNames])
  const { effectiveIsAdmin } = useAdminMode()
  const { sport, setSport } = useSportPreference()
  const showSportToggle = effectiveIsAdmin || !user || primarySport === 'both'
  const [activeTab, setActiveTab] = useState<TabKey>('upcoming')
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [autoSelected, setAutoSelected] = useState(false)

  // Auto-select user's teams on initial load
  useEffect(() => {
    if (!autoSelected && allUserTeamNames.length > 0) {
      setSelectedTeams(allUserTeamNames)
      setAutoSelected(true)
    }
  }, [allUserTeamNames, autoSelected])

  // Reset team selection when sport changes (old selections may not match new sport)
  useEffect(() => {
    // Non-admin users: reset to their own teams; admins: show all
    setSelectedTeams(effectiveIsAdmin ? [] : allUserTeamNames)
  }, [sport]) // eslint-disable-line react-hooks/exhaustive-deps

  const INITIAL_LIMIT = 20

  // Fetch all KSCW teams to map name → id
  const { data: allTeamsRaw } = useCollection<Team>('teams', { sort: ['name'], all: true, fields: ['id', 'name'] })
  const allTeams = allTeamsRaw ?? []
  const teamNameToId = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of allTeams) map.set(t.name, t.id)
    return map
  }, [allTeams])

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])
  // For non-admins, always scope to their teams (even if filter cleared)
  const effectiveTeams = selectedTeams.length > 0
    ? selectedTeams
    : (!effectiveIsAdmin && allUserTeamNames.length > 0 ? allUserTeamNames : [])
  // Convert name codes to record IDs for the kscw_team filter
  const effectiveTeamIds = effectiveTeams
    .map((name) => teamNameToId.get(name))
    .filter((id): id is string => !!id)
  // For non-admins, also include their team IDs as fallback
  const filterTeamIds = effectiveTeamIds.length > 0
    ? effectiveTeamIds
    : (!effectiveIsAdmin && allUserTeamIds.length > 0 ? allUserTeamIds : [])
  const teamFilter = buildTeamFilter(filterTeamIds)

  // Sport filter clause for Directus queries
  const sportFilter = useMemo((): Record<string, unknown> | null => {
    if (sport === 'vb') return { kscw_team: { sport: { _eq: 'volleyball' } } }
    if (sport === 'bb') return { kscw_team: { sport: { _eq: 'basketball' } } }
    return null
  }, [sport])

  // Build game filter/sort based on active tab
  const gameQuery = useMemo(() => {
    if (activeTab === 'rankings' || activeTab === 'scoreboard') return null

    // Exclude incomplete games (no date, time, or opponent)
    const conditions: Record<string, unknown>[] = [
      { date: { _nnull: true } },
      { time: { _nnull: true } },
      { away_team: { _nnull: true } },
    ]
    switch (activeTab) {
      case 'upcoming':
        conditions.push({ status: { _eq: 'scheduled' } }, { date: { _gte: today } })
        break
      case 'results':
        conditions.push({ status: { _in: ['completed', 'live'] } })
        break
    }
    if (teamFilter) conditions.push(teamFilter)
    if (sportFilter) conditions.push(sportFilter)

    return {
      filter: conditions.length === 1 ? conditions[0] : { _and: conditions },
      sort: activeTab === 'upcoming' ? 'date,time' : '-date,-time',
    }
  }, [activeTab, teamFilter, sportFilter, today])

  const perPage = showAll ? 500 : INITIAL_LIMIT

  const { data: gamesRaw, isLoading: gamesLoading } = useCollection<Game>(
    'games',
    gameQuery && !teamsLoading
      ? { filter: gameQuery.filter, sort: gameQuery.sort.split(','), limit: perPage, fields: ['*', 'kscw_team.*', 'hall.*'] }
      : { filter: { id: { _eq: -1 } }, limit: 1 },
  )
  const games = gamesRaw ?? []

  // Batch-fetch ALL participations for visible games in ONE request
  const gameIds = useMemo(() => games.map((g) => g.id), [games])
  const participationFilter = useMemo((): Record<string, unknown> | string => {
    if (gameIds.length === 0) return ''
    return { _and: [{ activity_type: { _eq: 'game' } }, { activity_id: { _in: gameIds } }] }
  }, [gameIds])

  const { data: allParticipationsRaw, refetch: refetchParticipations } = useCollection<Participation>('participations', {
    filter: participationFilter as Record<string, unknown> | undefined,
    fields: ['id', 'activity_id', 'activity_type', 'member', 'status', 'note', 'session_id', 'guest_count', 'is_staff', 'waitlisted_at', 'date_created', 'date_updated'],
    all: true,
    enabled: gameIds.length > 0,
  })
  const allParticipations = allParticipationsRaw ?? []

  useRealtime('participations', () => refetchParticipations())

  // Build maps: gameId → participations[], gameId → user's participation
  const { participationsByGame, myParticipationByGame, warningsByGame } = useMemo(() => {
    const byGame = new Map<string, Participation[]>()
    const myByGame = new Map<string, Participation>()
    for (const p of allParticipations) {
      const list = byGame.get(p.activity_id) ?? []
      list.push(p)
      byGame.set(p.activity_id, list)
      if (user && p.member === user.id) {
        myByGame.set(p.activity_id, p)
      }
    }
    // Compute warnings per game
    const warnsByGame = new Map<string, Warning[]>()
    for (const g of games) {
      const kscwTeamObj = (g as any).kscw_team
      const sport = (kscwTeamObj != null && typeof kscwTeamObj === 'object' ? kscwTeamObj.sport : undefined) as 'volleyball' | 'basketball' | undefined
      if (!sport) continue
      const parts = (byGame.get(g.id) ?? []) as ParticipationWithMember[]
      const warnings = getGameWarnings(parts, sport, g.min_participants || undefined)
      if (warnings.length > 0) warnsByGame.set(g.id, warnings)
    }
    return { participationsByGame: byGame, myParticipationByGame: myByGame, warningsByGame: warnsByGame }
  }, [allParticipations, user, games])

  // Rankings — always fetch (small dataset), group client-side
  const { data: allRankingsRaw, isLoading: rankingsLoading } = useCollection<Ranking>('rankings', {
    sort: ['league', 'rank'],
    fields: ['id', 'league', 'rank', 'team_id', 'team_name', 'points', 'wins', 'losses', 'wins_clear', 'wins_narrow', 'defeats_clear', 'defeats_narrow', 'sets_won', 'sets_lost', 'points_for', 'points_against', 'games_played', 'season'],
    limit: 2000,
  })
  const allRankings = allRankingsRaw ?? []

  const leagueGroups = useMemo(() => {
    const grouped = new Map<string, Ranking[]>()
    for (const r of allRankings) {
      // Skip cup/tournament/match-group leagues — not regular season standings
      if (/^Group \d+$|Cup|Turnier|Pokal|Final|Runde \d|Spiel \d|Tour \d/i.test(r.league)) continue

      // Sport filter: bb_ prefix = basketball, vb_ = volleyball
      if (!r.team_id) continue
      const isBbRanking = r.team_id.startsWith('bb_')
      if (sport === 'vb' && isBbRanking) continue
      if (sport === 'bb' && !isBbRanking) continue

      const existing = grouped.get(r.league) ?? []
      existing.push(r)
      grouped.set(r.league, existing)
    }

    // For basketball: only show leagues that contain at least one KSCW team
    if (sport === 'bb' || sport === 'all') {
      for (const [league, rows] of grouped) {
        const isBbLeague = rows.some((r) => r.team_id.startsWith('bb_'))
        if (isBbLeague && !rows.some((r) => teamIds[r.team_id])) {
          grouped.delete(league)
        }
      }
    }

    if (effectiveTeams.length === 0) return grouped

    // Filter to leagues containing a selected team
    const selectedSvIds = new Set(
      effectiveTeams.flatMap((t) =>
        Object.entries(teamIds)
          .filter(([, code]) => code.replace(/-\d+$/, '') === t)
          .map(([id]) => id),
      ),
    )

    const filtered = new Map<string, Ranking[]>()
    for (const [league, rows] of grouped) {
      if (rows.some((r) => selectedSvIds.has(r.team_id))) {
        filtered.set(league, rows)
      }
    }
    return filtered
  }, [allRankings, effectiveTeams, sport])

  const isLoading = (activeTab === 'rankings' || activeTab === 'scoreboard') ? rankingsLoading : gamesLoading
  const showGames = activeTab !== 'rankings' && activeTab !== 'scoreboard' && !isLoading

  return (
    <div className="min-w-0">
      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-gray-100">{t('title')}</h1>

      <div className="mt-6 space-y-4">
        {showSportToggle && (
          <div className="flex items-center gap-4">
            <SportToggle value={sport} onChange={setSport} />
          </div>
        )}
        <TeamFilterBar selected={selectedTeams} onChange={setSelectedTeams} sport={sport} limitToTeams={effectiveIsAdmin || !user ? undefined : allUserTeamNames} />
        <GameTabs activeTab={activeTab} onChange={(tab) => { setActiveTab(tab); setShowAll(false) }} />
      </div>

      <div className="mt-6">
        {isLoading && <LoadingSpinner />}

        {/* Upcoming: card grid */}
        {showGames && activeTab === 'upcoming' && (
          <>
            {games.length === 0 ? (
              <EmptyState tab={activeTab} />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {games.map((g) => (
                    <GameCard key={g.id} game={g} onClick={setSelectedGame} participations={participationsByGame.get(g.id)} myParticipation={myParticipationByGame.get(g.id)} warnings={warningsByGame.get(g.id)} onParticipationSaved={refetchParticipations} />
                  ))}
                </div>
                {!showAll && games.length >= INITIAL_LIMIT && (
                  <button
                    onClick={() => setShowAll(true)}
                    className="mt-4 w-full cursor-pointer rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                  >
                    {t('showMore')}
                  </button>
                )}
              </>
            )}
          </>
        )}

        {/* Results: compact list */}
        {showGames && activeTab === 'results' && (
          <>
            {games.length === 0 ? (
              <EmptyState tab={activeTab} />
            ) : (
              <>
                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white md:mx-auto md:w-fit dark:bg-gray-800 md:grid md:grid-cols-[auto_auto_auto_auto_auto_auto_auto_1fr]">
                  {games.map((g) => (
                    <GameCard key={g.id} game={g} onClick={setSelectedGame} variant="compact" participations={participationsByGame.get(g.id)} myParticipation={myParticipationByGame.get(g.id)} warnings={warningsByGame.get(g.id)} />
                  ))}
                </div>
                {!showAll && games.length >= INITIAL_LIMIT && (
                  <button
                    onClick={() => setShowAll(true)}
                    className="mt-4 w-full cursor-pointer rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                  >
                    {t('showMore')}
                  </button>
                )}
              </>
            )}
          </>
        )}

        {/* Rankings */}
        {activeTab === 'rankings' && !rankingsLoading && (
          <>
            {leagueGroups.size === 0 ? (
              <EmptyState tab="rankings" />
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {[...leagueGroups.entries()].map(([league, rows]) => (
                  <RankingsTable key={league} league={league} rankings={rows} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Scoreboard */}
        {activeTab === 'scoreboard' && !rankingsLoading && (
          <KscwScoreboard rankings={allRankings} />
        )}
      </div>

      <GameDetailModal game={selectedGame} onClose={() => setSelectedGame(null)} />
    </div>
  )
}

const tabIcons: Record<string, React.ReactNode> = {
  upcoming: <Calendar className="h-10 w-10" />,
  results: <Trophy className="h-10 w-10" />,
  rankings: <BarChart3 className="h-10 w-10" />,
  scoreboard: <LayoutGrid className="h-10 w-10" />,
}

function EmptyState({ tab }: { tab: string }) {
  const { t } = useTranslation('games')

  const messages: Record<string, string> = {
    upcoming: t('noUpcoming'),
    results: t('noResults'),
    rankings: t('noRankings'),
    scoreboard: t('noScoreboard'),
  }

  return (
    <SharedEmptyState
      icon={tabIcons[tab]}
      title={messages[tab] ?? t('common:noData')}
      description={t('common:tryAdjustingFilter')}
    />
  )
}
