import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { CalendarEntry } from '../../../types/calendar'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  isSameMonth,
  isSameDay,
  toDateKey,
  formatDate,
  DAY_HEADERS,
} from '../../../utils/dateUtils'

/* ── colour helpers ──────────────────────────────────────── */

const barColors: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  'game-home': { bg: 'bg-brand-200', text: 'text-brand-900', darkBg: 'dark:bg-brand-800', darkText: 'dark:text-brand-100' },
  'game-away': { bg: 'bg-amber-200', text: 'text-amber-900', darkBg: 'dark:bg-amber-800', darkText: 'dark:text-amber-100' },
  game:        { bg: 'bg-brand-200', text: 'text-brand-900', darkBg: 'dark:bg-brand-800', darkText: 'dark:text-brand-100' },
  training:    { bg: 'bg-green-200', text: 'text-green-900', darkBg: 'dark:bg-green-800', darkText: 'dark:text-green-100' },
  closure:     { bg: 'bg-red-200', text: 'text-red-900', darkBg: 'dark:bg-red-800', darkText: 'dark:text-red-100' },
  event:       { bg: 'bg-purple-200', text: 'text-purple-900', darkBg: 'dark:bg-purple-800', darkText: 'dark:text-purple-100' },
  hall:        { bg: 'bg-cyan-200', text: 'text-cyan-900', darkBg: 'dark:bg-cyan-800', darkText: 'dark:text-cyan-100' },
}

function colorKey(e: CalendarEntry): string {
  if (e.type === 'game' && e.gameType) return `game-${e.gameType}`
  return e.type
}

function barClasses(e: CalendarEntry): string {
  const c = barColors[colorKey(e)] ?? barColors.game
  return `${c.bg} ${c.text} ${c.darkBg} ${c.darkText}`
}

const dotColors: Record<string, string> = {
  'game-home': 'bg-brand-500',
  'game-away': 'bg-amber-500',
  game: 'bg-brand-500',
  training: 'bg-green-500',
  closure: 'bg-red-500',
  event: 'bg-purple-500',
  hall: 'bg-cyan-500',
}

/* ── spanning bar layout algorithm ───────────────────────── */

interface BarSegment {
  entry: CalendarEntry
  lane: number
  startCol: number   // 0-based column within the week-row (0=Mon … 6=Sun)
  span: number       // number of columns to span
  continues: boolean // continues into next week
  continued: boolean // continuation from prev week
}

/**
 * For a given week (array of 7 Dates), compute bar segments for multi-day/all-day events.
 * Returns timed (single-day, non-all-day) entries separately.
 */
