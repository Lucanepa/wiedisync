import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useSportPreference } from '../../hooks/useSportPreference'
import type { Game, SvRanking } from '../../types'
import { usePB } from '../../hooks/usePB'
import { svTeamIds } from '../../utils/teamColors'
import SportToggle from '../../components/SportToggle'
import TeamFilterBar from './components/TeamFilterBar'
import GameTabs from './components/GameTabs'
import type { TabKey } from './components/GameTabs'
import GameCard from './components/GameCard'
import RankingsTable from './components/RankingsTable'
import GameDetailModal from './components/GameDetailModal'
import LoadingSpinner from '../../components/LoadingSpinner'

function buildTeamFilter(teams: string[]): string {
  if (teams.length === 0) return ''
  // Match team code in home_team or away_team (e.g. "KSC Wiedikon H1", "KSC Wiedikon DU23-1")
  const clauses = teams.map(
    (t) => `(home_team ~ "Wiedikon ${t}" || away_team ~ "Wiedikon ${t}")`,
  )
  return `(${clauses.join(' || ')})`
}

export default function GamesPage() {
  const { t } = useTranslation('games')
  const { user, memberTeamNames, primarySport } = useAuth()
  const { sport, setSport } = useSportPreference()
  const showSportToggle = !user || primarySport === 'both'
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

  const INITIAL_LIMIT = 20

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])
  const teamFilter = buildTeamFilter(selectedTeams)

  // Sport filter clause for PB queries
  const sportFilter = useMemo(() => {
    if (sport === 'vb') return 'kscw_team.sport = "volleyball"'
    if (sport === 'bb') return 'kscw_team.sport = "basketball"'
    return ''
  }, [sport])

  // Build game filter/sort based on active tab
  const gameQuery = useMemo(() => {
    if (activeTab === 'rankings') return null

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
      ? { filter: gameQuery.filter, sort: gameQuery.sort, expand: 'kscw_team,hall,scorer_member,taefeler_member,scorer_taefeler_member,scorer_duty_team,taefeler_duty_team,scorer_taefeler_duty_team', perPage }
      : { filter: 'id = ""', perPage: 1 },
  )

  // Rankings — always fetch (small dataset), group client-side
  const { data: allRankings, isLoading: rankingsLoading } = usePB<SvRanking>('sv_rankings', {
    sort: '+league,+rank',
    perPage: 200,
  })

  const leagueGroups = useMemo(() => {
    const grouped = new Map<string, SvRanking[]>()
    for (const r of allRankings) {
      // Skip individual match groups (e.g. "Group 28007") — not real league standings
      if (/^Group \d+$/.test(r.league)) continue
      const existing = grouped.get(r.league) ?? []
      existing.push(r)
      grouped.set(r.league, existing)
    }

    if (selectedTeams.length === 0) return grouped

    // Filter to leagues containing a selected team
    const selectedSvIds = new Set(
      selectedTeams.flatMap((t) =>
        Object.entries(svTeamIds)
          .filter(([, code]) => code.replace(/-\d+$/, '') === t)
          .map(([id]) => id),
      ),
    )

    const filtered = new Map<string, SvRanking[]>()
    for (const [league, rows] of grouped) {
      if (rows.some((r) => selectedSvIds.has(r.sv_team_id))) {
        filtered.set(league, rows)
      }
    }
    return filtered
  }, [allRankings, selectedTeams])

  const isLoading = activeTab === 'rankings' ? rankingsLoading : gamesLoading
  const showGames = activeTab !== 'rankings' && !isLoading

  return (
    <div className="min-w-0">
      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-gray-100">{t('title')}</h1>

      <div className="mt-6 space-y-4">
        {showSportToggle && (
          <div className="flex items-center gap-4">
            <SportToggle value={sport} onChange={setSport} />
          </div>
        )}
        <TeamFilterBar selected={selectedTeams} onChange={setSelectedTeams} sport={sport} />
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
                    <GameCard key={g.id} game={g} onClick={setSelectedGame} />
                  ))}
                </div>
                {!showAll && games.length >= INITIAL_LIMIT && (
                  <button
                    onClick={() => setShowAll(true)}
                    className="mt-4 w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
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
                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  {games.map((g) => (
                    <GameCard key={g.id} game={g} onClick={setSelectedGame} variant="compact" />
                  ))}
                </div>
                {!showAll && games.length >= INITIAL_LIMIT && (
                  <button
                    onClick={() => setShowAll(true)}
                    className="mt-4 w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
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
            {sport === 'bb' ? (
              <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                <p>{t('noRankingsBB')}</p>
              </div>
            ) : leagueGroups.size === 0 ? (
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
      </div>

      <GameDetailModal game={selectedGame} onClose={() => setSelectedGame(null)} />
    </div>
  )
}

function EmptyState({ tab }: { tab: string }) {
  const { t } = useTranslation('games')

  const messages: Record<string, string> = {
    upcoming: t('noUpcoming'),
    results: t('noResults'),
    rankings: t('noRankings'),
  }

  return (
    <div className="py-12 text-center text-gray-500 dark:text-gray-400">
      <p>{messages[tab] ?? t('common:noData')}</p>
      <p className="mt-1 text-sm">{t('common:tryAdjustingFilter')}</p>
    </div>
  )
}
