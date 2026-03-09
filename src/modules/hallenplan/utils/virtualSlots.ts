import type { Game, Training, HallEvent, HallSlot, HallClosure, Hall, Team, SlotClaim } from '../../../types'
import { toISODate, timeToMinutes, minutesToTime } from '../../../utils/dateHelpers'

/** Hall events matching this pattern are treated as closures */
export const CLOSURE_PATTERN = /geschlossen|gesperrt|closed/i

/** Hall events matching this pattern are basketball games */
export const BB_GAME_PATTERN = /^BB\s/i

/** Games occupy the hall from 45min before start, game itself lasts ~2h → 2h45m total */
const GAME_WARMUP_MINUTES = 45
const GAME_TOTAL_DURATION = 165

/**
 * Converts a home/away game into virtual HallSlot(s) for the Hallenplan.
 * Home games → placed on game.hall (BB games span both KWI A+B)
 * Away games → skipped (but handled separately for freed slots)
 * Returns an array because BB games may produce 2 slots (one per hall).
 */
export function gameToVirtualSlots(
  game: Game,
  weekDays: Date[],
  halls: Hall[],
  teams: Team[],
): HallSlot[] {
  const gameDate = game.date.slice(0, 10)
  const dayIndex = weekDays.findIndex((d) => toISODate(d) === gameDate)
  if (dayIndex === -1) return []

  // Hallenplan is home-only — skip away games entirely
  if (game.type === 'away') return []

  const gameTime = game.time?.slice(0, 5)
  if (!gameTime) return []

  const gameMinutes = timeToMinutes(gameTime)
  const startMinutes = Math.max(gameMinutes - GAME_WARMUP_MINUTES, 0)
  const endMinutes = Math.min(startMinutes + GAME_TOTAL_DURATION, 22 * 60)

  if (!game.hall) return []

  const expanded = (game as Record<string, unknown>).expand as Record<string, unknown> | undefined

  // Check if the team is basketball → spread across KWI A + KWI B
  const team = teams.find((t) => t.id === game.kscw_team)
  const isBB = team?.sport === 'basketball'

  const hallIds = isBB
    ? halls.filter((h) => h.name === 'KWI A' || h.name === 'KWI B').map((h) => h.id)
    : [game.hall]

  // Single slot on the first hall, with spanHallIds when spanning multiple
  return [{
    id: `game-${game.id}`,
    collectionId: '',
    collectionName: 'virtual',
    created: '',
    updated: '',
    hall: hallIds[0],
    team: game.kscw_team,
    day_of_week: dayIndex,
    start_time: minutesToTime(startMinutes),
    end_time: minutesToTime(endMinutes),
    slot_type: 'game',
    recurring: false,
    valid_from: gameDate,
    valid_until: gameDate,
    label: `${game.home_team} vs ${game.away_team}`,
    notes: game.league || '',
    expand: expanded ? { team: expanded.kscw_team } : undefined,
    _virtual: {
      source: 'game',
      sourceId: game.id,
      sourceRecord: game,
      ...(hallIds.length > 1 ? { spanHallIds: hallIds } : {}),
    },
  } as HallSlot]
}

/**
 * Converts a training record into a virtual HallSlot for the Hallenplan.
 */
export function trainingToVirtualSlot(
  training: Training,
  weekDays: Date[],
): HallSlot | null {
  const trainingDate = training.date.slice(0, 10)
  const dayIndex = weekDays.findIndex((d) => toISODate(d) === trainingDate)
  if (dayIndex === -1) return null
  if (!training.start_time || !training.end_time) return null

  const expanded = (training as Record<string, unknown>).expand as Record<string, unknown> | undefined

  return {
    id: `training-${training.id}`,
    collectionId: '',
    collectionName: 'virtual',
    created: '',
    updated: '',
    hall: training.hall,
    team: training.team,
    day_of_week: dayIndex,
    start_time: training.start_time.slice(0, 5),
    end_time: training.end_time.slice(0, 5),
    slot_type: 'training',
    recurring: false,
    valid_from: trainingDate,
    valid_until: trainingDate,
    label: training.cancelled
      ? `Abgesagt${training.cancel_reason ? ': ' + training.cancel_reason : ''}`
      : '',
    notes: training.notes || '',
    expand: expanded ? { team: expanded.team } : undefined,
    _virtual: {
      source: 'training',
      sourceId: training.id,
      sourceRecord: training,
      isCancelled: training.cancelled,
    },
  } as HallSlot
}

