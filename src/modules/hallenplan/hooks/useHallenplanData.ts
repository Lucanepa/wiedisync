import { useMemo } from 'react'
import { usePB } from '../../../hooks/usePB'
import type { Hall, HallSlot, HallClosure, Team, Game, Training, HallEvent, SlotClaim } from '../../../types'
import {
  gameToVirtualSlots,
  trainingToVirtualSlot,
  hallEventToVirtualSlots,
  mergeVirtualSlots,
  CLOSURE_PATTERN,
  BB_GAME_PATTERN,
  resolveHallEventHalls,
} from '../utils/virtualSlots'

export function useHallenplanData(
  selectedHallIds: string[],
  mondayStr: string,
  sundayStr: string,
  weekDays: Date[],
) {
  const { data: halls, isLoading: hallsLoading } = usePB<Hall>('halls', {
    sort: 'name',
    perPage: 50,
  })

  const { data: teams, isLoading: teamsLoading } = usePB<Team>('teams', {
    filter: 'active = true',
    sort: 'name',
    perPage: 50,
  })

  const hallFilter = selectedHallIds.length > 0
    ? `(${selectedHallIds.map((id) => `hall = "${id}"`).join(' || ')}) && `
    : ''
  const dateFilter = `(valid_from <= "${sundayStr}" || valid_from = "") && (valid_until >= "${mondayStr}" || valid_until = "")`

  const {
    data: rawSlots,
    isLoading: slotsLoading,
    refetch: refetchSlots,
  } = usePB<HallSlot>('hall_slots', {
    filter: `${hallFilter}${dateFilter}`,
    expand: 'team,hall',
    perPage: 200,
    sort: 'day_of_week,start_time',
  })

  const closureDateFilter = `start_date <= "${sundayStr}" && end_date >= "${mondayStr}"`

  const {
    data: closures,
    isLoading: closuresLoading,
    refetch: refetchClosures,
  } = usePB<HallClosure>('hall_closures', {
    filter: `${hallFilter}${closureDateFilter}`,
    expand: 'hall',
    perPage: 100,
  })

  // Games for this week (exclude postponed)
  const { data: games, isLoading: gamesLoading } = usePB<Game>('games', {
    filter: `date >= "${mondayStr}" && date <= "${sundayStr}" && status != "postponed"`,
    expand: 'kscw_team',
    perPage: 100,
    sort: 'date,time',
  })

  // Trainings for this week
  const { data: trainings, isLoading: trainingsLoading } = usePB<Training>('trainings', {
    filter: `date >= "${mondayStr}" && date <= "${sundayStr}"`,
    expand: 'team',
    perPage: 200,
    sort: 'date,start_time',
  })

  // Hall events (GCal) for this week
  const { data: hallEvents, isLoading: hallEventsLoading } = usePB<HallEvent>('hall_events', {
    filter: `date >= "${mondayStr}" && date <= "${sundayStr}"`,
    perPage: 100,
    sort: 'date,start_time',
  })

  // Slot claims for this week
  const {
    data: slotClaims,
    isLoading: claimsLoading,
    refetch: refetchClaims,
  } = usePB<SlotClaim>('slot_claims', {
    filter: `date >= "${mondayStr}" && date <= "${sundayStr}" && status = "active"`,
    expand: 'claimed_by_team,claimed_by_member,hall_slot',
    perPage: 100,
  })

  // Convert GCal closure events ("Halle geschlossen") into synthetic HallClosure records
  // and merge with real closures (deduplicating where a hall_closures record already exists)
  const mergedClosures = useMemo(() => {
    const syntheticClosures: HallClosure[] = []
    for (const he of hallEvents) {
      if (!CLOSURE_PATTERN.test(he.title)) continue
      const hallIds = resolveHallEventHalls(he, halls)
      const dateStr = he.date.slice(0, 10)
      for (const hallId of hallIds) {
        // Skip if a real hall_closures record already covers this hall+date
        const alreadyCovered = closures.some(
          (c) => c.hall === hallId && c.start_date <= dateStr && c.end_date >= dateStr,
        )
        if (alreadyCovered) continue
        syntheticClosures.push({
          id: `gcal-closure-${he.id}-${hallId}`,
          collectionId: '',
          collectionName: 'hall_closures',
          created: '',
          updated: '',
          hall: hallId,
          start_date: dateStr,
          end_date: dateStr,
          reason: he.title,
          source: 'gcal',
        } as HallClosure)
      }
    }
    return [...closures, ...syntheticClosures]
  }, [closures, hallEvents, halls])

  // Convert and merge virtual slots
  const slots = useMemo(() => {
    const virtualSlots: HallSlot[] = []

    for (const game of games) {
      virtualSlots.push(...gameToVirtualSlots(game, weekDays, halls, teams))
    }

    for (const training of trainings) {
      const vs = trainingToVirtualSlot(training, weekDays)
      if (vs) virtualSlots.push(vs)
    }

    // Build a set of basketplan game date keys for BB GCal dedup
    const bpGameDateKeys = new Set(
      games
        .filter((g) => g.source === 'basketplan')
        .map((g) => `${g.date?.slice(0, 10)}-${g.time?.slice(0, 5)}`),
    )

    for (const he of hallEvents) {
      // Skip closure events — they're handled as ClosureOverlay via mergedClosures
      if (CLOSURE_PATTERN.test(he.title)) continue
      // Skip BB GCal events when a basketplan game already covers that slot
      if (BB_GAME_PATTERN.test(he.title) && bpGameDateKeys.size > 0) {
        const heKey = `${he.date?.slice(0, 10)}-${he.start_time?.slice(0, 5)}`
        if (bpGameDateKeys.has(heKey)) continue
      }
      virtualSlots.push(...hallEventToVirtualSlots(he, weekDays, halls))
    }

    // Apply hall filter to virtual slots
    const hallSet = new Set(selectedHallIds)
    const filteredVirtual = hallSet.size > 0
      ? virtualSlots.filter((vs) => hallSet.has(vs.hall))
      : virtualSlots

    return mergeVirtualSlots(rawSlots, filteredVirtual, slotClaims, mergedClosures, games, weekDays, halls, teams)
  }, [rawSlots, games, trainings, hallEvents, weekDays, halls, teams, selectedHallIds, slotClaims, mergedClosures])

  const refetch = () => {
    refetchSlots()
    refetchClosures()
    refetchClaims()
  }

  const isLoading =
    hallsLoading || teamsLoading || slotsLoading || closuresLoading ||
    gamesLoading || trainingsLoading || hallEventsLoading || claimsLoading

  return { halls, teams, slots, rawSlots, closures: mergedClosures, slotClaims, isLoading, refetch }
}
