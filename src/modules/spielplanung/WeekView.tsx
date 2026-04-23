import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Home as HomeIcon, Plane, ChevronLeft, ChevronRight } from 'lucide-react'
import TeamChip from '../../components/TeamChip'
import { cn } from '../../lib/utils'
import { formatDate, isSameDay, toDateKey } from '../../utils/dateUtils'
import { formatTime } from '../../utils/dateHelpers'
import type { CalendarEntry } from '../../types/calendar'
import type { Game } from '../../types'
import { opponentName } from './gameChipUtils'
import {
  getWeekDays,
  getBlockPixelPosition,
  WEEK_START_HOUR,
  WEEK_END_HOUR,
} from './utils/weekView'

const PX_PER_HOUR = 48 // 48px/hour × 8 hours = 384px total rail

interface WeekViewProps {
  entries: CalendarEntry[]
  weekStart: Date
  onWeekChange: (week: Date) => void
  onGameClick?: (game: Game) => void
}

export default function WeekView({
  entries,
  weekStart,
  onWeekChange,
  onGameClick,
}: WeekViewProps) {
  const { t } = useTranslation('spielplanung')
  const days = useMemo(() => getWeekDays(weekStart), [weekStart])
  const today = new Date()

  const gamesByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>()
    for (const entry of entries) {
      if (entry.type !== 'game') continue
      if (!entry.startTime) continue
      const key = toDateKey(entry.date)
      const existing = map.get(key) ?? []
      existing.push(entry)
      map.set(key, existing)
    }
    return map
  }, [entries])

  const rows = Array.from({ length: WEEK_END_HOUR - WEEK_START_HOUR }, (_, i) => WEEK_START_HOUR + i)
  const railHeight = (WEEK_END_HOUR - WEEK_START_HOUR) * PX_PER_HOUR

  function goPrev() {
    const next = new Date(days[0])
    next.setDate(next.getDate() - 7)
    onWeekChange(next)
  }
  function goNext() {
    const next = new Date(days[0])
    next.setDate(next.getDate() + 7)
    onWeekChange(next)
  }
  function goToday() {
    onWeekChange(new Date())
  }

  const rangeLabel = `${formatDate(days[0], 'MMM d')} – ${formatDate(days[6], 'MMM d, yyyy')}`

  return (
    <div className="space-y-3">
      {/* Nav bar */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={goPrev}
          aria-label={t('weekPrev')}
          className="rounded-md border border-gray-300 bg-white p-1.5 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={goToday}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
        >
          {t('weekToday')}
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label={t('weekNext')}
          className="rounded-md border border-gray-300 bg-white p-1.5 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
        <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-200">{rangeLabel}</span>
      </div>

      {/* Week grid */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <div
          className="grid min-w-[700px]"
          style={{ gridTemplateColumns: '50px repeat(7, 1fr)' }}
        >
          {/* Header row */}
          <div className="border-b border-r border-gray-200 bg-muted/30 dark:border-gray-700" />
          {days.map((d) => {
            const isToday = isSameDay(d, today)
            return (
              <div
                key={d.toISOString()}
                className={cn(
                  'border-b border-r border-gray-200 p-2 text-center dark:border-gray-700',
                  isToday && 'bg-accent',
                )}
              >
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {formatDate(d, 'EEE')}
                </div>
                <div className={cn('text-sm font-semibold', isToday && 'text-accent-foreground')}>
                  {formatDate(d, 'd')}
                </div>
              </div>
            )
          })}

          {/* Time rail */}
          <div className="relative border-r border-gray-200 dark:border-gray-700" style={{ height: railHeight }}>
            {rows.map((h, idx) => (
              <div
                key={h}
                className="absolute left-0 right-0 flex -translate-y-2 justify-end pr-1 text-[10px] text-muted-foreground"
                style={{ top: idx * PX_PER_HOUR }}
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Day columns with absolutely positioned blocks */}
          {days.map((d) => {
            const isToday = isSameDay(d, today)
            const dayGames = gamesByDay.get(toDateKey(d)) ?? []
            return (
              <div
                key={d.toISOString()}
                className={cn(
                  'relative border-r border-gray-200 dark:border-gray-700',
                  isToday && 'bg-accent/30',
                )}
                style={{ height: railHeight }}
              >
                {/* Hour gridlines */}
                {rows.map((_h, idx) => (
                  <div
                    key={idx}
                    className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-800"
                    style={{ top: idx * PX_PER_HOUR }}
                  />
                ))}

                {/* Game blocks */}
                {dayGames.map((entry) => {
                  const game = entry.source as Game
                  const pos = getBlockPixelPosition(entry.startTime ?? '', PX_PER_HOUR)
                  if (!pos) return null
                  const isHome = game.type === 'home'
                  const isManual = game.source === 'manual'
                  const teamName = entry.teamNames[0] ?? '?'
                  const opponent = opponentName(game)
                  const time = game.time ? formatTime(game.time) : ''

                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={onGameClick ? () => onGameClick(game) : undefined}
                      aria-label={`${teamName}, ${isHome ? 'home' : 'away'}${time ? `, ${time}` : ''}, ${opponent}`}
                      className={cn(
                        'absolute left-1 right-1 overflow-hidden rounded-sm border-l-[3px] bg-muted/70 px-1.5 py-1 text-left text-[11px] leading-tight transition-colors hover:bg-muted',
                        isHome
                          ? 'border-emerald-500 dark:border-emerald-400'
                          : 'border-blue-500 dark:border-blue-400',
                        isManual && 'outline outline-1 outline-dashed outline-muted-foreground/60 outline-offset-[-1px]',
                      )}
                      style={{ top: pos.top, height: pos.height }}
                    >
                      <div className="flex items-center gap-1">
                        <TeamChip team={teamName} size="xs" className="shrink-0 !px-1 !py-0 !text-[9px]" />
                        {isHome ? (
                          <HomeIcon className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                        ) : (
                          <Plane className="h-3 w-3 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
                        )}
                        {time && <span className="shrink-0 font-semibold text-foreground">{time}</span>}
                      </div>
                      <div className="truncate text-muted-foreground">{opponent}</div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