/** Resolves which hall IDs a GCal event belongs to.
 *  Uses the hall relation array if populated (set by GCal sync hook),
 *  otherwise falls back to regex on title/location for legacy data. */
export function resolveHallEventHalls(event: HallEvent, halls: Hall[]): string[] {
  // Prefer the relation field if populated
  if (event.hall && event.hall.length > 0) {
    return event.hall
  }

  // Fallback: regex on title/location for events synced before hook update
  const HALLE_PATTERNS: [RegExp, string][] = [
    [/Halle\s*(KWI\s*)?A/i, 'KWI A'],
    [/Halle\s*(KWI\s*)?B/i, 'KWI B'],
    [/Halle\s*(KWI\s*)?C/i, 'KWI C'],
  ]
  const text = `${event.title} ${event.location || ''}`
  const matched: string[] = []
  for (const [pattern, hallName] of HALLE_PATTERNS) {
    if (pattern.test(text)) {
      const hall = halls.find((h) => h.name === hallName)
      if (hall) matched.push(hall.id)
    }
  }
  if (matched.length === 0) {
    return halls.filter((h) => h.name.startsWith('KWI')).map((h) => h.id)
  }
  return matched
}

/**
 * Converts a GCal hall event into a virtual HallSlot.
 * When the event spans multiple halls, a single slot is created on the first hall
 * with spanHallIds set for visual spanning in the grid.
 */
export function hallEventToVirtualSlots(
  event: HallEvent,
  weekDays: Date[],
  halls: Hall[],
): HallSlot[] {
  const eventDate = event.date.slice(0, 10)
  const dayIndex = weekDays.findIndex((d) => toISODate(d) === eventDate)
  if (dayIndex === -1) return []

  const hallIds = resolveHallEventHalls(event, halls)
  if (hallIds.length === 0) return []

  const isBBGame = BB_GAME_PATTERN.test(event.title)
  const isClosure = CLOSURE_PATTERN.test(event.title)

  // Closures are treated as full-day regardless of actual event times
  // BB games get warmup padding like regular games
  const rawStart = isClosure || event.all_day || !event.start_time ? '10:00' : event.start_time.slice(0, 5)
  const rawEnd = isClosure || event.all_day || !event.end_time ? '22:00' : event.end_time.slice(0, 5)
  const startTime = isBBGame
    ? minutesToTime(Math.max(timeToMinutes(rawStart) - GAME_WARMUP_MINUTES, 0))
    : rawStart
  const endTime = rawEnd

  // Single slot on first hall, spanning all halls visually
  return [{
    id: `hall-event-${event.id}`,
    collectionId: '',
    collectionName: 'virtual',
    created: '',
    updated: '',
    hall: hallIds[0],
    team: '',
    day_of_week: dayIndex,
    start_time: startTime,
    end_time: endTime,
    slot_type: isBBGame ? 'game' as const : 'event' as const,
    recurring: false,
    valid_from: eventDate,
    valid_until: eventDate,
    label: event.title,
    notes: event.location || '',
    _virtual: {
      source: 'hall_event' as const,
      sourceId: event.id,
      sourceRecord: event,
      ...(hallIds.length > 1 ? { spanHallIds: hallIds } : {}),
    },
  } as HallSlot]
}

/**
 * Checks whether a date+hall overlaps with any hall closure.
 */
function isClosedOnDate(
  hallId: string,
  dateStr: string,
  closures: HallClosure[],
): boolean {
  return closures.some(
    (c) => c.hall === hallId && c.start_date <= dateStr && c.end_date >= dateStr,
  )
}

