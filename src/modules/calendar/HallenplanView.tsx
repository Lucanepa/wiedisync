import { useState, useMemo, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useRealtime } from '../../hooks/useRealtime'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { useWeekNavigation } from '../hallenplan/hooks/useWeekNavigation'
import { useHallenplanData } from '../hallenplan/hooks/useHallenplanData'
import WeekNavigation from '../hallenplan/components/WeekNavigation'
import WeekSlotView from '../hallenplan/components/WeekSlotView'
import DayNavigation from '../hallenplan/components/DayNavigation'
import DaySlotView from '../hallenplan/components/DaySlotView'
import SlotEditor from '../hallenplan/components/SlotEditor'
import ClosureManager from '../hallenplan/components/ClosureManager'
import VirtualSlotDetailModal from '../hallenplan/components/VirtualSlotDetailModal'
import SummaryView from '../hallenplan/components/SummaryView'
import LoadingSpinner from '../../components/LoadingSpinner'
import type { HallSlot, HallClosure, Game, Training, HallEvent, Hall, Team } from '../../types'
import type { FreedSlotInfo, SportFilter } from '../hallenplan/HallenplanPage'

function getTodayDayIndex(): number {
  const dow = new Date().getDay()
  return dow === 0 ? 6 : dow - 1
}

