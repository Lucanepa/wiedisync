import { useMemo } from 'react'
import { usePB } from '../../../hooks/usePB'
import type { Hall, HallSlot, HallClosure, Team, Game, Training, HallEvent, SlotClaim } from '../../../types'
import {
  gameToVirtualSlots,
  trainingToVirtualSlot,
  hallEventToVirtualSlots,
  mergeVirtualSlots,
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

    for (const he of hallEvents) {
      virtualSlots.push(...hallEventToVirtualSlots(he, weekDays, halls))
    }

    // Apply hall filter to virtual slots
    const hallSet = new Set(selectedHallIds)
    const filteredVirtual = hallSet.size > 0
      ? virtualSlots.filter((vs) => hallSet.has(vs.hall))
      : virtualSlots

    return mergeVirtualSlots(rawSlots, filteredVirtual, slotClaims, closures, games, weekDays, halls, teams)
  }, [rawSlots, games, trainings, hallEvents, weekDays, halls, teams, selectedHallIds, slotClaims, closures])

  const refetch = () => {
    refetchSlots()
    refetchClosures()
    refetchClaims()
  }

  const isLoading =
    hallsLoading || teamsLoading || slotsLoading || closuresLoading ||
    gamesLoading || trainingsLoading || hallEventsLoading || claimsLoading

  return { halls, teams, slots, rawSlots, closures, slotClaims, isLoading, refetch }
}
