import { useEffect, useRef, useState } from 'react'
import { postBroadcastPreview } from './api'
import type {
  ActivityType,
  BroadcastAudience,
  BroadcastError,
  BroadcastPreviewResponse,
} from './types'

interface ActivityRef {
  type: ActivityType
  id: number | string
}

interface UseBroadcastPreviewOptions {
  /** Default 300ms. */
  debounceMs?: number
}

export interface UseBroadcastPreviewResult {
  preview: BroadcastPreviewResponse | null
  loading: boolean
  error: BroadcastError | null
}

function toBroadcastError(err: unknown): BroadcastError {
  const e = err as { code?: string; message?: string; field?: string; retryAfterSec?: number }
  return {
    code: e?.code ?? 'unknown',
    message: e?.message ?? 'Unknown error',
    ...(e?.field ? { field: e.field } : {}),
    ...(typeof e?.retryAfterSec === 'number' ? { retryAfterSec: e.retryAfterSec } : {}),
  }
}

/**
 * Debounced preview hook — re-fetches whenever activity or audience change.
 * Returns `preview: null` when activity or audience is missing.
 *
 * Race-safety: each effect run claims a generation token; stale responses are dropped.
 */
export function useBroadcastPreview(
  activity: ActivityRef | null,
  audience: BroadcastAudience | null,
  options: UseBroadcastPreviewOptions = {},
): UseBroadcastPreviewResult {
  const debounceMs = options.debounceMs ?? 300

  const [preview, setPreview] = useState<BroadcastPreviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<BroadcastError | null>(null)

  // Track the latest in-flight request — older results are ignored.
  const genRef = useRef(0)

  // Stable serialization of the inputs so we only re-run on real changes.
  // (Hook deps are scalars/arrays Vite/React-compiler can't compare deeply.)
  const activityKey = activity ? `${activity.type}:${String(activity.id)}` : ''
  const audienceKey = audience
    ? JSON.stringify({
        statuses: [...audience.statuses].sort(),
        includeExternals: !!audience.includeExternals,
      })
    : ''

  useEffect(() => {
    if (!activity || !audience) {
      setPreview(null)
      setLoading(false)
      setError(null)
      return
    }

    const myGen = ++genRef.current
    setLoading(true)
    setError(null)

    const timer = setTimeout(async () => {
      try {
        const res = await postBroadcastPreview(activity, audience)
        if (myGen !== genRef.current) return
        setPreview(res)
      } catch (err) {
        if (myGen !== genRef.current) return
        setError(toBroadcastError(err))
        setPreview(null)
      } finally {
        if (myGen === genRef.current) setLoading(false)
      }
    }, debounceMs)

    return () => {
      clearTimeout(timer)
      // Mark this run stale so a late resolve doesn't clobber state.
      if (myGen === genRef.current) genRef.current++
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityKey, audienceKey, debounceMs])

  return { preview, loading, error }
}
