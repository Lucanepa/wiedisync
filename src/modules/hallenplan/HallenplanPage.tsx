import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useRealtime } from '../../hooks/useRealtime'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { useWeekNavigation } from './hooks/useWeekNavigation'
import { useHallenplanData } from './hooks/useHallenplanData'
import WeekNavigation from './components/WeekNavigation'
import WeekSlotView from './components/WeekSlotView'
import DayNavigation from './components/DayNavigation'
import DaySlotView from './components/DaySlotView'
import SlotEditor from './components/SlotEditor'
import ClosureManager from './components/ClosureManager'
import SummaryView from './components/SummaryView'
import VirtualSlotDetailModal from './components/VirtualSlotDetailModal'
import ClaimModal from './components/ClaimModal'
import ClaimDetailModal from './components/ClaimDetailModal'
import LoadingSpinner from '../../components/LoadingSpinner'
import type { HallSlot, HallClosure, SlotClaim, Team, Hall } from '../../types'

export type SportFilter = 'all' | 'vb' | 'bb'

export interface FreedSlotInfo {
  hallName: string
  dayLabel: string
  startTime: string
  endTime: string
  slot: HallSlot
}

function getTodayDayIndex(): number {
  const dow = new Date().getDay()
  return dow === 0 ? 6 : dow - 1
}

export default function HallenplanPage() {
  const { t } = useTranslation('hallenplan')
  const { isAdmin, isCoach, coachTeamIds } = useAuth()
  const isMobile = useIsMobile()
  const { weekDays, goNext, goPrev, goToday, weekLabel, mondayStr, sundayStr } = useWeekNavigation()

  const [selectedHallIds, setSelectedHallIds] = useState<string[]>([])
  const [selectedDayIndex, setSelectedDayIndex] = useState(getTodayDayIndex)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingSlot, setEditingSlot] = useState<HallSlot | null>(null)
  const [prefill, setPrefill] = useState<{ day: number; time: string; hall: string } | null>(null)
  const [closureManagerOpen, setClosureManagerOpen] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [sportFilter, setSportFilter] = useState<SportFilter>('vb')

  // Claim modals
  const [claimSlot, setClaimSlot] = useState<HallSlot | null>(null)
  const [claimDetailSlot, setClaimDetailSlot] = useState<HallSlot | null>(null)
  const [claimDetailRecord, setClaimDetailRecord] = useState<SlotClaim | null>(null)
  // Virtual slot detail modal (read-only, for non-admin viewing)
  const [virtualDetailSlot, setVirtualDetailSlot] = useState<HallSlot | null>(null)

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
  const filteredSlots = useMemo(
    () => {
      if (sportFilter === 'all') return slots
      const allowedTeams = sportFilter === 'vb' ? teamsBySport.vb : teamsBySport.bb
      return slots.filter((s) => {
        // Keep slots with no team (free/spielhalle)
        if (!s.team) return true
        // Filter by sport
        if (!allowedTeams.has(s.team)) return false
        // VB mode: filter out BB game hall events (GCal basketball games)
        if (sportFilter === 'vb' && s._virtual?.source === 'hall_event' && s.slot_type === 'game') return false
        return true
      })
    },
    [slots, sportFilter, teamsBySport],
  )

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

  // Debounce realtime refetch to avoid request storms (multiple subscriptions firing at once)
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const debouncedRefetch = useCallback(() => {
    clearTimeout(refetchTimerRef.current)
    refetchTimerRef.current = setTimeout(() => refetch(), 300)
  }, [refetch])
  useEffect(() => () => clearTimeout(refetchTimerRef.current), [])

  useRealtime<HallSlot>('hall_slots', debouncedRefetch)
  useRealtime<HallClosure>('hall_closures', debouncedRefetch)
  useRealtime<SlotClaim>('slot_claims', debouncedRefetch)

  function handleSlotClick(slot: HallSlot) {
    const meta = slot._virtual
    // A real slot with no team = manually created "free" slot
    const isManuallyFree = !meta && !slot.team

    // Freed slot (virtual or manual) → open claim modal (for coaches/admins)
    if ((meta?.isFreed || isManuallyFree) && (isCoach || isAdmin)) {
      setClaimSlot(slot)
      return
    }

    // Claimed slot → open claim detail modal
    if (meta?.isClaimed && meta.claimRecord) {
      setClaimDetailSlot(slot)
      setClaimDetailRecord(meta.claimRecord)
      return
    }

    // Virtual slot (non-freed, non-claimed) → open read-only detail modal
    if (meta && !isAdmin) {
      setVirtualDetailSlot(slot)
      return
    }

    // Admin or coach (own team): real slots → open slot editor
    if ((isAdmin || (isCoach && coachTeamIds.includes(slot.team))) && !meta) {
      setEditingSlot(slot)
      setPrefill(null)
      setEditorOpen(true)
      return
    }

    // Admin: virtual slots → open virtual detail modal
    if (isAdmin && meta) {
      setVirtualDetailSlot(slot)
    }
  }

  function handleEmptyCellClick(dayOfWeek: number, time: string, hallId: string) {
    if (!isAdmin && !isCoach) return
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

  function handleClaimed() {
    setClaimSlot(null)
    refetch()
  }

  function handleClaimReleased() {
    setClaimDetailSlot(null)
    setClaimDetailRecord(null)
    refetch()
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 sm:text-2xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {isMobile
            ? t('subtitleDay')
            : t('subtitleWeek')}
        </p>
      </div>

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
            onToggleSummary={() => setShowSummary((v) => !v)}
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
              isCoach={isCoach}
              coachTeamIds={coachTeamIds}
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
              isCoach={isCoach}
              coachTeamIds={coachTeamIds}
              onSlotClick={handleSlotClick}
              onEmptyCellClick={handleEmptyCellClick}
            />
          )}
        </>
      )}

      {editorOpen && (
        <SlotEditor
          slot={editingSlot}
          prefill={prefill}
          halls={halls}
          teams={teams}
          allSlots={slots}
          isAdmin={isAdmin}
          coachTeamIds={coachTeamIds}
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

      {claimSlot && (
        <ClaimModal
          slot={claimSlot}
          halls={halls}
          teams={teams}
          rawSlots={rawSlots}
          weekDays={weekDays}
          onClose={() => setClaimSlot(null)}
          onClaimed={handleClaimed}
          onEditSlot={(s) => {
            setClaimSlot(null)
            setEditingSlot(s)
            setPrefill(null)
            setEditorOpen(true)
          }}
        />
      )}

      {claimDetailSlot && claimDetailRecord && (
        <ClaimDetailModal
          slot={claimDetailSlot}
          claim={claimDetailRecord}
          halls={halls}
          teams={teams}
          onClose={() => { setClaimDetailSlot(null); setClaimDetailRecord(null) }}
          onReleased={handleClaimReleased}
        />
      )}
    </div>
  )
}
