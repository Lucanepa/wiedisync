import { useMemo } from 'react'
import { usePB } from '../../../hooks/usePB'
import type { Game, Training, Event, HallClosure, HallEvent, Team } from '../../../types'
import type { CalendarEntry, CalendarFilterState } from '../../../types/calendar'
import {
  parseDate,
  toDateKey,
  eachDayOfInterval,
} from '../../../utils/dateUtils'
import { format, isBefore, isAfter, isSameDay } from 'date-fns'
import { formatTime } from '../../../utils/dateHelpers'

interface UseCalendarDataOptions {
  filters: CalendarFilterState
  /** Visible range start (inclusive) */
  rangeStart: Date
  /** Visible range end (inclusive) */
  rangeEnd: Date
  enabled?: boolean
}

/**
 * Compute a wide fetch range based on the visible range.
 * Rounds to quarter boundaries for stable caching.
 */
function useFetchRange(rangeStart: Date) {
  return useMemo(() => {
    const m = rangeStart.getMonth()
    const y = rangeStart.getFullYear()
    const quarterStart = Math.floor(m / 4) * 4
    const fetchStart = new Date(y, quarterStart - 1, 1)
    const fetchEnd = new Date(y, quarterStart + 5, 0)
    return {
      start: format(fetchStart, 'yyyy-MM-dd'),
      end: format(fetchEnd, 'yyyy-MM-dd'),
    }
  }, [rangeStart])
}

function buildDateFilter(field: string, rangeStart: string, rangeEnd: string): string {
  return `${field} >= "${rangeStart}" && ${field} <= "${rangeEnd}"`
}

function addTeamFilter(base: string, teamIds: string[], field: string): string {
  if (teamIds.length === 0) return base
  const clauses = teamIds.map((id) => `${field} = "${id}"`).join(' || ')
  return `${base} && (${clauses})`
}

function gameToEntry(game: Game): CalendarEntry {
  const expandedTeam = (game.expand as { kscw_team?: Team })?.kscw_team
  const expandedHall = (game.expand as { hall?: { name: string } })?.hall

  return {
    id: game.id,
    type: 'game',
    title: `${game.home_team} - ${game.away_team}`,
    date: parseDate(game.date),
    startTime: game.time ? formatTime(game.time) : null,
    endTime: null,
    allDay: false,
    location: expandedHall?.name ?? game.away_hall_json?.name ?? '',
    teamNames: expandedTeam ? [expandedTeam.name] : [],
    description: [game.league, game.round].filter(Boolean).join(' | '),
    source: game,
    gameType: game.type,
    sport: expandedTeam?.sport ?? (game.source === 'basketplan' ? 'basketball' : 'volleyball'),
  }
}

function trainingToEntry(training: Training): CalendarEntry {
  const expandedTeam = (training.expand as { team?: Team })?.team
  const expandedHall = (training.expand as { hall?: { name: string } })?.hall

  return {
    id: training.id,
    type: 'training',
    title: `Training ${expandedTeam?.name ?? ''}`,
    date: parseDate(training.date),
    startTime: training.start_time || null,
    endTime: training.end_time || null,
    allDay: false,
    location: expandedHall?.name ?? '',
    teamNames: expandedTeam ? [expandedTeam.name] : [],
    description: training.cancelled
      ? `Abgesagt: ${training.cancel_reason ?? ''}`
      : training.notes ?? '',
    source: training,
  }
}

function eventToEntry(event: Event): CalendarEntry {
  const startDate = parseDate(event.start_date)
  const endDate = event.end_date ? parseDate(event.end_date) : undefined
  // Multi-day if end_date is a different day from start_date
  const isMultiDay = endDate && !isSameDay(startDate, endDate)

  return {
    id: event.id,
    type: 'event',
    title: event.title,
    date: startDate,
    endDate: isMultiDay ? endDate : undefined,
    startTime: event.all_day ? null : event.start_date.split(' ')[1]?.slice(0, 5) ?? null,
    endTime: event.all_day ? null : event.end_date?.split(' ')[1]?.slice(0, 5) ?? null,
    allDay: event.all_day || !!isMultiDay,
    location: event.location ?? '',
    teamNames: [],
    description: event.description ?? '',
    source: event,
  }
}

