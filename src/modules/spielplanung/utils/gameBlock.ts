/**
 * Time-block math for game scheduling.
 *
 * A game occupies a 2h 45min window: 45min warm-up buffer before the
 * scheduled start + 2h of play. Same for volleyball and basketball.
 */

const WARMUP_MINUTES = 45
const GAME_MINUTES = 120 // 2h

export interface TimeBlock {
  /** Inclusive start in 'HH:MM' (may exceed 24:00 on late games — caller's problem). */
  start: string
  /** Exclusive end in 'HH:MM' (may exceed 24:00). */
  end: string
}

function parseHHMM(time: string): number {
  // Accept 'HH:MM' or 'HH:MM:SS'
  const [hStr, mStr] = time.split(':')
  const h = parseInt(hStr ?? '0', 10)
  const m = parseInt(mStr ?? '0', 10)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN
  return h * 60 + m
}

function formatHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Given a game start time, return the full occupied window (warmup + play).
 * Throws on unparseable input.
 */
export function getBlockWindow(startTime: string): TimeBlock {
  const startMin = parseHHMM(startTime)
  if (Number.isNaN(startMin)) {
    throw new Error(`gameBlock: unparseable time "${startTime}"`)
  }
  return {
    start: formatHHMM(startMin - WARMUP_MINUTES),
    end: formatHHMM(startMin + GAME_MINUTES),
  }
}

/** True if two time blocks overlap on a single calendar day. */
export function blocksOverlap(a: TimeBlock, b: TimeBlock): boolean {
  const aStart = parseHHMM(a.start)
  const aEnd = parseHHMM(a.end)
  const bStart = parseHHMM(b.start)
  const bEnd = parseHHMM(b.end)
  return aStart < bEnd && bStart < aEnd
}
