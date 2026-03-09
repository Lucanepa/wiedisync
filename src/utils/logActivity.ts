import pb from '../pb'

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
  const userId = pb.authStore.record?.id
  if (!userId) return

  pb.collection('user_logs')
    .create({
      user: userId,
      action,
      collection_name: collectionName,
      record_id: recordId ?? '',
      data: data ?? null,
    })
    .catch(() => {})
}