function closureToEntry(closure: HallClosure): CalendarEntry {
  const expandedHall = (closure.expand as { hall?: { name: string } })?.hall
  const hallName = expandedHall?.name ?? ''
  const start = parseDate(closure.start_date)
  const end = parseDate(closure.end_date)
  const isMultiDay = !isSameDay(start, end)

  return {
    id: closure.id,
    type: 'closure',
    title: closure.reason || `Hall closure: ${hallName}`,
    date: start,
    endDate: isMultiDay ? end : undefined,
    startTime: null,
    endTime: null,
    allDay: true,
    location: hallName,
    teamNames: [],
    description: hallName,
    source: closure,
  }
}

/** Detect hall events that are actually closures (e.g. "Halle geschlossen") */
const CLOSURE_PATTERN = /geschlossen|gesperrt|closed/i

/** Hall events matching this pattern are basketball games from GCal */
const BB_GAME_PATTERN = /^BB\s/i

function hallEventToEntry(he: HallEvent): CalendarEntry {
  const isClosure = CLOSURE_PATTERN.test(he.title)
  return {
    id: he.id,
    type: isClosure ? 'closure' : 'hall',
    title: he.title,
    date: parseDate(he.date),
    startTime: he.start_time || null,
    endTime: he.end_time || null,
    allDay: he.all_day,
    location: he.location ?? '',
    teamNames: [],
    description: '',
    source: he,
  }
}

/** Check if an entry overlaps with a date range */
function entryOverlapsRange(entry: CalendarEntry, rangeStart: Date, rangeEnd: Date): boolean {
  const entryEnd = entry.endDate ?? entry.date
  return !isAfter(entry.date, rangeEnd) && !isBefore(entryEnd, rangeStart)
}

