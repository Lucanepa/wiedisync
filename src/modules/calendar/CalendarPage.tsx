import { useState, useRef, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import ViewToggle from '../../components/ViewToggle'
import Modal from '../../components/Modal'
import CalendarFilters from './CalendarFilters'
import MonthGrid from './components/MonthGrid'
import WeekGrid from './components/WeekGrid'
import MobileMonthView from './components/MobileMonthView'
import MobileWeekGrid from './components/MobileWeekGrid'
import HallenplanView from './HallenplanView'
import CalendarEntryModal from './CalendarEntryModal'
import GameDetailModal from '../games/components/GameDetailModal'
import ICalModal from './ICalModal'
import { useCalendarData } from './hooks/useCalendarData'
import { useAuth } from '../../hooks/useAuth'
import { useIsMobile } from '../../hooks/useMediaQuery'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  formatDate,
} from '../../utils/dateUtils'
import LoadingSpinner from '../../components/LoadingSpinner'
import BasketballIcon from '../../components/BasketballIcon'
import VolleyballIcon from '../../components/VolleyballIcon'
import type { CalendarViewMode, CalendarFilterState, SourceFilter, CalendarEntry } from '../../types/calendar'
import type { Game } from '../../types'

/** Inline type icon for the overflow modal */
const TypeIcon = ({ type, sport, className = '' }: { type: string; sport?: 'volleyball' | 'basketball'; className?: string }) => {
  if (type === 'training') {
    return (
      <svg className={`h-3 w-3 shrink-0 ${className}`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 20h12l-1.5-5H7.5L6 20zM7 13h10l-1.5-5h-7L7 13zM9 6h6l-.75-2.5a1 1 0 00-.96-.72h-2.58a1 1 0 00-.96.72L9 6z" />
      </svg>
    )
  }
  if (type === 'game') {
    return sport === 'basketball'
      ? <BasketballIcon className="h-3 w-3 shrink-0" filled />
      : <VolleyballIcon className="h-3 w-3 shrink-0" filled />
  }
  if (type === 'event') {
    return (
      <svg className={`h-3 w-3 shrink-0 ${className}`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
      </svg>
    )
  }
  if (type === 'closure') {
    return (
      <svg className={`h-3 w-3 shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" d="M15 9l-6 6M9 9l6 6" />
      </svg>
    )
  }
  if (type === 'hall') {
    return <BasketballIcon className="h-3 w-3 shrink-0" filled />
  }
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-current ${className}`} />
}

const iconColors: Record<string, string> = {
  game: 'text-brand-500',
  'game-home': 'text-brand-500',
  'game-away': 'text-amber-500',
  training: 'text-green-500',
  closure: 'text-red-500',
  event: 'text-purple-500',
  hall: 'text-cyan-500',
}

function entryIconColor(entry: CalendarEntry): string {
  if (entry.type === 'game' && entry.gameType) return iconColors[`game-${entry.gameType}`] || 'text-brand-500'
  return iconColors[entry.type] || 'text-gray-500'
}

export default function CalendarPage() {
  const { t } = useTranslation('calendar')
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month')
  const allSources: SourceFilter[] = user
    ? ['game-home', 'game-away', 'training', 'event', 'closure', 'hall']
    : ['game-home', 'game-away', 'hall']

  const [filters, setFilters] = useState<CalendarFilterState>(() => ({
    sources: [...allSources],
    selectedTeamIds: [],
  }))
  // Sync sources when auth state changes (e.g., user logs in → training/event/closure become available)
  const prevUserRef = useRef(user)
  useEffect(() => {
    if (user && !prevUserRef.current) {
      setFilters((f) => ({ ...f, sources: [...allSources] }))
    }
    prevUserRef.current = user
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()))
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [mobileDay, setMobileDay] = useState<Date>(() => new Date())
  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null)
  const [dayOverflow, setDayOverflow] = useState<{ entries: CalendarEntry[]; date: Date } | null>(null)
  const [icalMode, setIcalMode] = useState<'subscribe' | 'download' | null>(null)

  // Allowed sources for the filter chips (all visible options)
  const allowedSources = allSources

  // Active chips = what's selected. Pass directly to data hook.
  // Empty selectedTeamIds = all teams (no team filter).
  const effectiveFilters: CalendarFilterState = useMemo(() => {
    if (!user) {
      return { sources: ['game-home', 'game-away', 'hall'], selectedTeamIds: [] }
    }
    return filters
  }, [filters, user])

  // Compute visible range based on view mode
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (viewMode === 'month') {
      // For month view, include the full grid (prev/next month days visible)
      const ms = startOfMonth(month)
      const me = endOfMonth(month)
      return { rangeStart: startOfWeek(ms), rangeEnd: endOfWeek(me) }
    }
    if (viewMode === 'week') {
      if (isMobile) {
        // 3-day mobile view
        const end = new Date(mobileDay)
        end.setDate(end.getDate() + 2)
        return { rangeStart: mobileDay, rangeEnd: end }
      }
      return { rangeStart: startOfWeek(weekStart), rangeEnd: endOfWeek(weekStart) }
    }
    // hallenplan — don't fetch
    return { rangeStart: new Date(), rangeEnd: new Date() }
  }, [viewMode, month, weekStart, mobileDay, isMobile])

  const needsData = viewMode === 'month' || viewMode === 'week'
  const { entries, closedDates, isLoading } = useCalendarData({
    filters: effectiveFilters,
    rangeStart,
    rangeEnd,
    enabled: needsData,
  })

  // Only show full-page spinner on initial load, not on navigation
  const hasLoadedOnce = useRef(false)
  if (!isLoading && needsData) hasLoadedOnce.current = true
  const showSpinner = isLoading && !hasLoadedOnce.current

  function handleViewChange(v: string) {
    setViewMode(v as CalendarViewMode)
  }

  const subtitles: Record<CalendarViewMode, string> = {
    hallenplan: t('subtitleHall'),
    month: t('subtitleMonth'),
    week: t('subtitleWeek', { defaultValue: 'Weekly overview of all events' }),
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-gray-100">{t('title')}</h1>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{subtitles[viewMode]}</p>
        </div>
        <div className="flex items-center gap-2">
          {needsData && (
            <>
              <button
                onClick={() => setIcalMode('subscribe')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                title={t('subscribeICal')}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span className="hidden sm:inline">{t('subscribeICal')}</span>
              </button>
              <button
                onClick={() => setIcalMode('download')}
                disabled={entries.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="hidden sm:inline">{t('exportICal')}</span>
              </button>
            </>
          )}
          <ViewToggle
            options={[
              { value: 'hallenplan', label: t('viewHall') },
              { value: 'month', label: t('viewMonth') },
            ]}
            value={viewMode}
            onChange={handleViewChange}
          />
        </div>
      </div>

      {/* Filters — above the calendar views */}
      {needsData && (
        <div className="rounded-xl bg-white p-3 shadow-card dark:bg-gray-800">
          <CalendarFilters
            filters={filters}
            onChange={setFilters}
            allowedSources={allowedSources}
            compact
            showBulkToggle
          />
        </div>
      )}

      {/* Views */}
      {viewMode === 'hallenplan' && <HallenplanView />}

      {needsData && showSpinner && <LoadingSpinner />}

      {needsData && !showSpinner && (
        <div className="flex flex-1 flex-col">
          {/* Month view */}
          {viewMode === 'month' && (
            isMobile ? (
              <MobileMonthView
                entries={entries}
                closedDates={closedDates}
                month={month}
                onMonthChange={setMonth}
                onEntryClick={setSelectedEntry}
              />
            ) : (
              <MonthGrid
                entries={entries}
                closedDates={closedDates}
                month={month}
                onMonthChange={setMonth}
                onEntryClick={setSelectedEntry}
                onOverflowClick={(items, date) => setDayOverflow({ entries: items, date })}
              />
            )
          )}

          {/* Week view */}
          {viewMode === 'week' && (
            isMobile ? (
              <MobileWeekGrid
                entries={entries}
                closedDates={closedDates}
                dayStart={mobileDay}
                onDayChange={setMobileDay}
                onEntryClick={setSelectedEntry}
              />
            ) : (
              <WeekGrid
                entries={entries}
                closedDates={closedDates}
                weekStart={weekStart}
                onWeekChange={setWeekStart}
                onEntryClick={setSelectedEntry}
              />
            )
          )}
        </div>
      )}

      {/* Day overflow modal */}
      <Modal
        open={!!dayOverflow}
        onClose={() => setDayOverflow(null)}
        title={dayOverflow ? formatDate(dayOverflow.date, 'EEEE, d MMMM') : ''}
        size="sm"
      >
        {dayOverflow && (
          <div className="space-y-2">
            {dayOverflow.entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setDayOverflow(null)
                  setSelectedEntry(entry)
                }}
                className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-gray-50 active:bg-gray-100 dark:hover:bg-gray-700 dark:active:bg-gray-600"
              >
                <TypeIcon type={entry.type} sport={entry.sport} className={entryIconColor(entry)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {entry.title}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {entry.startTime ?? ''}{entry.location ? ` · ${entry.location}` : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Modal>

      {/* Detail modals */}
      {selectedEntry?.type === 'game' && (
        <GameDetailModal
          game={selectedEntry.source as Game}
          onClose={() => setSelectedEntry(null)}
          readOnly
        />
      )}
      {selectedEntry && selectedEntry.type !== 'game' && (
        <CalendarEntryModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}

      {/* iCal subscribe/download modal */}
      <ICalModal
        open={!!icalMode}
        mode={icalMode ?? 'subscribe'}
        onClose={() => setIcalMode(null)}
        entries={entries}
      />
    </div>
  )
}
