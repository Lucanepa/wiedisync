/**
 * Audit hook — server-authoritative writes to `user_logs`.
 *
 * Fires after items.create / items.update / items.delete on any collection
 * NOT in SKIP_COLLECTIONS. Resolves the acting Directus user to a member id
 * and writes one row per affected key. Failures are swallowed so we never
 * block the user's primary write.
 *
 * Replaces the 48 frontend `logActivity()` calls (which are spoofable / can be
 * bypassed by anyone hitting Directus directly). Keep both running until
 * dev verifies parity, then strip the client-side calls.
 *
 * Read side: kscw-endpoints/src/audit.js (POST /kscw/admin/audit).
 */

// Collections we never log — either Directus internals, our own audit table,
// or high-write / low-signal data that would drown the log.
const SKIP_COLLECTIONS = new Set([
  'user_logs',
  'directus_activity', 'directus_revisions', 'directus_sessions',
  'directus_presence', 'directus_notifications', 'directus_flows',
  'directus_operations', 'directus_settings', 'directus_extensions',
  'error_logs', 'sync_runs', 'kscw_migrations',
  // High-volume normal traffic:
  'notifications',
  'spielplaner_assignments',
  // Realtime / ephemeral:
  'messages_read_state', 'message_reactions',
])

const MAX_DATA_BYTES = 4096

function summarisePayload(payload) {
  if (payload == null) return null
  try {
    const s = JSON.stringify(payload)
    if (s.length <= MAX_DATA_BYTES) return payload
    return { _truncated: true, _bytes: s.length, preview: s.slice(0, MAX_DATA_BYTES) }
  } catch {
    return null
  }
}

export function registerAuditHook({ action }, { database, logger }) {
  const log = logger.child({ hook: 'audit' })

  async function resolveMemberId(directusUserId) {
    if (!directusUserId) return null
    try {
      const row = await database('members').where({ user: directusUserId }).first('id')
      return row?.id ?? null
    } catch {
      return null
    }
  }

  async function writeLog({ collection, recordId, actionType, data, accountability }) {
    if (!collection || SKIP_COLLECTIONS.has(collection)) return
    if (collection.startsWith('directus_')) return
    // Skip system / cron writes (no user) — they're traceable via container logs.
    if (!accountability?.user) return

    try {
      const memberId = await resolveMemberId(accountability.user)
      await database('user_logs').insert({
        action: actionType,
        collection_name: collection,
        record_id: recordId != null ? String(recordId) : null,
        data: data == null ? null : JSON.stringify(data),
        user: memberId,
        date_created: new Date(),
      })
    } catch (err) {
      log.warn({ msg: `audit insert failed: ${err.message}`, collection, recordId, actionType })
    }
  }

  action('items.create', async ({ collection, key, payload }, ctx) => {
    await writeLog({
      collection, recordId: key, actionType: 'create',
      data: summarisePayload(payload), accountability: ctx.accountability,
    })
  })

  action('items.update', async ({ collection, keys, payload }, ctx) => {
    const data = summarisePayload(payload)
    for (const k of keys || []) {
      await writeLog({
        collection, recordId: k, actionType: 'update',
        data, accountability: ctx.accountability,
      })
    }
  })

  action('items.delete', async ({ collection, keys }, ctx) => {
    for (const k of keys || []) {
      await writeLog({
        collection, recordId: k, actionType: 'delete',
        data: null, accountability: ctx.accountability,
      })
    }
  })

  log.info('Audit hook loaded — server-authoritative user_logs writes')
}