function layoutWeek(
  weekDays: Date[],
  entries: CalendarEntry[],
): { bars: BarSegment[]; timedByCol: CalendarEntry[][] } {
  const weekStartKey = toDateKey(weekDays[0])
  const weekEndKey = toDateKey(weekDays[6])

  // Separate multi-day/all-day from timed single-day entries
  const spanning: CalendarEntry[] = []
  const timedByCol: CalendarEntry[][] = Array.from({ length: 7 }, () => [])

  for (const e of entries) {
    const entryEndKey = e.endDate ? toDateKey(e.endDate) : toDateKey(e.date)
    const entryStartKey = toDateKey(e.date)

    // Does this entry touch this week at all?
    if (entryStartKey > weekEndKey || entryEndKey < weekStartKey) continue

    if (e.allDay || e.endDate) {
      spanning.push(e)
    } else {
      // Single-day timed entry → find which column
      const col = weekDays.findIndex((d) => isSameDay(d, e.date))
      if (col >= 0) timedByCol[col].push(e)
    }
  }

  // Sort spanning entries by start date (earlier first), then by length (longer first)
  spanning.sort((a, b) => {
    const cmp = toDateKey(a.date).localeCompare(toDateKey(b.date))
    if (cmp !== 0) return cmp
    const aLen = a.endDate ? toDateKey(a.endDate).localeCompare(toDateKey(a.date)) : 0
    const bLen = b.endDate ? toDateKey(b.endDate).localeCompare(toDateKey(b.date)) : 0
    return bLen - aLen // longer first
  })

  // Assign lanes (greedy)
  const lanes: string[][] = [] // lanes[lane][col] = entryId or empty
  const bars: BarSegment[] = []

  for (const e of spanning) {
    const eStartKey = toDateKey(e.date)
    const eEndKey = e.endDate ? toDateKey(e.endDate) : eStartKey

    // Clamp to this week
    const startCol = eStartKey <= weekStartKey ? 0 : weekDays.findIndex((d) => toDateKey(d) === eStartKey)
    const endCol = eEndKey >= weekEndKey ? 6 : weekDays.findIndex((d) => toDateKey(d) === eEndKey)
    if (startCol < 0 || endCol < 0) continue

    const span = endCol - startCol + 1

    // Find first lane that's free for this range
    let lane = -1
    for (let l = 0; l < lanes.length; l++) {
      let free = true
      for (let c = startCol; c <= endCol; c++) {
        if (lanes[l][c]) { free = false; break }
      }
      if (free) { lane = l; break }
    }
    if (lane === -1) {
      lane = lanes.length
      lanes.push(Array(7).fill(''))
    }

    for (let c = startCol; c <= endCol; c++) {
      lanes[lane][c] = e.id
    }

    bars.push({
      entry: e,
      lane,
      startCol,
      span,
      continues: eEndKey > weekEndKey,
      continued: eStartKey < weekStartKey,
    })
  }

  return { bars, timedByCol }
}

/* ── component ───────────────────────────────────────────── */

interface MonthGridProps {
  entries: CalendarEntry[]
  closedDates: Set<string>
  month: Date
  onMonthChange: (month: Date) => void
  onEntryClick?: (entry: CalendarEntry) => void
  onOverflowClick?: (entries: CalendarEntry[], date: Date) => void
}

