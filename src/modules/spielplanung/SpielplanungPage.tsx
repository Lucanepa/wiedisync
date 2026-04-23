import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ViewToggle from '../../components/ViewToggle'
import SpielplanungFilters from './SpielplanungFilters'
import CalendarView from './CalendarView'
import ListView from './ListView'
import GameDetailDrawer from './GameDetailDrawer'
import ManualGameModal from './ManualGameModal'
import { useSpielplanungData } from './hooks/useSpielplanungData'
import { useAvailableSeasons } from './hooks/useAvailableSeasons'
import { useTeams } from '../../hooks/useTeams'
import { useAuth } from '../../hooks/useAuth'
import { startOfMonth, getSeasonYear } from '../../utils/dateUtils'
import { useIsMobile } from '../../hooks/useMediaQuery'
import LoadingSpinner from '../../components/LoadingSpinner'
import type { ViewMode, SpielplanungFilterState } from '../../types/calendar'
import type { Game } from '../../types'
import { TourPageButton } from '../guide/TourPageButton'

function getInitialMonth(): Date {
  const now = new Date()
  const m = now.getMonth()
  if (m >= 8 || m <= 4) return startOfMonth(now)
  return new Date(now.getFullYear(), 8, 1)
}

export default function SpielplanungPage() {
  const { t } = useTranslation('spielplanung')
  const isMobile = useIsMobile()
  const [viewMode, setViewMode] = useState<ViewMode>(() => isMobile ? 'list-date' : 'calendar')
  const [filters, setFilters] = useState<SpielplanungFilterState>({
    sport: 'all',
    selectedTeamIds: [],
    gameType: 'all',
    showAbsences: false,
  })
  const [month, setMonth] = useState<Date>(getInitialMonth)
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [createFor, setCreateFor] = useState<Date | null>(null)

  const { isAdmin, is_spielplaner, spielplanerTeamIds } = useAuth()

  const seasonYear = getSeasonYear(month)
  const seasonStart = `${seasonYear}-09-01`
  const seasonEnd = `${seasonYear + 1}-05-31`

  const { games, entries, closedDates, isLoading, error } = useSpielplanungData({
    filters,
    seasonStart,
    seasonEnd,
  })

  const { data: teams } = useTeams()
  const { seasons } = useAvailableSeasons()

  const filteredEntries = useMemo(() => entries, [entries])

  const editableTeamIds = useMemo(() => {
    if (isAdmin || is_spielplaner) return (teams ?? []).map((t) => String(t.id))
    return spielplanerTeamIds
  }, [isAdmin, is_spielplaner, spielplanerTeamIds, teams])

  const canCreateManualGames = editableTeamIds.length > 0

  const currentSeasonLabel = `${seasonYear}/${seasonYear + 1}`

  // Merge the current season into the dropdown so we always have at least one option,
  // even before the games collection resolves.
  const seasonOptions = useMemo(() => {
    const set = new Set<string>([currentSeasonLabel, ...seasons])
    return [...set].sort().reverse()
  }, [seasons, currentSeasonLabel])

  function handleSeasonChange(nextSeason: string) {
    // Season format: 'YYYY/YYYY'. Set month to Sep of the start year.
    const startYear = parseInt(nextSeason.split('/')[0] ?? '', 10)
    if (Number.isFinite(startYear)) {
      setMonth(new Date(startYear, 8, 1))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-gray-100">{t('title')}</h1>
            <TourPageButton />
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('subtitleSeason', { season: `${seasonYear}/${(seasonYear + 1).toString().slice(2)}` })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={currentSeasonLabel}
            onChange={(e) => handleSeasonChange(e.target.value)}
            aria-label={t('seasonPicker')}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gold-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {seasonOptions.map((s) => (
              <option key={s} value={s} className="dark:bg-gray-800">{s}</option>
            ))}
          </select>
          <div data-tour="view-toggle"><ViewToggle
            options={[
              { value: 'calendar', label: t('viewCalendar') },
              { value: 'list-date', label: t('viewByDate') },
              { value: 'list-team', label: t('viewByTeam') },
            ]}
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
          /></div>
        </div>
      </div>

      {/* Filters */}
      <div data-tour="spielplanung-filters">
        <SpielplanungFilters filters={filters} onChange={setFilters} />
      </div>

      {/* Loading / Error */}
      {isLoading && <LoadingSpinner />}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t('common:errorLoading')} {error.message}
        </div>
      )}

      {/* Views */}
      {!isLoading && !error && (
        <>
          {viewMode === 'calendar' && (
            <CalendarView
              entries={filteredEntries}
              closedDates={closedDates}
              month={month}
              onMonthChange={setMonth}
              onGameClick={setSelectedGame}
              onEmptyDayClick={canCreateManualGames ? setCreateFor : undefined}
            />
          )}
          {viewMode === 'list-date' && (
            <ListView games={games} mode="date" teams={teams} />
          )}
          {viewMode === 'list-team' && (
            <ListView games={games} mode="team" teams={teams} />
          )}
        </>
      )}

      <GameDetailDrawer game={selectedGame} onClose={() => setSelectedGame(null)} />

      <ManualGameModal
        open={!!createFor}
        onClose={() => setCreateFor(null)}
        initialDate={createFor}
        editableTeamIds={editableTeamIds}
      />
    </div>
  )
}