export function useCalendarData({ filters, rangeStart, rangeEnd, enabled = true }: UseCalendarDataOptions) {
  const fetchRange = useFetchRange(rangeStart)

  const wantHome = filters.sources.includes('game-home')
  const wantAway = filters.sources.includes('game-away')
  const fetchGames = enabled && (wantHome || wantAway)
  const fetchTrainings = enabled && filters.sources.includes('training')
  const fetchClosures = enabled && filters.sources.includes('closure')
  const fetchEvents = enabled && filters.sources.includes('event')
  const fetchHallEvents = enabled && filters.sources.includes('hall')

  const { data: games, isLoading: gamesLoading } = usePB<Game>('games', {
    enabled: fetchGames,
    filter: addTeamFilter(
      buildDateFilter('date', fetchRange.start, fetchRange.end),
      filters.selectedTeamIds,
      'kscw_team',
    ),
    expand: 'kscw_team,hall',
    sort: 'date,time',
    all: true,
  })

  const { data: trainings, isLoading: trainingsLoading } = usePB<Training>('trainings', {
    enabled: fetchTrainings,
    filter: addTeamFilter(
      buildDateFilter('date', fetchRange.start, fetchRange.end),
      filters.selectedTeamIds,
      'team',
    ),
    expand: 'team,hall',
    sort: 'date,start_time',
    all: true,
  })

  // Always fetch closures when hall events are fetched (needed to suppress duplicate GCal closures)
  const { data: closuresRaw, isLoading: closuresLoading } = usePB<HallClosure>('hall_closures', {
    enabled: fetchClosures || fetchHallEvents,
    filter: `start_date <= "${fetchRange.end}" && end_date >= "${fetchRange.start}"`,
    expand: 'hall',
    all: true,
  })

  const { data: events, isLoading: eventsLoading } = usePB<Event>('events', {
    enabled: fetchEvents,
    filter: buildDateFilter('start_date', fetchRange.start, fetchRange.end),
    sort: 'start_date',
    all: true,
  })

  const { data: hallEvents, isLoading: hallEventsLoading } = usePB<HallEvent>('hall_events', {
    enabled: fetchHallEvents,
    filter: buildDateFilter('date', fetchRange.start, fetchRange.end),
    sort: 'date,start_time',
    all: true,
  })

  const entries = useMemo(() => {
    const all: CalendarEntry[] = []

    if (fetchGames) {
      for (const g of games) {
        const entry = gameToEntry(g)
        if (wantHome && wantAway) {
          all.push(entry)
        } else if (wantHome && entry.gameType === 'home') {
          all.push(entry)
        } else if (wantAway && entry.gameType === 'away') {
          all.push(entry)
        }
      }
    }
    if (fetchTrainings) all.push(...trainings.map(trainingToEntry))
    if (fetchEvents) all.push(...events.map(eventToEntry))
    // Always compute closure-covered dates from hall_closures (even if not displayed)
    // so GCal "Halle geschlossen" entries can be suppressed when a named closure exists
    const closureSeen = new Set<string>()
    const closureCoveredDates = new Set<string>()
    for (const closure of closuresRaw) {
      const ce = closureToEntry(closure)
      const endDate = ce.endDate ?? ce.date
      for (const d of eachDayOfInterval(ce.date, endDate)) {
        closureCoveredDates.add(toDateKey(d))
      }
      if (fetchClosures) {
        const dedupeKey = `${ce.title}|${toDateKey(ce.date)}|${ce.endDate ? toDateKey(ce.endDate) : ''}`
        if (!closureSeen.has(dedupeKey)) {
          closureSeen.add(dedupeKey)
          all.push(ce)
        }
      }
    }
    if (fetchHallEvents) {
      // Build a set of basketplan game date-time keys for BB GCal dedup
      const bpGameDateKeys = new Set(
        games
          .filter((g) => g.source === 'basketplan')
          .map((g) => `${g.date?.slice(0, 10)}-${g.time ? formatTime(g.time) : ''}`),
      )

      for (const he of hallEvents) {
        const entry = hallEventToEntry(he)
        if (entry.type === 'closure') {
          // Skip GCal closure events when a hall_closures record covers that date
          if (closureCoveredDates.has(toDateKey(entry.date))) continue
          // Deduplicate remaining GCal closure entries (same title + date)
          const dedupeKey = `${entry.title}|${toDateKey(entry.date)}|${entry.endDate ? toDateKey(entry.endDate) : ''}`
          if (!closureSeen.has(dedupeKey)) {
            closureSeen.add(dedupeKey)
            all.push(entry)
          }
        } else {
          // Skip BB GCal events when a basketplan game already covers that slot
          if (BB_GAME_PATTERN.test(he.title) && bpGameDateKeys.size > 0) {
            const heKey = `${he.date?.slice(0, 10)}-${he.start_time?.slice(0, 5)}`
            if (bpGameDateKeys.has(heKey)) continue
          }
          all.push(entry)
        }
      }
    }

    // Filter to visible range
    const filtered = all.filter((entry) => entryOverlapsRange(entry, rangeStart, rangeEnd))

    filtered.sort((a, b) => {
      const dateCmp = toDateKey(a.date).localeCompare(toDateKey(b.date))
      if (dateCmp !== 0) return dateCmp
      if (a.allDay && !b.allDay) return -1
      if (!a.allDay && b.allDay) return 1
      return (a.startTime ?? '').localeCompare(b.startTime ?? '')
    })

    return filtered
  }, [games, trainings, events, closuresRaw, hallEvents, fetchGames, fetchTrainings, fetchEvents, fetchClosures, fetchHallEvents, wantHome, wantAway, rangeStart, rangeEnd])

  const closedDates = useMemo(() => {
    const dates = new Set<string>()
    for (const closure of closuresRaw) {
      const start = parseDate(closure.start_date)
      const end = parseDate(closure.end_date)
      for (const day of eachDayOfInterval(start, end)) {
        dates.add(toDateKey(day))
      }
    }
    // Also include hall events detected as closures
    for (const he of hallEvents) {
      if (CLOSURE_PATTERN.test(he.title)) {
        dates.add(toDateKey(parseDate(he.date)))
      }
    }
    return dates
  }, [closuresRaw, hallEvents])

  return {
    entries,
    closedDates,
    isLoading: gamesLoading || trainingsLoading || closuresLoading || eventsLoading || hallEventsLoading,
    error: null,
  }
}
