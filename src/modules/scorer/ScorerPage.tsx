import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Game, Member, Team, MemberTeam } from '../../types'
import { usePB } from '../../hooks/usePB'
import { useRealtime } from '../../hooks/useRealtime'
import { useAuth } from '../../hooks/useAuth'
import { useAdminMode } from '../../hooks/useAdminMode'
import pb from '../../pb'
import { logActivity } from '../../utils/logActivity'
import Button from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import TeamSelect from '../../components/TeamSelect'
import SportToggle from '../../components/SportToggle'
import type { SportView } from '../../hooks/useSportPreference'
import ScorerRow, { hasAnyVbAssignment, hasAnyBbAssignment } from './components/ScorerRow'
import TeamOverview from './components/TeamOverview'
import LoadingSpinner from '../../components/LoadingSpinner'
import { ChevronDown, ChevronUp, Filter, Upload } from 'lucide-react'
import BbScorerImportPanel from './components/BbScorerImportPanel'

type Tab = 'games' | 'overview'
type SportTab = 'volleyball' | 'basketball'
type VbDutyTypeFilter = 'all' | 'scorer' | 'taefeler' | 'scorer_taefeler'
type VbUnassignedFilter = 'all' | 'scorer' | 'taefeler' | 'scorer_taefeler' | 'any'
type BbUnassignedFilter = 'all' | 'bb_anschreiber' | 'bb_zeitnehmer' | 'bb_24s_official' | 'any'

const VB_EXPAND =
  'kscw_team,hall,scorer_member,taefeler_member,scorer_taefeler_member,scorer_duty_team,taefeler_duty_team,scorer_taefeler_duty_team'
const BB_EXPAND =
  'kscw_team,hall,bb_anschreiber,bb_zeitnehmer,bb_24s_official,bb_duty_team'
const EXPAND_FIELDS = `${VB_EXPAND},${BB_EXPAND}`

const PAST_PAGE_SIZE = 5

