import { createItem } from '@directus/sdk'
import directus, { getAccessToken } from '../directus'

type LogAction = 'create' | 'update' | 'delete'

/**
 * Fire-and-forget activity log. Never throws — errors are silently swallowed
 * so logging never breaks the actual user action.
 */
export function logActivity(
  action: LogAction,
  collectionName: string,
  recordId?: string,
  data?: Record<string, unknown> | null,
): void {
  if (!getAccessToken()) return

  directus.request(createItem('user_logs', {
    action,
    collection_name: collectionName,
    record_id: recordId ?? '',
    data: data ?? null,
  })).catch(() => {})
}
