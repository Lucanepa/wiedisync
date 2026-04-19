/**
 * Broadcast contract types — mirror the backend (`POST /kscw/activities/:type/:id/broadcast`).
 *
 * Sources of truth:
 *   - Endpoint: directus/extensions/kscw-endpoints/src/index.js (broadcast routes)
 *   - Spec:     Broadcast Plan 01 (B8 frontend hooks + types)
 */

export type ActivityType = 'event' | 'game' | 'training'

export interface BroadcastActivity {
  type: ActivityType
  id: number
  title: string
  start_date?: string
  location?: string
  teamName?: string
  sport?: 'volleyball' | 'basketball' | null
}

export interface BroadcastChannels {
  email?: boolean
  push?: boolean
  /** Currently unsupported on the backend (501 not_implemented). Forward-compat only. */
  inApp?: boolean
}

export type ParticipationStatus =
  | 'confirmed'
  | 'tentative'
  | 'declined'
  | 'waitlist'
  | 'interested'
  | 'invited'

export interface BroadcastAudience {
  statuses: ParticipationStatus[]
  includeExternals?: boolean
}

export interface BroadcastPayload {
  channels: BroadcastChannels
  audience: BroadcastAudience
  subject?: string
  message: string
}

export interface BroadcastResponse {
  broadcastId: number
  recipientCount: number
  breakdown: { members: number; externals: number }
  delivery: {
    email: { sent: number; failed: number; errors?: Array<{ recipient: string; error: string }> }
    push: { sent: number; failed: number; expired: number }
  }
  auditFailed?: boolean
}

export interface BroadcastPreviewResponse {
  recipientCount: number
  breakdown: { members: number; externals: number }
  sample: Array<{ name: string; kind: 'member' | 'external' }>
}

export interface BroadcastError {
  code: string
  message: string
  field?: string
  retryAfterSec?: number
}