/**
 * Annotates virtual slots with isFreed/isClaimed metadata based on
 * cancelled trainings and active claims.
 *
 * A cancelled training (with hall_slot set) → its virtual slot gets isFreed=true
 * unless an active claim exists for that date+hall_slot.
 */
export function annotateFreedSlots(
  virtualSlots: HallSlot[],
  claims: SlotClaim[],
  closures: HallClosure[],
): HallSlot[] {
  // Index active claims by hall_slot + date for fast lookup
  const claimsByKey = new Map<string, SlotClaim>()
  for (const claim of claims) {
    if (claim.status === 'active') {
      const dateStr = claim.date.slice(0, 10)
      claimsByKey.set(`${claim.hall_slot}-${dateStr}`, claim)
    }
  }

  return virtualSlots.map((vs) => {
    const meta = vs._virtual
    if (!meta) return vs

    // Case 1: Cancelled training with hall_slot → freed
    if (meta.source === 'training' && meta.isCancelled) {
      const training = meta.sourceRecord as Training
      if (training.hall_slot) {
        const dateStr = training.date.slice(0, 10)
        if (isClosedOnDate(vs.hall, dateStr, closures)) return vs

        const claim = claimsByKey.get(`${training.hall_slot}-${dateStr}`)
        return {
          ...vs,
          _virtual: {
            ...meta,
            isFreed: !claim,
            isClaimed: !!claim,
            claimRecord: claim,
          },
        }
      }
    }

    return vs
  })
}

/**
 * Merges real hall_slots with virtual slots, deduplicating recurring slots
 * that have a corresponding training instance for the same day.
 * Also checks for away games that free up recurring training slots without
 * an explicit training record.
 */
