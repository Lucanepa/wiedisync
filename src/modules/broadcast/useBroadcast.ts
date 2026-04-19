import { useCallback, useState } from 'react'
import { postBroadcast } from './api'
import type {
  ActivityType,
  BroadcastError,
  BroadcastPayload,
  BroadcastResponse,
} from './types'

interface ActivityRef {
  type: ActivityType
  id: number | string
}

/**
 * Parse a `kscwApi` error into the structured `BroadcastError` shape the UI consumes.
 *
 * `kscwApi` attaches `code` to the thrown Error when the response body contains one,
 * but does NOT surface `field` / `retryAfterSec`. Those live on the original response
 * body — to keep this hook self-contained and avoid changing the shared API client,
 * we surface code + message here and let callers fall back to `unknown` when needed.
 */
function toBroadcastError(err: unknown): BroadcastError {
  const e = err as { code?: string; message?: string; field?: string; retryAfterSec?: number }
  return {
    code: e?.code ?? 'unknown',
    message: e?.message ?? 'Unknown error',
    ...(e?.field ? { field: e.field } : {}),
    ...(typeof e?.retryAfterSec === 'number' ? { retryAfterSec: e.retryAfterSec } : {}),
  }
}

export interface UseBroadcastResult {
  send: (activity: ActivityRef, payload: BroadcastPayload) => Promise<BroadcastResponse>
  sending: boolean
  error: BroadcastError | null
  lastResult: BroadcastResponse | null
  reset: () => void
}

/**
 * Imperative hook — call `send(activity, payload)` to broadcast.
 * Tracks a single in-flight request; concurrent calls overwrite `error` / `lastResult`.
 */
export function useBroadcast(): UseBroadcastResult {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<BroadcastError | null>(null)
  const [lastResult, setLastResult] = useState<BroadcastResponse | null>(null)

  const send = useCallback(
    async (activity: ActivityRef, payload: BroadcastPayload): Promise<BroadcastResponse> => {
      setSending(true)
      setError(null)
      try {
        const res = await postBroadcast(activity, payload)
        setLastResult(res)
        return res
      } catch (err) {
        const be = toBroadcastError(err)
        setError(be)
        throw err
      } finally {
        setSending(false)
      }
    },
    [],
  )

  const reset = useCallback(() => {
    setError(null)
    setLastResult(null)
  }, [])

  return { send, sending, error, lastResult, reset }
}