export default function HallenplanView() {
  const { t } = useTranslation('hallenplan')
  const { isAdmin } = useAuth()
  const isMobile = useIsMobile()
  const { weekDays, goNext, goPrev, goToday, weekLabel, mondayStr, sundayStr } = useWeekNavigation()

  const [selectedHallIds, setSelectedHallIds] = useState<string[]>([])
  const [selectedDayIndex, setSelectedDayIndex] = useState(getTodayDayIndex)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingSlot, setEditingSlot] = useState<HallSlot | null>(null)
  const [prefill, setPrefill] = useState<{ day: number; time: string; hall: string } | null>(null)
  const [closureManagerOpen, setClosureManagerOpen] = useState(false)
  const [virtualDetailSlot, setVirtualDetailSlot] = useState<HallSlot | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [sportFilter, setSportFilter] = useState<SportFilter>('vb')

  function handleToggleSummary() {
    const next = !showSummary
    setShowSummary(next)
    if (next) {
      // Enter fullscreen + landscape on mobile (requires user gesture)
      const el = document.documentElement
      const requestFs = el.requestFullscreen?.bind(el)
        ?? (el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen?.bind(el)
      if (requestFs) {
        requestFs()
          .then(() => screen.orientation?.lock?.('landscape'))
          .catch(() => {})
      }
    } else {
      // Exit fullscreen + unlock orientation
      screen.orientation?.unlock?.()
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }

  // Sync summary state when user exits fullscreen via system gesture
  useEffect(() => {
    function onFsChange() {
      if (!document.fullscreenElement && showSummary) {
        setShowSummary(false)
        screen.orientation?.unlock?.()
      }
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [showSummary])

  const { halls, teams, slots, rawSlots, closures, isLoading, refetch } = useHallenplanData(
    selectedHallIds,
    mondayStr,
    sundayStr,
    weekDays,
  )

  // Filter slots by sport
  const teamsBySport = useMemo(() => {
    const vb = new Set(teams.filter((t: Team) => t.sport === 'volleyball').map((t: Team) => t.id))
    const bb = new Set(teams.filter((t: Team) => t.sport === 'basketball').map((t: Team) => t.id))
    return { vb, bb }
  }, [teams])
  const filteredSlots = useMemo(() => {
    if (sportFilter === 'all') return slots
    const allowedTeams = sportFilter === 'vb' ? teamsBySport.vb : teamsBySport.bb
    return slots.filter((s) => {
      if (!s.team) return true
      if (!allowedTeams.has(s.team)) return false
      if (sportFilter === 'vb' && s._virtual?.source === 'hall_event' && s.slot_type === 'game') return false
      return true
    })
  }, [slots, sportFilter, teamsBySport])

  const DAY_KEYS = ['dayMonday', 'dayTuesday', 'dayWednesday', 'dayThursday', 'dayFriday', 'daySaturday', 'daySunday'] as const
  const freedSlotInfos = useMemo(() => {
    const hallMap = new Map<string, Hall>(halls.map((h) => [h.id, h]))
    return filteredSlots
      .filter((s) => s._virtual?.isFreed || (!s._virtual && !s.team))
      .map((s): FreedSlotInfo => ({
        hallName: hallMap.get(s.hall)?.name || '?',
        dayLabel: t(DAY_KEYS[s.day_of_week] ?? 'dayMonday'),
        startTime: s.start_time,
        endTime: s.end_time,
        slot: s,
      }))
  }, [filteredSlots, halls, t])

  const handleRealtimeUpdate = useCallback(() => {
    refetch()
  }, [refetch])

  useRealtime<HallSlot>('hall_slots', handleRealtimeUpdate)
  useRealtime<HallClosure>('hall_closures', handleRealtimeUpdate)
  useRealtime<Game>('games', handleRealtimeUpdate)
  useRealtime<Training>('trainings', handleRealtimeUpdate)
  useRealtime<HallEvent>('hall_events', handleRealtimeUpdate)

  function handleSlotClick(slot: HallSlot) {
    if (slot._virtual) {
      setVirtualDetailSlot(slot)
      return
    }
    if (!isAdmin) return
    setEditingSlot(slot)
    setPrefill(null)
    setEditorOpen(true)
  }

  function handleEmptyCellClick(dayOfWeek: number, time: string, hallId: string) {
    if (!isAdmin) return
    setPrefill({ day: dayOfWeek, time, hall: hallId })
    setEditingSlot(null)
    setEditorOpen(true)
  }

  function handleEditorClose() {
    setEditorOpen(false)
    setEditingSlot(null)
    setPrefill(null)
  }

  function handleToday() {
    goToday()
    setSelectedDayIndex(getTodayDayIndex())
  }

  function toggleHall(hallId: string) {
    if (selectedHallIds.includes(hallId)) {
      setSelectedHallIds(selectedHallIds.filter((id) => id !== hallId))
    } else {
      setSelectedHallIds([...selectedHallIds, hallId])
    }
  }

  return (
    <>
      {isMobile ? (
        <>
          <DayNavigation
            weekDays={weekDays}
            selectedDayIndex={selectedDayIndex}
            onSelectDay={setSelectedDayIndex}
            onPrevWeek={goPrev}
            onNextWeek={goNext}
            onToday={handleToday}
            halls={halls}
            selectedHallIds={selectedHallIds}
            onSelectHalls={setSelectedHallIds}
            isAdmin={isAdmin}
            onOpenClosureManager={() => setClosureManagerOpen(true)}
            showSummary={showSummary}
            onToggleSummary={handleToggleSummary}
            sportFilter={sportFilter}
            onSetSportFilter={setSportFilter}
            freedSlots={freedSlotInfos}
            onFreedSlotClick={handleSlotClick}
          />

          {isLoading ? (
            <LoadingSpinner />
          ) : showSummary ? (
            <SummaryView slots={filteredSlots} closures={closures} weekDays={weekDays} halls={halls} />
          ) : (
            <DaySlotView
              slots={filteredSlots}
              closures={closures}
              day={weekDays[selectedDayIndex]}
              dayIndex={selectedDayIndex}
              halls={halls}
              selectedHallIds={selectedHallIds}
              isAdmin={isAdmin}
              onSlotClick={handleSlotClick}
              onEmptyCellClick={handleEmptyCellClick}
            />
          )}
        </>
      ) : (
        <>
          <WeekNavigation
            weekLabel={weekLabel}
            onPrev={goPrev}
            onNext={goNext}
            onToday={goToday}
            halls={halls}
            selectedHallIds={selectedHallIds}
            onSelectHalls={setSelectedHallIds}
            isAdmin={isAdmin}
            onOpenClosureManager={() => setClosureManagerOpen(true)}
            sportFilter={sportFilter}
            onSetSportFilter={setSportFilter}
            freedSlots={freedSlotInfos}
            onFreedSlotClick={handleSlotClick}
          />

          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <WeekSlotView
              slots={filteredSlots}
              closures={closures}
              weekDays={weekDays}
              halls={halls}
              selectedHallIds={selectedHallIds}
              isAdmin={isAdmin}
              onSlotClick={handleSlotClick}
              onEmptyCellClick={handleEmptyCellClick}
            />
          )}
        </>
      )}

      {/* Hall filter chips — below content, compact */}
      {halls.length > 0 && (
        <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setSelectedHallIds([])}
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                selectedHallIds.length === 0
                  ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-900/30 dark:text-brand-300'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {t('common:allHalls')}
            </button>
            {halls.map((hall) => (
              <button
                key={hall.id}
                onClick={() => toggleHall(hall.id)}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  selectedHallIds.includes(hall.id)
                    ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-900/30 dark:text-brand-300'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {hall.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {editorOpen && (
        <SlotEditor
          slot={editingSlot}
          prefill={prefill}
          halls={halls}
          teams={teams}
          allSlots={rawSlots}
          onClose={handleEditorClose}
          onSaved={refetch}
        />
      )}

      {closureManagerOpen && (
        <ClosureManager
          halls={halls}
          closures={closures}
          onClose={() => setClosureManagerOpen(false)}
          onChanged={refetch}
        />
      )}

      {virtualDetailSlot && (
        <VirtualSlotDetailModal
          slot={virtualDetailSlot}
          halls={halls}
          teams={teams}
          onClose={() => setVirtualDetailSlot(null)}
        />
      )}
    </>
  )
}
