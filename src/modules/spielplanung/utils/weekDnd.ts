export const SNAP_STEP_MINUTES = 15

/** Convert a vertical pixel delta into snapped minutes. */
export function pixelDeltaToSnappedMinutes(deltaPx: number, pxPerHour: number): number {
  const rawMin = (deltaPx / pxPerHour) * 60
  return Math.round(rawMin / SNAP_STEP_MINUTES) * SNAP_STEP_MINUTES
}

function toHHMM(totalMin: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMin))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Add `deltaMinutes` to an `HH:MM` or `HH:MM:SS` time, clamped to [00:00, 23:59]. */
export function applyTimeDelta(time: string, deltaMinutes: number): string {
  const [hStr, mStr] = time.split(':')
  const h = parseInt(hStr ?? '0', 10)
  const m = parseInt(mStr ?? '0', 10)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time
  return toHHMM(h * 60 + m + deltaMinutes)
}
