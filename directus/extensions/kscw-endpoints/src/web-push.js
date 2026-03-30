/**
 * Web Push Notification Endpoints
 *
 * Manages push subscriptions and sends push via Cloudflare Worker.
 * Migrated from PocketBase hooks: push_subscriptions.pb.js + push_lib.js
 *
 * Endpoints:
 *   GET  /kscw/web-push/vapid-public-key  — public VAPID key
 *   POST /kscw/web-push/subscribe         — register/update subscription (auth)
 *   POST /kscw/web-push/unsubscribe       — remove subscription (auth)
 *   POST /kscw/web-push/test              — send test push (admin only)
 */

import { FRONTEND_URL } from './email-template.js'

const VAPID_PUBLIC_KEY = 'BKJqU0d09bzpCWv6Goq-_24NxBLHHwGkjrUrRQsyIDoECVIE5nBBFw8g3j_hjBRhOlJL2YU72b_5R_SxFedMBQs'
const PUSH_WORKER_URL = process.env.PUSH_WORKER_URL || 'https://kscw-push.lucanepa.workers.dev'
const PUSH_AUTH_SECRET = process.env.PUSH_AUTH_SECRET || ''

// ── Helper: send push to a single member ────────────────────────────

export async function sendPushToMember(db, memberId, title, body, url, tag, log) {
  if (!memberId) return { sent: 0, failed: 0, cleaned: 0 }

  const subscriptions = await db('push_subscriptions')
    .where('member', memberId)
    .select('id', 'endpoint', 'p256dh', 'auth')

  if (subscriptions.length === 0) return { sent: 0, failed: 0, cleaned: 0 }

  return _sendPush(db, subscriptions, title, body, url, tag, log)
}

// ── Helper: send push to multiple members ───────────────────────────

export async function sendPushToMembers(db, memberIds, title, body, url, tag, log) {
  if (!memberIds || memberIds.length === 0) return { sent: 0, failed: 0, cleaned: 0 }

  const subscriptions = await db('push_subscriptions')
    .whereIn('member', memberIds)
    .select('id', 'endpoint', 'p256dh', 'auth')

  if (subscriptions.length === 0) return { sent: 0, failed: 0, cleaned: 0 }

  return _sendPush(db, subscriptions, title, body, url, tag, log)
}

// ── Internal: call CF Worker and clean up expired subs ──────────────

async function _sendPush(db, subscriptions, title, body, url, tag, log) {
  const subs = subscriptions.map(s => ({
    endpoint: s.endpoint,
    keys: { p256dh: s.p256dh, auth: s.auth },
  }))

  const result = { sent: 0, failed: 0, cleaned: 0 }

  try {
    const resp = await fetch(`${PUSH_WORKER_URL}/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PUSH_AUTH_SECRET}`,
      },
      body: JSON.stringify({
        subscriptions: subs,
        title: title || 'KSC Wiedikon',
        body: body || '',
        url: url || FRONTEND_URL,
        ...(tag ? { tag } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (resp.ok) {
      const data = await resp.json()
      result.sent = data.sent || 0
      result.failed = data.failed || 0

      // Clean up expired/gone subscriptions
      if (data.expired?.length > 0) {
        for (const endpoint of data.expired) {
          try {
            const deleted = await db('push_subscriptions').where('endpoint', endpoint).delete()
            if (deleted > 0) result.cleaned++
          } catch { /* ignore */ }
        }
      }
    } else {
      log?.warn?.(`[push] Worker returned ${resp.status}`)
    }
  } catch (err) {
    log?.error?.(`[push] Worker call failed: ${err.message}`)
  }

  return result
}

// ── Register routes ─────────────────────────────────────────────────

export function registerWebPush(router, ctx) {
  const { database, logger } = ctx
  const log = logger.child({ extension: 'kscw-web-push' })

  // GET /kscw/web-push/vapid-public-key — public, no auth
  router.get('/web-push/vapid-public-key', (_req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY })
  })

  // POST /kscw/web-push/subscribe — upsert subscription (auth required)
  router.post('/web-push/subscribe', async (req, res) => {
    try {
      if (!req.accountability?.user) return res.status(401).json({ error: 'Authentication required' })

      const userId = req.accountability.user
      const member = await database('members').where('user', userId).select('id').first()
      if (!member) return res.status(400).json({ error: 'Member not found' })

      const { endpoint, keys_p256dh, keys_auth, user_agent } = req.body
      if (!endpoint || !keys_p256dh || !keys_auth) {
        return res.status(400).json({ error: 'endpoint, keys_p256dh, and keys_auth are required' })
      }

      // Upsert by member+endpoint
      const existing = await database('push_subscriptions')
        .where('member', member.id)
        .where('endpoint', endpoint)
        .first()

      if (existing) {
        await database('push_subscriptions').where('id', existing.id).update({
          p256dh: keys_p256dh,
          auth: keys_auth,
          user_agent: user_agent || '',
        })
        log.info(`Updated push subscription for member ${member.id}`)
        return res.json({ success: true, updated: true })
      }

      await database('push_subscriptions').insert({
        member: member.id,
        endpoint,
        p256dh: keys_p256dh,
        auth: keys_auth,
        user_agent: user_agent || '',
      })

      log.info(`New push subscription for member ${member.id}`)
      res.status(201).json({ success: true, created: true })
    } catch (err) {
      log.error(`web-push/subscribe: ${err.message}`)
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // POST /kscw/web-push/unsubscribe — remove subscription (auth required)
  router.post('/web-push/unsubscribe', async (req, res) => {
    try {
      if (!req.accountability?.user) return res.status(401).json({ error: 'Authentication required' })

      const userId = req.accountability.user
      const member = await database('members').where('user', userId).select('id').first()
      if (!member) return res.status(400).json({ error: 'Member not found' })

      const { endpoint } = req.body
      if (!endpoint) return res.status(400).json({ error: 'endpoint is required' })

      await database('push_subscriptions')
        .where('member', member.id)
        .where('endpoint', endpoint)
        .delete()

      log.info(`Unsubscribed push for member ${member.id}`)
      res.json({ success: true })
    } catch (err) {
      log.error(`web-push/unsubscribe: ${err.message}`)
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // POST /kscw/web-push/test — send test push (admin only)
  router.post('/web-push/test', async (req, res) => {
    try {
      if (!req.accountability?.admin) return res.status(403).json({ error: 'Admin access required' })

      const { member_id, title, body, url } = req.body

      // Default to current user's member
      let memberId = member_id
      if (!memberId) {
        const member = await database('members').where('user', req.accountability.user).select('id').first()
        memberId = member?.id
      }
      if (!memberId) return res.status(400).json({ error: 'member_id required' })

      const result = await sendPushToMember(
        database, memberId,
        title || 'Test Push',
        body || 'This is a test notification from KSC Wiedikon.',
        url || FRONTEND_URL,
        'test', log,
      )

      log.info(`Test push to member ${memberId}: ${JSON.stringify(result)}`)
      res.json(result)
    } catch (err) {
      log.error(`web-push/test: ${err.message}`)
      res.status(500).json({ error: 'Internal error' })
    }
  })
}