export function mergeVirtualSlots(
  realSlots: HallSlot[],
  virtualSlots: HallSlot[],
  claims: SlotClaim[],
  closures: HallClosure[],
  games: Game[],
  weekDays: Date[],
  halls: Hall[],
  teams: Team[],
): HallSlot[] {
  // Find training virtuals linked to a recurring hall_slot → suppress the template
  const suppressedSlotDays = new Set<string>()
  for (const vs of virtualSlots) {
    if (vs._virtual?.source === 'training') {
      const training = vs._virtual.sourceRecord as Training
      if (training.hall_slot) {
        suppressedSlotDays.add(`${training.hall_slot}-${vs.day_of_week}`)
      }
    }
  }

  // Track slots that need shortening due to home games (key: `${slot.id}-${dayIndex}`, value: new end_time)
  const shortenedSlots = new Map<string, string>()

  // Suppress recurring templates based on games:
  // - Away games → free up the team's training slot (shown as "FREI")
  // - Home games → shorten preceding slot or suppress overlapping slots
  for (const game of games) {
    if (game.status === 'postponed') continue
    const gameDate = game.date.slice(0, 10)
    const dayIndex = weekDays.findIndex((d) => toISODate(d) === gameDate)
    if (dayIndex === -1) continue

    if (game.type === 'away') {
      // Away game → suppress team's recurring training slot (will show as freed)
      for (const slot of realSlots) {
        if (
          slot.recurring &&
          slot.slot_type === 'training' &&
          slot.team === game.kscw_team &&
          slot.day_of_week === dayIndex
        ) {
          suppressedSlotDays.add(`${slot.id}-${dayIndex}`)
        }
      }
    } else {
      // Home game → shorten preceding slot or suppress overlapping slots
      // BB games span KWI A + KWI B
      const gameTime = game.time?.slice(0, 5)
      if (!gameTime) continue
      const gameStartMin = Math.max(timeToMinutes(gameTime) - GAME_WARMUP_MINUTES, 0)
      const gameEndMin = Math.min(gameStartMin + GAME_TOTAL_DURATION, 22 * 60)

      const gameTeam = teams.find((t) => t.id === game.kscw_team)
      const isBB = gameTeam?.sport === 'basketball'
      const gameHallIds = isBB
        ? halls.filter((h) => h.name === 'KWI A' || h.name === 'KWI B').map((h) => h.id)
        : [game.hall]

      for (const slot of realSlots) {
        if (
          !slot.recurring ||
          !gameHallIds.includes(slot.hall) ||
          slot.day_of_week !== dayIndex
        ) continue
        const slotStart = timeToMinutes(slot.start_time)
        const slotEnd = timeToMinutes(slot.end_time)
        if (slotStart < gameEndMin && slotEnd > gameStartMin) {
          // Slot overlaps with game range
          if (slotStart < gameStartMin) {
            // Slot starts before game warmup → shorten to end at warmup start
            const newEnd = gameStartMin
            if (newEnd > slotStart + 15) {
              // Keep at least 15 min of the slot
              const key = `${slot.id}-${dayIndex}`
              const existing = shortenedSlots.get(key)
              // If multiple games affect this slot, use the earliest end time
              if (!existing || timeToMinutes(existing) > newEnd) {
                shortenedSlots.set(key, minutesToTime(newEnd))
              }
            } else {
              suppressedSlotDays.add(`${slot.id}-${dayIndex}`)
            }
          } else {
            // Slot starts during/after game warmup → suppress entirely
            suppressedSlotDays.add(`${slot.id}-${dayIndex}`)
          }
        }
      }
    }
  }

  // Suppress recurring slots that overlap with closure-like hall events
  for (const vs of virtualSlots) {
    if (vs._virtual?.source !== 'hall_event') continue
    const he = vs._virtual.sourceRecord as HallEvent
    if (!CLOSURE_PATTERN.test(he.title)) continue

    const closureHallIds = he.hall?.length ? he.hall : [vs.hall]
    const closureStart = timeToMinutes(vs.start_time)
    const closureEnd = timeToMinutes(vs.end_time)

    for (const slot of realSlots) {
      if (!slot.recurring || slot.day_of_week !== vs.day_of_week) continue
      if (!closureHallIds.includes(slot.hall)) continue
      const slotStart = timeToMinutes(slot.start_time)
      const slotEnd = timeToMinutes(slot.end_time)
      if (slotStart < closureEnd && slotEnd > closureStart) {
        suppressedSlotDays.add(`${slot.id}-${vs.day_of_week}`)
      }
    }
  }

  // Suppress/shorten recurring slots that overlap with BB game hall events
  for (const vs of virtualSlots) {
    if (vs._virtual?.source !== 'hall_event' || vs.slot_type !== 'game') continue
    const bbHallIds = vs._virtual.spanHallIds ?? [vs.hall]
    const bbStartMin = timeToMinutes(vs.start_time)
    const bbEndMin = timeToMinutes(vs.end_time)

    for (const slot of realSlots) {
      if (!slot.recurring || slot.day_of_week !== vs.day_of_week) continue
      if (!bbHallIds.includes(slot.hall)) continue
      const slotStart = timeToMinutes(slot.start_time)
      const slotEnd = timeToMinutes(slot.end_time)
      if (slotStart < bbEndMin && slotEnd > bbStartMin) {
        if (slotStart < bbStartMin) {
          const newEnd = bbStartMin
          if (newEnd > slotStart + 15) {
            const key = `${slot.id}-${vs.day_of_week}`
            const existing = shortenedSlots.get(key)
            if (!existing || timeToMinutes(existing) > newEnd) {
              shortenedSlots.set(key, minutesToTime(newEnd))
            }
          } else {
            suppressedSlotDays.add(`${slot.id}-${vs.day_of_week}`)
          }
        } else {
          suppressedSlotDays.add(`${slot.id}-${vs.day_of_week}`)
        }
      }
    }
  }

  // Suppress recurring slots on days when their hall has a hall_closures record
  for (const slot of realSlots) {
    if (!slot.recurring) continue
    for (let dayIdx = 0; dayIdx < weekDays.length; dayIdx++) {
      if (slot.day_of_week !== dayIdx) continue
      const dateStr = toISODate(weekDays[dayIdx])
      if (isClosedOnDate(slot.hall, dateStr, closures)) {
        suppressedSlotDays.add(`${slot.id}-${dayIdx}`)
      }
    }
  }

  const filteredReal = realSlots
    .filter((slot) => {
      if (!slot.recurring) return true
      const key = `${slot.id}-${slot.day_of_week}`
      return !suppressedSlotDays.has(key)
    })
    .map((slot) => {
      if (!slot.recurring) return slot
      const key = `${slot.id}-${slot.day_of_week}`
      const newEnd = shortenedSlots.get(key)
      if (newEnd) return { ...slot, end_time: newEnd }
      return slot
    })

  // Create freed virtual slots for recurring training slots suppressed by away games
  // (the away game itself is not rendered, but its training slot shows as "FREI")
  const claimsByKey = new Map<string, SlotClaim>()
  for (const claim of claims) {
    if (claim.status === 'active') {
      claimsByKey.set(`${claim.hall_slot}-${claim.date.slice(0, 10)}`, claim)
    }
  }

  const freedFromAway: HallSlot[] = []
  for (const game of games) {
    if (game.type !== 'away' || game.status === 'postponed') continue
    const gameDate = game.date.slice(0, 10)
    const dayIndex = weekDays.findIndex((d) => toISODate(d) === gameDate)
    if (dayIndex === -1) continue

    for (const slot of realSlots) {
      if (
        slot.recurring &&
        slot.slot_type === 'training' &&
        slot.team === game.kscw_team &&
        slot.day_of_week === dayIndex
      ) {
        if (isClosedOnDate(slot.hall, gameDate, closures)) continue

        const claim = claimsByKey.get(`${slot.id}-${gameDate}`)
        const expanded = (slot as Record<string, unknown>).expand as Record<string, unknown> | undefined

        freedFromAway.push({
          ...slot,
          id: `freed-away-${game.id}-${slot.id}`,
          collectionName: 'virtual',
          _virtual: {
            source: 'game',
            sourceId: game.id,
            sourceRecord: game,
            isFreed: !claim,
            isClaimed: !!claim,
            claimRecord: claim,
          },
          expand: expanded,
        } as HallSlot)
      }
    }
  }

  // Spielhalle slots: when no home game occupies them, show as FREI/claimable
  // When a game IS scheduled, the normal suppression logic already removes them.
  const freedSpielhalleSlots: HallSlot[] = []
  for (const slot of realSlots) {
    if (!slot.recurring || !slot.label?.toLowerCase().includes('spielhalle')) continue
    for (let dayIdx = 0; dayIdx < weekDays.length; dayIdx++) {
      if (slot.day_of_week !== dayIdx) continue
      const dateStr = toISODate(weekDays[dayIdx])
      // Already suppressed by a game? Then game replaces it — don't also show as freed
      if (suppressedSlotDays.has(`${slot.id}-${dayIdx}`)) continue
      if (isClosedOnDate(slot.hall, dateStr, closures)) continue
      const claim = claimsByKey.get(`${slot.id}-${dateStr}`)
      const expanded = (slot as Record<string, unknown>).expand as Record<string, unknown> | undefined
      freedSpielhalleSlots.push({
        ...slot,
        id: `freed-spielhalle-${slot.id}-${dayIdx}`,
        collectionName: 'virtual',
        _virtual: {
          source: 'game' as const,
          sourceId: '',
          sourceRecord: {} as Game,
          isFreed: !claim,
          isClaimed: !!claim,
          claimRecord: claim,
          isSpielhalleFreed: true,
        },
        expand: expanded,
      } as HallSlot)
      // Suppress the original recurring slot so it doesn't also appear
      suppressedSlotDays.add(`${slot.id}-${dayIdx}`)
    }
  }

  // Annotate virtual slots with freed/claimed metadata
  const annotated = annotateFreedSlots(virtualSlots, claims, closures)

  // Build a set of home game time ranges per (dayIndex, hall) for suppressing virtual trainings
  const homeGameRanges: { dayIndex: number; hall: string; startMin: number; endMin: number }[] = []
  for (const game of games) {
    if (game.type === 'away' || game.status === 'postponed') continue
    const gameDate = game.date.slice(0, 10)
    const dayIndex = weekDays.findIndex((d) => toISODate(d) === gameDate)
    if (dayIndex === -1) continue
    const gameTime = game.time?.slice(0, 5)
    if (!gameTime || !game.hall) continue
    const gStart = Math.max(timeToMinutes(gameTime) - GAME_WARMUP_MINUTES, 0)
    const gEnd = Math.min(gStart + GAME_TOTAL_DURATION, 22 * 60)

    const gameTeam = teams.find((t) => t.id === game.kscw_team)
    const isBB = gameTeam?.sport === 'basketball'
    const gameHallIds = isBB
      ? halls.filter((h) => h.name === 'KWI A' || h.name === 'KWI B').map((h) => h.id)
      : [game.hall]

    for (const hid of gameHallIds) {
      homeGameRanges.push({ dayIndex, hall: hid, startMin: gStart, endMin: gEnd })
    }
  }

  // Add BB game hall events to homeGameRanges so they also suppress virtual trainings
  for (const vs of virtualSlots) {
    if (vs._virtual?.source !== 'hall_event' || vs.slot_type !== 'game') continue
    const bbHallIds = vs._virtual.spanHallIds ?? [vs.hall]
    const bbStart = timeToMinutes(vs.start_time)
    const bbEnd = timeToMinutes(vs.end_time)
    for (const hid of bbHallIds) {
      homeGameRanges.push({ dayIndex: vs.day_of_week, hall: hid, startMin: bbStart, endMin: bbEnd })
    }
  }

  // Build closure ranges from closure-like hall events
  const closureRanges: { dayIndex: number; hallIds: string[]; startMin: number; endMin: number }[] = []
  for (const vs of virtualSlots) {
    if (vs._virtual?.source !== 'hall_event') continue
    const he = vs._virtual.sourceRecord as HallEvent
    if (!CLOSURE_PATTERN.test(he.title)) continue
    const closureHallIds = he.hall?.length ? he.hall : [vs.hall]
    closureRanges.push({
      dayIndex: vs.day_of_week,
      hallIds: closureHallIds,
      startMin: timeToMinutes(vs.start_time),
      endMin: timeToMinutes(vs.end_time),
    })
  }

  // Remove virtual slots that are redundant or overlap with closures/games
  const filteredAnnotated = annotated.filter((vs) => {
    const dateStr = toISODate(weekDays[vs.day_of_week])

    // Suppress GCal "Halle geschlossen" events when a hall_closures record covers the same hall+date
    if (vs._virtual?.source === 'hall_event') {
      const he = vs._virtual.sourceRecord as HallEvent
      if (CLOSURE_PATTERN.test(he.title)) {
        const hallIds = vs._virtual.spanHallIds ?? [vs.hall]
        if (hallIds.every((hid) => isClosedOnDate(hid, dateStr, closures))) return false
      }
    }

    // Remove virtual trainings that overlap with a home game, closure event, or hall_closures record
    if (vs._virtual?.source === 'training') {
      if (dateStr && isClosedOnDate(vs.hall, dateStr, closures)) return false
      const vsStart = timeToMinutes(vs.start_time)
      const vsEnd = timeToMinutes(vs.end_time)
      if (homeGameRanges.some(
        (g) => g.dayIndex === vs.day_of_week && g.hall === vs.hall && vsStart < g.endMin && vsEnd > g.startMin,
      )) return false
      if (closureRanges.some(
        (c) => c.dayIndex === vs.day_of_week && c.hallIds.includes(vs.hall) && vsStart < c.endMin && vsEnd > c.startMin,
      )) return false
    }

    return true
  })

  return [...filteredReal, ...filteredAnnotated, ...freedFromAway, ...freedSpielhalleSlots]
}
