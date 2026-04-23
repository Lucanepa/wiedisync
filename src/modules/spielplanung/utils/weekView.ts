import { startOfWeek, eachDayOfInterval } from '../../../utils/dateUtils'
import { getBlockWindow } from './gameBlock'

/** First visible hour in the week view time rail. */
export const WEEK_START_HOUR = 14
/** Last visible hour in the week view time rail (exclusive). */
export const WEEK_END_HOUR = 22

/** Returns the 7 days of the Monday-started week containing `anchor`. */
export function getWeekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return eachDayOfInterval(start, end)
}

function parseHHMM(time: string): number | null {
  const [hStr, mStr] = time.split(':')
  const h = parseInt(hStr ?? '', 10)
  const m = parseInt(mStr ?? '0', 10)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

/**
 * Pixel top/height for a game block within a day column.
 * Returns null when the block falls entirely outside the visible window
 * or the time is unparseable. Clamps blocks that straddle the edges.
 */
export function getBlockPixelPosition(
  startTime: string,
  pxPerHour: number,
): { top: number; height: number } | null {
  if (!startTime) return null
  let block
  try {
    block = getBlockWindow(startTime)
  } catch {
    return null
  }
  const startMin = parseHHMM(block.start)
  const endMin = parseHHMM(block.end)
  if (startMin === null || endMin === null) return null

  const windowStartMin = WEEK_START_HOUR * 60
  const windowEndMin = WEEK_END_HOUR * 60

  if (endMin <= windowStartMin) return null
  if (startMin >= windowEndMin) return null

  const clampedStart = Math.max(startMin, windowStartMin)
  const clampedEnd = Math.min(endMin, windowEndMin)
  const top = ((clampedStart - windowStartMin) / 60) * pxPerHour
  const height = ((clampedEnd - clampedStart) / 60) * pxPerHour
  return { top, height }
}