export default function MonthGrid({
  entries,
  closedDates,
  month,
  onMonthChange,
  onEntryClick,
  onOverflowClick,
}: MonthGridProps) {
  const { t } = useTranslation()
  const today = new Date()
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = endOfWeek(monthEnd)
  const allDays = eachDayOfInterval(gridStart, gridEnd)

  // Split days into week-rows of 7
  const weekRows = useMemo(() => {
    const rows: Date[][] = []
    for (let i = 0; i < allDays.length; i += 7) {
      rows.push(allDays.slice(i, i + 7))
    }
    return rows
  }, [allDays])

  // Pre-compute layout for each week
  const weekLayouts = useMemo(
    () => weekRows.map((week) => layoutWeek(week, entries)),
    [weekRows, entries],
  )

  const MAX_VISIBLE_BARS = 2
  const MAX_VISIBLE_TIMED = 2

  return (
    <div className="flex flex-1 flex-col">
      {/* Month header */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => onMonthChange(addMonths(month, -1))}
          aria-label={t('prevMonth')}
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {formatDate(month, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => onMonthChange(startOfMonth(new Date()))}
            className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            {t('today')}
          </button>
        </div>
        <button
          onClick={() => onMonthChange(addMonths(month, 1))}
          aria-label={t('nextMonth')}
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="py-1.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
            {d}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="flex flex-1 flex-col border-l border-gray-200 dark:border-gray-700">
        {weekRows.map((week, wi) => {
          const { bars, timedByCol } = weekLayouts[wi]
          const maxLane = bars.length > 0 ? Math.max(...bars.map((b) => b.lane)) + 1 : 0
          const visibleLanes = Math.min(maxLane, MAX_VISIBLE_BARS)

          return (
            <div key={wi} className="flex flex-1 flex-col">
              {/* Spanning bars row */}
              {visibleLanes > 0 && (
                <div className="relative border-r border-gray-200 dark:border-gray-700">
                  {/* Grid for spanning bars */}
                  <div className="grid grid-cols-7">
                    {/* Invisible cells for column structure */}
                    {week.map((_, ci) => (
                      <div key={ci} style={{ height: `${visibleLanes * 20}px` }} />
                    ))}
                  </div>
                  {/* Bars positioned absolutely */}
                  {bars.filter((b) => b.lane < MAX_VISIBLE_BARS).map((bar) => (
                    <button
                      key={`${bar.entry.id}-${wi}`}
                      type="button"
                      onClick={() => onEntryClick?.(bar.entry)}
                      className={`absolute truncate text-[10px] font-medium leading-[18px] transition-opacity hover:opacity-80 lg:text-xs ${barClasses(bar.entry)} ${
                        bar.continued ? 'rounded-l-none' : 'rounded-l'
                      } ${bar.continues ? 'rounded-r-none' : 'rounded-r'}`}
                      style={{
                        top: `${bar.lane * 20}px`,
                        left: `${(bar.startCol / 7) * 100}%`,
                        width: `${(bar.span / 7) * 100}%`,
                        height: '18px',
                        paddingLeft: bar.continued ? '2px' : '4px',
                        paddingRight: '2px',
                      }}
                    >
                      {!bar.continued && bar.entry.title}
                    </button>
                  ))}
                </div>
              )}

              {/* Day cells row */}
              <div className="grid flex-1 grid-cols-7">
                {week.map((date, ci) => {
                  const key = toDateKey(date)
                  const inMonth = isSameMonth(date, month)
                  const isToday = isSameDay(date, today)
                  const isClosed = closedDates.has(key)
                  const timed = timedByCol[ci]
                  const visibleTimed = timed.slice(0, MAX_VISIBLE_TIMED)

                  // Count hidden items (bars beyond maxLane + timed beyond max)
                  const hiddenBars = bars.filter(
                    (b) => b.lane >= MAX_VISIBLE_BARS && ci >= b.startCol && ci < b.startCol + b.span,
                  ).length
                  const hiddenTimed = Math.max(0, timed.length - MAX_VISIBLE_TIMED)
                  const overflow = hiddenBars + hiddenTimed

                  return (
                    <div
                      key={key}
                      className={`relative min-h-[3rem] border-b border-r border-gray-200 p-0.5 sm:min-h-[4rem] lg:min-h-[5rem] lg:p-1 dark:border-gray-700 ${
                        !inMonth
                          ? 'bg-gray-50 dark:bg-gray-900'
                          : isClosed
                            ? 'bg-red-50/40 dark:bg-red-950/20'
                            : 'bg-white dark:bg-gray-800'
                      }`}
                    >
                      {/* Date number */}
                      <div className="mb-0.5 flex items-start">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                            isToday
                              ? 'bg-brand-500 font-bold text-white'
                              : !inMonth
                                ? 'text-gray-300 dark:text-gray-600'
                                : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {date.getDate()}
                        </span>
                      </div>

                      {/* Timed events */}
                      {inMonth && (
                        <div className="space-y-px overflow-hidden">
                          {visibleTimed.map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onEntryClick?.(entry)
                              }}
                              className={`flex w-full items-center gap-0.5 truncate rounded px-0.5 text-left text-[10px] leading-snug transition-opacity hover:opacity-80 lg:text-xs`}
                            >
                              <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dotColors[colorKey(entry)]}`} />
                              <span className="truncate">
                                {entry.startTime && (
                                  <span className="font-medium">{entry.startTime} </span>
                                )}
                                <span className="hidden lg:inline">{entry.title}</span>
                              </span>
                            </button>
                          ))}
                          {overflow > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                // Collect all entries for this day (spanning + timed)
                                const allForDay = entries.filter((en) => {
                                  const enEnd = en.endDate ?? en.date
                                  return toDateKey(en.date) <= key && toDateKey(enEnd) >= key
                                })
                                onOverflowClick?.(allForDay, date)
                              }}
                              className="rounded px-1 text-[10px] font-medium text-gray-500 hover:bg-gray-100 lg:text-xs dark:text-gray-400 dark:hover:bg-gray-700"
                            >
                              +{overflow} more
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
