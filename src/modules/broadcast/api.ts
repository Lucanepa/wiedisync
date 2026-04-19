import { kscwApi } from '../../lib/api'
import type {
  ActivityType,
  BroadcastAudience,
  BroadcastPayload,
  BroadcastPreviewResponse,
  BroadcastResponse,
} from './types'

interface ActivityRef {
  type: ActivityType
  id: number | string
}

/**
 * Send a broadcast to participants of an activity.
 * Backend: `POST /kscw/activities/:type/:id/broadcast`
 */
export function postBroadcast(
  activity: ActivityRef,
  payload: BroadcastPayload,
): Promise<BroadcastResponse> {
  return kscwApi<BroadcastResponse>(
    `/activities/${activity.type}/${activity.id}/broadcast`,
    { method: 'POST', body: payload },
  )
}

/**
 * Preview a broadcast — same auth/audience resolution as a real send, but no delivery.
 * Backend: `POST /kscw/activities/:type/:id/broadcast/preview`
 *
 * The backend currently expects the audience under `audience` (mirroring the real send),
 * so we forward the same shape.
 */
export function postBroadcastPreview(
  activity: ActivityRef,
  audience: BroadcastAudience,
): Promise<BroadcastPreviewResponse> {
  return kscwApi<BroadcastPreviewResponse>(
    `/activities/${activity.type}/${activity.id}/broadcast/preview`,
    { method: 'POST', body: { audience } },
  )
}
