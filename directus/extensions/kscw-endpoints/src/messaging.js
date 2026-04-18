/**
 * KSCW Messaging — endpoint implementations (Plan 02+).
 *
 * Plan 02: GET /messaging/conversations implemented.
 * Plans 03-06 fill in the remaining routes.
 */

import {
  MessagingError, loadConversationMembership, requireAuth,
  requireMember, requireTeamChatEnabled, sendError, shapeConversationSummary,
} from './messaging-helpers.js'

const stub = (name) => (req, res) => res.status(501).json({
  code: 'messaging/not_implemented',
  message: `Route ${name} not implemented yet`,
  details: { route: name, method: req.method, path: req.path },
})

export function registerMessaging(router, ctx) {
  const { database: db, logger } = ctx
  const log = logger.child({ extension: 'kscw-messaging' })

  // ── GET /messaging/conversations ─────────────────────────────────────
  router.get('/messaging/conversations', async (req, res) => {
    try {
      const userId = requireAuth(req)
      const member = await requireMember(db, userId)

      // All non-archived memberships for this member
      const rows = await db('conversation_members as cm')
        .join('conversations as c', 'c.id', 'cm.conversation')
        .where('cm.member', member.id)
        .andWhere('cm.archived', false)
        .select(
          'c.id as id', 'c.type', 'c.team', 'c.title',
          'c.last_message_at', 'c.last_message_preview',
          'cm.muted', 'cm.last_read_at',
        )
        .orderByRaw('c.last_message_at DESC NULLS LAST')

      if (rows.length === 0) return res.json([])

      // Batch unread counts in one SQL: count messages per conversation
      // newer than last_read_at, exclude caller's own + soft-deleted.
      const convIds = rows.map(r => r.id)
      const unreadRows = await db('messages')
        .whereIn('conversation', convIds)
        .andWhereRaw('sender <> ?', [member.id])
        .andWhereRaw('deleted_at IS NULL')
        .andWhere(function () {
          // only count msgs after the caller's last_read_at for that conv
          this.where(function () {
            for (const r of rows) {
              if (r.last_read_at) {
                this.orWhere(function () {
                  this.where('conversation', r.id).andWhere('created_at', '>', r.last_read_at)
                })
              } else {
                this.orWhere('conversation', r.id)
              }
            }
          })
        })
        .select('conversation')
        .count('* as n')
        .groupBy('conversation')
      const unreadByConv = new Map(unreadRows.map(r => [String(r.conversation), Number(r.n)]))

      const summaries = rows.map(r => shapeConversationSummary({
        conv: {
          id: r.id, type: r.type, team: r.team, title: r.title,
          last_message_at: r.last_message_at, last_message_preview: r.last_message_preview,
        },
        membership: { muted: r.muted },
        unread_count: unreadByConv.get(String(r.id)) ?? 0,
      }))

      res.json(summaries)
    } catch (e) { sendError(res, log, e) }
  })

  // ── POST /messaging/messages ────────────────────────────────────────
  router.post('/messaging/messages', async (req, res) => {
    try {
      const userId = requireAuth(req)
      const member = await requireMember(db, userId)

      const b = req.body ?? {}
      const conversationId = typeof b.conversation === 'string' ? b.conversation : null
      const type = b.type === 'text' || b.type === 'poll' ? b.type : null
      const body = typeof b.body === 'string' ? b.body.trim() : ''

      if (!conversationId) {
        throw new MessagingError(400, 'messaging/invalid_body', 'conversation required')
      }
      if (type !== 'text') {
        // Plan 04 adds 'poll'. Reject everything else including unset.
        throw new MessagingError(400, 'messaging/invalid_body', 'type must be "text" in plan 02')
      }
      if (body.length < 1 || body.length > 4000) {
        throw new MessagingError(400, 'messaging/invalid_body', 'body must be 1..4000 chars')
      }

      const { conv } = await loadConversationMembership(db, conversationId, member.id)

      if (conv.type === 'team') {
        requireTeamChatEnabled(member)
      }
      // DM paths not implemented in Plan 02 — fall through for 'dm' conversations,
      // they just work as-long-as member is in the conversation_members; blocks are
      // enforced in Plan 03.

      // Atomic write: message INSERT + conversation denorm UPDATE.
      const preview = body.length > 120 ? body.slice(0, 117) + '...' : body
      const nowIso = new Date().toISOString()

      let inserted
      const newId = crypto.randomUUID()
      await db.transaction(async (trx) => {
        const [row] = await trx('messages')
          .insert({
            id: newId,
            conversation: conversationId,
            sender: member.id,
            type: 'text',
            body,
            created_at: nowIso,
          })
          .returning(['id', 'conversation', 'sender', 'type', 'body', 'poll',
                      'created_at', 'edited_at', 'deleted_at'])
        inserted = row

        await trx('conversations')
          .where('id', conversationId)
          .update({
            last_message_at: nowIso,
            last_message_preview: preview,
          })
      })

      // Denorm sender name for UI convenience
      inserted.sender_name = [member.first_name, member.last_name].filter(Boolean).join(' ') || null
      res.json(inserted)
    } catch (e) { sendError(res, log, e) }
  })

  // ── POST /messaging/conversations/:id/read ──────────────────────────
  router.post('/messaging/conversations/:id/read', async (req, res) => {
    try {
      const userId = requireAuth(req)
      const member = await requireMember(db, userId)
      const conversationId = req.params.id
      await loadConversationMembership(db, conversationId, member.id)

      const nowIso = new Date().toISOString()
      await db('conversation_members')
        .where({ conversation: conversationId, member: member.id })
        .update({ last_read_at: nowIso })

      res.json({ last_read_at: nowIso })
    } catch (e) { sendError(res, log, e) }
  })

  // ── POST /messaging/conversations/:id/mute ──────────────────────────
  router.post('/messaging/conversations/:id/mute', async (req, res) => {
    try {
      const userId = requireAuth(req)
      const member = await requireMember(db, userId)
      const conversationId = req.params.id
      const { membership } = await loadConversationMembership(db, conversationId, member.id)

      const newMuted = !(membership.muted === true)
      await db('conversation_members')
        .where({ conversation: conversationId, member: member.id })
        .update({ muted: newMuted })

      res.json({ muted: newMuted })
    } catch (e) { sendError(res, log, e) }
  })

  // ── GET /messaging/conversations/:id/messages ───────────────────────
  router.get('/messaging/conversations/:id/messages', async (req, res) => {
    try {
      const userId = requireAuth(req)
      const member = await requireMember(db, userId)
      const conversationId = req.params.id
      await loadConversationMembership(db, conversationId, member.id)

      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)
      const before = typeof req.query.before === 'string' ? req.query.before : null

      let q = db('messages as m')
        .leftJoin('members as s', 's.id', 'm.sender')
        .where('m.conversation', conversationId)
        .andWhereRaw('m.deleted_at IS NULL')
        .orderBy('m.created_at', 'desc')
        .limit(limit + 1)  // +1 to detect has_more
        .select(
          'm.id', 'm.conversation', 'm.sender', 'm.type', 'm.body',
          'm.poll', 'm.created_at', 'm.edited_at', 'm.deleted_at',
          's.first_name as sender_first_name', 's.last_name as sender_last_name',
        )
      if (before) q = q.andWhere('m.created_at', '<', before)

      const rows = await q
      const has_more = rows.length > limit
      const slice = has_more ? rows.slice(0, limit) : rows

      // Return chronological order (oldest first) for easier rendering
      slice.reverse()
      const messages = slice.map(r => ({
        id: r.id, conversation: r.conversation, sender: r.sender,
        type: r.type, body: r.body, poll: r.poll,
        created_at: r.created_at, edited_at: r.edited_at, deleted_at: r.deleted_at,
        sender_name: [r.sender_first_name, r.sender_last_name].filter(Boolean).join(' ') || null,
      }))

      res.json({ messages, has_more })
    } catch (e) { sendError(res, log, e) }
  })

  // ── The rest stay 501 for Plans 03-05 ───────────────────────────────
  router.post('/messaging/conversations/dm',              stub('POST /conversations/dm'))
  router.post('/messaging/conversations/:id/clear',       stub('POST /conversations/:id/clear'))
  router.patch('/messaging/messages/:id',                 stub('PATCH /messages/:id'))
  router.delete('/messaging/messages/:id',                stub('DELETE /messages/:id'))
  router.post('/messaging/messages/:id/reactions',        stub('POST /messages/:id/reactions'))
  router.post('/messaging/requests/:id/accept',           stub('POST /requests/:id/accept'))
  router.post('/messaging/requests/:id/decline',          stub('POST /requests/:id/decline'))
  router.post('/messaging/blocks',                        stub('POST /blocks'))
  router.delete('/messaging/blocks/:member',              stub('DELETE /blocks/:member'))
  router.post('/messaging/reports',                       stub('POST /reports'))
  router.get('/messaging/reports',                        stub('GET /reports'))
  router.patch('/messaging/reports/:id',                  stub('PATCH /reports/:id'))
  router.patch('/messaging/settings',                     stub('PATCH /settings'))
  router.post('/messaging/settings/consent',              stub('POST /settings/consent'))
  router.post('/messaging/export',                        stub('POST /export'))
}