export default function ScorerPage() {
  const { t } = useTranslation('scorer')
  const { user, isSuperAdmin, isCoach, hasAdminAccessToSport } = useAuth()
  const { effectiveIsAdmin } = useAdminMode()

  const [tab, setTab] = useState<Tab>('games')
  const [sportTab, setSportTab] = useState<SportTab>('volleyball')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [showImport, setShowImport] = useState(false)

  // Filters
  const [dateFilter, setDateFilter] = useState('')
  const [dutyTeamFilter, setDutyTeamFilter] = useState('')
  const [dutyTypeFilter, setDutyTypeFilter] = useState<VbDutyTypeFilter>('all')
  const [unassignedFilter, setUnassignedFilter] = useState<VbUnassignedFilter | BbUnassignedFilter>('all')
  const [searchAssignee, setSearchAssignee] = useState('')

  // Past games
  const [showPast, setShowPast] = useState(false)
  const [pastVisible, setPastVisible] = useState(PAST_PAGE_SIZE)
  const canEdit = (effectiveIsAdmin && hasAdminAccessToSport(sportTab)) || isCoach
  const showContact = (effectiveIsAdmin && hasAdminAccessToSport(sportTab)) || isCoach || isSuperAdmin

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  // Upcoming home games (all, filter client-side)
  const {
    data: upcomingGames,
    isLoading: gamesLoading,
    refetch,
  } = usePB<Game>('games', {
    filter: `type = "home" && date >= "${today}" && status != "completed" && status != "postponed"`,
    sort: '+date,+time',
    expand: EXPAND_FIELDS,
    perPage: 200,
  })

  // Past home games
  const { data: allPastGames, isLoading: pastLoading, total: pastTotal } = usePB<Game>('games', {
    filter: `type = "home" && date < "${today}"`,
    sort: '-date,-time',
    expand: EXPAND_FIELDS,
    perPage: 200,
    enabled: showPast,
  })

  const { data: members } = usePB<Member>('members', {
    filter: 'active = true',
    sort: '+last_name,+first_name',
    perPage: 500,
    fields: 'id,name,first_name,last_name,licences,active,phone,email',
  })

  const { data: teams } = usePB<Team>('teams', {
    filter: 'active = true',
    sort: '+name',
    perPage: 50,
  })

  // All member-team relationships (for filtering persons by team)
  const { data: allMemberTeams } = usePB<MemberTeam>('member_teams', {
    perPage: 500,
  })
  const teamMemberIds = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const mt of allMemberTeams) {
      if (!map.has(mt.team)) map.set(mt.team, new Set())
      map.get(mt.team)!.add(mt.member)
    }
    return map
  }, [allMemberTeams])

  // User's team memberships (for self-assign)
  const userTeamIds = useMemo(() => {
    if (!user) return []
    const ids: string[] = []
    for (const mt of allMemberTeams) {
      if (mt.member === user.id) ids.push(mt.team)
    }
    return ids
  }, [allMemberTeams, user])

  // Member lookup for search
  const memberMap = useMemo(() => {
    const map = new Map<string, Member>()
    for (const m of members) map.set(m.id, m)
    return map
  }, [members])

  // Determine sport for each game based on expanded team
  const getGameSport = (g: Game): 'volleyball' | 'basketball' => {
    const expandedTeam = (g as { expand?: { kscw_team?: Team } }).expand?.kscw_team
    return expandedTeam?.sport ?? (g.source === 'basketplan' ? 'basketball' : 'volleyball')
  }

  useRealtime<Game>('games', () => { refetch() }, ['update'])

  // Filter games by sport + client-side filters
  const filteredGames = useMemo(() => {
    return upcomingGames.filter((g) => {
      // Sport filter
      if (getGameSport(g) !== sportTab) return false

      // Date filter
      if (dateFilter && g.date !== dateFilter) return false

      // Duty team filter
      if (dutyTeamFilter) {
        if (sportTab === 'volleyball') {
          const matchesTeam =
            g.scorer_duty_team === dutyTeamFilter ||
            g.taefeler_duty_team === dutyTeamFilter ||
            g.scorer_taefeler_duty_team === dutyTeamFilter
          if (!matchesTeam) return false
        } else {
          if (g.bb_duty_team !== dutyTeamFilter) return false
        }
      }

      // VB-specific duty type filter
      if (sportTab === 'volleyball' && dutyTypeFilter !== 'all') {
        if (dutyTypeFilter === 'scorer_taefeler') {
          if (!g.scorer_taefeler_duty_team && !g.scorer_taefeler_member) return false
        } else if (dutyTypeFilter === 'scorer') {
          if (!g.scorer_duty_team && !g.scorer_member) return false
        } else if (dutyTypeFilter === 'taefeler') {
          if (!g.taefeler_duty_team && !g.taefeler_member) return false
        }
      }

      // Unassigned filter
      if (unassignedFilter !== 'all') {
        if (sportTab === 'volleyball') {
          const vbFilter = unassignedFilter as VbUnassignedFilter
          if (vbFilter === 'any') {
            const hasUnassigned =
              ((g.scorer_duty_team || g.scorer_member) && !g.scorer_member) ||
              ((g.taefeler_duty_team || g.taefeler_member) && !g.taefeler_member) ||
              ((g.scorer_taefeler_duty_team || g.scorer_taefeler_member) && !g.scorer_taefeler_member)
            if (!hasUnassigned && hasAnyVbAssignment(g)) return false
            if (!hasUnassigned && !hasAnyVbAssignment(g)) return true
          } else if (vbFilter === 'scorer') {
            if (g.scorer_member) return false
            if (!g.scorer_duty_team) return false
          } else if (vbFilter === 'taefeler') {
            if (g.taefeler_member) return false
            if (!g.taefeler_duty_team) return false
          } else if (vbFilter === 'scorer_taefeler') {
            if (g.scorer_taefeler_member) return false
            if (!g.scorer_taefeler_duty_team) return false
          }
        } else {
          const bbFilter = unassignedFilter as BbUnassignedFilter
          if (bbFilter === 'any') {
            const hasUnassigned =
              (g.bb_duty_team && !g.bb_anschreiber) ||
              (g.bb_duty_team && !g.bb_zeitnehmer)
            if (!hasUnassigned && hasAnyBbAssignment(g)) return false
            if (!hasUnassigned && !hasAnyBbAssignment(g)) return true
          } else if (bbFilter === 'bb_anschreiber') {
            if (g.bb_anschreiber) return false
            if (!g.bb_duty_team) return false
          } else if (bbFilter === 'bb_zeitnehmer') {
            if (g.bb_zeitnehmer) return false
            if (!g.bb_duty_team) return false
          } else if (bbFilter === 'bb_24s_official') {
            if (g.bb_24s_official) return false
            if (!g.bb_duty_team) return false
          }
        }
      }

      // Search assignee
      if (searchAssignee.trim()) {
        const q = searchAssignee.toLowerCase()
        const ids = sportTab === 'volleyball'
          ? [g.scorer_member, g.taefeler_member, g.scorer_taefeler_member].filter(Boolean) as string[]
          : [g.bb_anschreiber, g.bb_zeitnehmer, g.bb_24s_official].filter(Boolean) as string[]
        const matches = ids.some((id) => {
          const m = memberMap.get(id)
          if (!m) return false
          return `${m.first_name} ${m.last_name}`.toLowerCase().includes(q)
        })
        if (!matches) return false
      }

      return true
    })
  }, [upcomingGames, sportTab, dateFilter, dutyTeamFilter, dutyTypeFilter, unassignedFilter, searchAssignee, memberMap])

  // Past games filtered by sport
  const filteredPastGames = useMemo(() => allPastGames.filter((g) => getGameSport(g) === sportTab), [allPastGames, sportTab])
  const visiblePastGames = useMemo(() => filteredPastGames.slice(0, pastVisible), [filteredPastGames, pastVisible])

  const hasActiveFilters = !!(dateFilter || dutyTeamFilter || dutyTypeFilter !== 'all' || unassignedFilter !== 'all' || searchAssignee)

  function clearFilters() {
    setDateFilter('')
    setDutyTeamFilter('')
    setDutyTypeFilter('all')
    setUnassignedFilter('all')
    setSearchAssignee('')
  }

  async function handleUpdate(gameId: string, fields: Partial<Game>) {
    const oldGame = upcomingGames.find((g) => g.id === gameId) || allPastGames.find((g) => g.id === gameId)
    try {
      await pb.collection('games').update(gameId, fields)
      if (user && oldGame) {
        const changes: Record<string, { old: string; new: string }> = {}
        for (const [key, newVal] of Object.entries(fields)) {
          const oldVal = (oldGame as Record<string, unknown>)[key]
          if (oldVal !== newVal) {
            changes[key] = { old: String(oldVal ?? ''), new: String(newVal ?? '') }
          }
        }
        if (Object.keys(changes).length > 0) {
          logActivity('update', 'games', gameId, changes)
        }
      }
      refetch()
    } catch (err) {
      console.error('Failed to update game:', err)
    }
  }

  const filterLabelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400'

  const renderScorerRow = (g: Game) => (
    <ScorerRow
      key={g.id}
      game={g}
      members={members}
      teams={teams}
      teamMemberIds={teamMemberIds}
      onUpdate={handleUpdate}
      canEdit={canEdit}
      showContact={showContact}
      userId={user?.id}
      userTeamIds={userTeamIds}
      userLicences={user?.licences ?? []}
      sport={sportTab}
    />
  )

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 sm:text-2xl">{t('title')}</h1>
      <p className="mt-1 text-gray-600 dark:text-gray-400">{t('subtitle')}</p>

      {/* Sport toggle + Tab bar */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <SportToggle
          value={sportTab === 'volleyball' ? 'vb' : 'bb'}
          onChange={(v: SportView) => {
            setSportTab(v === 'bb' ? 'basketball' : 'volleyball')
            clearFilters()
          }}
          showAll={false}
        />
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
          {(['games', 'overview'] as Tab[]).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === key
                  ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {key === 'games' ? t('tabGames') : t('tabOverview')}
            </button>
          ))}
        </div>
      </div>

      {/* BB Import panel */}
      {sportTab === 'basketball' && canEdit && (
        <div className="mt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowImport(!showImport)}
            className="rounded-full"
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {t('bbImportButton')}
          </Button>
          {showImport && (
            <div className="mt-3">
              <BbScorerImportPanel
                members={members}
                teams={teams}
                memberTeams={allMemberTeams}
                onImportComplete={refetch}
              />
            </div>
          )}
        </div>
      )}

      {tab === 'games' && (
        <>
          {/* Filters */}
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              <span className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                {t('filterDate')}
                {hasActiveFilters && (
                  <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white">!</span>
                )}
              </span>
              {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {filtersOpen && (
              <div className="border-t border-gray-200 p-4 dark:border-gray-700">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Date */}
                  <div>
                    <label htmlFor="scorer-date" className={filterLabelClass}>
                      {t('filterDate')}
                    </label>
                    <Input
                      id="scorer-date"
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                    />
                  </div>

                  {/* Duty Team */}
                  <div>
                    <label htmlFor="scorer-duty-team" className={filterLabelClass}>
                      {t('filterDutyTeam')}
                    </label>
                    <TeamSelect
                      value={dutyTeamFilter}
                      onChange={setDutyTeamFilter}
                      teams={teams}
                      placeholder={t('filterAllTeams')}
                      aria-label={t('filterDutyTeam')}
                    />
                  </div>

                  {/* Duty Type (VB only) */}
                  {sportTab === 'volleyball' && (
                    <div>
                      <label htmlFor="scorer-duty-type" className={filterLabelClass}>
                        {t('filterDutyType')}
                      </label>
                      <Select id="scorer-duty-type" value={dutyTypeFilter} onChange={(e) => setDutyTypeFilter(e.target.value as VbDutyTypeFilter)}>
                        <option value="all">{t('filterAllTypes')}</option>
                        <option value="scorer">{t('scorer')}</option>
                        <option value="taefeler">{t('scoreboard')}</option>
                        <option value="scorer_taefeler">{t('scorerTaefeler')}</option>
                      </Select>
                    </div>
                  )}

                  {/* Unassigned Duty */}
                  <div>
                    <label htmlFor="scorer-unassigned" className={filterLabelClass}>
                      {t('filterUnassigned')}
                    </label>
                    <Select id="scorer-unassigned" value={unassignedFilter} onChange={(e) => setUnassignedFilter(e.target.value as VbUnassignedFilter | BbUnassignedFilter)}>
                      <option value="all">{t('filterAllDuties')}</option>
                      <option value="any">{t('filterAnyUnassigned')}</option>
                      {sportTab === 'volleyball' ? (
                        <>
                          <option value="scorer">{t('scorer')}</option>
                          <option value="taefeler">{t('scoreboard')}</option>
                          <option value="scorer_taefeler">{t('scorerTaefeler')}</option>
                        </>
                      ) : (
                        <>
                          <option value="bb_anschreiber">{t('bbAnschreiber')}</option>
                          <option value="bb_zeitnehmer">{t('bbZeitnehmer')}</option>
                          <option value="bb_24s_official">{t('bb24sOfficial')}</option>
                        </>
                      )}
                    </Select>
                  </div>

                  {/* Search Assignee */}
                  <div>
                    <label htmlFor="scorer-search" className={filterLabelClass}>
                      {t('filterSearchAssignee')}
                    </label>
                    <Input
                      id="scorer-search"
                      type="text"
                      value={searchAssignee}
                      onChange={(e) => setSearchAssignee(e.target.value)}
                      placeholder={t('searchAssigneePlaceholder')}
                    />
                  </div>
                </div>

                {/* Clear filters */}
                {hasActiveFilters && (
                  <div className="mt-3 flex justify-center">
                    <Button variant="secondary" size="sm" onClick={clearFilters} className="rounded-full">
                      {t('clearFilters')}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Upcoming games */}
          <div className="mt-6">
            {gamesLoading && <LoadingSpinner />}

            {!gamesLoading && filteredGames.length === 0 && (
              <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                <p>{t('noGames')}</p>
                <p className="mt-1 text-sm">{t('noGamesDescription')}</p>
              </div>
            )}

            {!gamesLoading && filteredGames.length > 0 && (
              <div className="space-y-3">
                {filteredGames.map(renderScorerRow)}
              </div>
            )}
          </div>

          {/* Past games */}
          <div className="mt-8">
            {!showPast ? (
              <Button
                variant="secondary"
                onClick={() => { setShowPast(true); setPastVisible(PAST_PAGE_SIZE) }}
                className="mx-auto rounded-full"
              >
                {t('showOlderGames', { count: pastTotal || 0 })}
              </Button>
            ) : (
              <div className="mt-4">
                {pastLoading && <LoadingSpinner />}
                {!pastLoading && filteredPastGames.length === 0 && (
                  <p className="py-4 text-center text-sm text-gray-400">{t('noGames')}</p>
                )}
                {!pastLoading && visiblePastGames.length > 0 && (
                  <>
                    <div className="space-y-3 opacity-75">
                      {visiblePastGames.map(renderScorerRow)}
                    </div>
                    {pastVisible < filteredPastGames.length && (
                      <div className="mt-4 flex justify-center">
                        <Button
                          variant="secondary"
                          onClick={() => setPastVisible((v) => v + PAST_PAGE_SIZE)}
                          className="rounded-full"
                        >
                          {t('loadMore')}
                        </Button>
                      </div>
                    )}
                  </>
                )}
                <div className="mt-3 flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPast(false)}
                  >
                    {t('hidePast')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'overview' && (
        <TeamOverview games={upcomingGames} members={members} sport={sportTab} />
      )}

      {!canEdit && (
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">{t('permissionsNotice')}</p>
      )}
    </div>
  )
}
