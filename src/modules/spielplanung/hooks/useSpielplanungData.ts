import { useMemo } from 'react'
import { useCollection } from '../../../lib/query'
import type { Game, HallClosure, Team } from '../../../types'
import type { CalendarEntry, SpielplanungFilterState } from '../../../types/calendar'
import { parseDate, toDateKey, eachDayOfInterval } from '../../../utils/dateUtils'
import { formatTime } from '../../../utils/dateHelpers'

interface UseSpielplanungDataOptions {
  filters: SpielplanungFilterState
  seasonStart: string
  seasonEnd: string
}

function buildGameFilter(
  filters: SpielplanungFilterState,
  seasonStart: string,
  seasonEnd: string,
): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [
    { date: { _gte: seasonStart } },
    { date: { _lte: seasonEnd } },
  ]

  if (filters.sport !== 'all') {
    conditions.push({ 'kscw_team.sport': { _eq: filters.sport } })
  }

  if (filters.selectedTeamIds.length > 0) {
    conditions.push({ kscw_team: { _in: filters.selectedTeamIds } })
  }

  if (filters.gameType !== 'all') {
    conditions.push({ type: { _eq: filters.gameType } })
  }

  return { _and: conditions }
}

function asObj<T>(val: T | string | null | undefined): T | null {
  return val != null && typeof val === 'object' ? val as T : null
}

function gameToCalendarEntry(game: Game): CalendarEntry {
  const expandedTeam = asObj<Team>(game.kscw_team)
  const expandedHall = asObj<{ name: string }>(game.hall)

  return {
    id: game.id,
    type: 'game',
    title: `${game.home_team} - ${game.away_team}`,
    date: parseDate(game.date),
    startTime: game.time ? formatTime(game.time) : null,
    endTime: null,
    allDay: false,
    location: expandedHall?.name ?? '',
    teamNames: expandedTeam ? [expandedTeam.name] : [],
    description: [game.league, game.round].filter(Boolean).join(' | '),
    source: game,
  }
}

export function useSpielplanungData({
  filters,
  seasonStart,
  seasonEnd,
}: UseSpielplanungDataOptions) {
  const gameFilter = buildGameFilter(filters, seasonStart, seasonEnd)

  const {
    data: gamesRaw,
    isLoading: gamesLoading,
    error: gamesError,
  } = useCollection<Game>('games', {
    filter: gameFilter,
    sort: ['date', 'time'],
    all: true,
  })
  const games = gamesRaw ?? []

  const {
    data: closuresRaw,
    isLoading: closuresLoading,
    error: closuresError,
  } = useCollection<HallClosure>('hall_closures', {
    filter: { _and: [{ start_date: { _lte: seasonEnd } }, { end_date: { _gte: seasonStart } }] },
    all: true,
  })
  const closures = closuresRaw ?? []

  const entries = useMemo(() => games.map(gameToCalendarEntry), [games])

  const closedDates = useMemo(() => {
    const dates = new Set<string>()
    for (const closure of closures) {
      const start = parseDate(closure.start_date)
      const end = parseDate(closure.end_date)
      for (const day of eachDayOfInterval(start, end)) {
        dates.add(toDateKey(day))
      }
    }
    return dates
  }, [closures])

  return {
    games,
    entries,
    closures,
    closedDates,
    isLoading: gamesLoading || closuresLoading,
    error: gamesError || closuresError,
  }
}
