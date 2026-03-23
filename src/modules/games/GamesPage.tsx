import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useAdminMode } from '../../hooks/useAdminMode'
import { useSportPreference } from '../../hooks/useSportPreference'
import type { Game, Ranking, Team, Participation } from '../../types'
import { usePB } from '../../hooks/usePB'
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
import { Calendar, Trophy, BarChart3, LayoutGrid } from 'lucide-react'

function buildTeamFilter(teamPbIds: string[]): string {
  if (teamPbIds.length === 0) return ''
  const clauses = teamPbIds.map((id) => `kscw_team = "${id}"`)
  return `(${clauses.join(' || ')})`
}

export default function GamesPage() {
  const { t } = useTranslation('games')
  const { user, memberTeamIds, memberTeamNames, primarySport } = useAuth()
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
    if (!autoSelected && memberTeamNames.length > 0) {
      setSelectedTeams(memberTeamNames)
      setAutoSelected(true)
    }
  }, [memberTeamNames, autoSelected])

  // Reset team selection when sport changes (old selections may not match new sport)
  useEffect(() => {
    // Non-admin users: reset to their own teams; admins: show all
    setSelectedTeams(effectiveIsAdmin ? [] : memberTeamNames)
  }, [sport]) // eslint-disable-line react-hooks/exhaustive-deps

  const INITIAL_LIMIT = 20

  // Fetch all KSCW teams to map name → PB id
  const { data: allTeams } = usePB<Team>('teams', { sort: 'name', all: true, fields: 'id,name' })
  const teamNameToId = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of allTeams) map.set(t.name, t.id)
    return map
  }, [allTeams])

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])
  // For non-admins, always scope to their teams (even if filter cleared)
  const effectiveTeams = selectedTeams.length > 0
    ? selectedTeams
    : (!effectiveIsAdmin && memberTeamNames.length > 0 ? memberTeamNames : [])
  // Convert name codes to PB record IDs for the kscw_team filter
  const effectiveTeamIds = effectiveTeams
    .map((name) => teamNameToId.get(name))
    .filter((id): id is string => !!id)
  // For non-admins, also include their memberTeamIds as fallback
  const filterTeamIds = effectiveTeamIds.length > 0
    ? effectiveTeamIds
    : (!effectiveIsAdmin && memberTeamIds.length > 0 ? memberTeamIds : [])
  const teamFilter = buildTeamFilter(filterTeamIds)

  // Sport filter clause for PB queries
  const sportFilter = useMemo(() => {
    if (sport === 'vb') return 'kscw_team.sport = "volleyball"'
    if (sport === 'bb') return 'kscw_team.sport = "basketball"'
    return ''
  }, [sport])

  // Build game filter/sort based on active tab
  const gameQuery = useMemo(() => {
    if (activeTab === 'rankings' || activeTab === 'scoreboard') return null

    const parts: string[] = []
    switch (activeTab) {
      case 'upcoming':
        parts.push(`status = "scheduled"`, `date >= "${today}"`)
        break
      case 'results':
        parts.push(`(status = "completed" || status = "live")`)
        break
    }
    if (teamFilter) parts.push(teamFilter)
    if (sportFilter) parts.push(sportFilter)

    return {
      filter: parts.join(' && '),
      sort: activeTab === 'upcoming' ? '+date,+time' : '-date,-time',
    }
  }, [activeTab, teamFilter, sportFilter, today])

  const perPage = showAll ? 500 : INITIAL_LIMIT

  const { data: games, isLoading: gamesLoading } = usePB<Game>(
    'games',
    gameQuery
      ? { filter: gameQuery.filter, sort: gameQuery.sort, expand: 'kscw_team,hall,scorer_member,scoreboard_member,scorer_scoreboard_member,scorer_duty_team,scoreboard_duty_team,scorer_scoreboard_duty_team,bb_scorer_member,bb_timekeeper_member,bb_24s_official,bb_duty_team,bb_scorer_duty_team,bb_timekeeper_duty_team,bb_24s_duty_team', perPage }
      : { filter: 'id = ""', perPage: 1 },
  )

  // Batch-fetch ALL participations for visible games in ONE request
  const gameIds = useMemo(() => games.map((g) => g.id), [games])
  const participationFilter = useMemo(() => {
    if (gameIds.length === 0) return ''
    const idClauses = gameIds.map((id) => `activity_id="${id}"`).join(' || ')
    return `activity_type="game" && (${idClauses})`
  }, [gameIds])

  const { data: allParticipations, refetch: refetchParticipations } = usePB<Participation>('participations', {
    filter: participationFilter,
    all: true,
    enabled: gameIds.length > 0,
  })

  useRealtime('participations', () => refetchParticipations())

  // Build maps: gameId → participations[], gameId → user's participation
  const { participationsByGame, myParticipationByGame } = useMemo(() => {
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
    return { participationsByGame: byGame, myParticipationByGame: myByGame }
  }, [allParticipations, user])

  // Rankings — always fetch (small dataset), group client-side
  const { data: allRankings, isLoading: rankingsLoading } = usePB<Ranking>('rankings', {
    sort: '+league,+rank',
    perPage: 2000,
  })

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
        <TeamFilterBar selected={selectedTeams} onChange={setSelectedTeams} sport={sport} limitToTeams={effectiveIsAdmin || !user ? undefined : memberTeamNames} />
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
                    <GameCard key={g.id} game={g} onClick={setSelectedGame} participations={participationsByGame.get(g.id)} myParticipation={myParticipationByGame.get(g.id)} />
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
                    <GameCard key={g.id} game={g} onClick={setSelectedGame} variant="compact" participations={participationsByGame.get(g.id)} myParticipation={myParticipationByGame.get(g.id)} />
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
