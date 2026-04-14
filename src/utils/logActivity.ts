import { createRecord, isAuthenticated, getCurrentMemberId } from '../lib/api'

type LogAction = 'create' | 'update' | 'delete'

/**
 * Fire-and-forget activity log. Never throws.
 */
export function logActivity(
  action: LogAction,
  collectionName: string,
  recordId?: string,
  data?: Record<string, unknown> | null,
): void {
  if (!isAuthenticated()) return
  const memberId = getCurrentMemberId()
  createRecord('user_logs', {
    action,
    collection_name: collectionName,
    record_id: recordId ? String(recordId) : null,
    data: data ?? null,
    ...(memberId != null && { user: Number(memberId) }),
  }).catch(() => {})
}
