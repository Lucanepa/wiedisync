/**
 * KSCW Messaging — endpoint implementations (Plan 02+).
 *
 * Plan 02: GET /messaging/conversations implemented.
 * Plans 03-06 fill in the remaining routes.
 */

import {
  MessagingError, loadConversationMembership, requireAuth,
  requireMember, requireTeamChatEnabled, requireDmEnabled,
  sendError, shapeConversationSummary,
  loadBlocks, shareTeam, findExistingDmConversation, checkDeclineCooldown,
  requireRequestRecipient,
} from './messaging-helpers.js'

const stub = (name) => (req, res) => res.status(501).json({
  code: 'messaging/not_implemented',
  message: `Route ${name} not implemented yet`,
  details: { route: name, method: req.method, path: req.path },
})

export function registerMessaging(router, ctx) {
  const { database: db, logger, services, getSchema } = ctx
  const { ItemsService } = services
  const log = logger.child({ extension: 'kscw-messaging' })

  // ── GET /messaging/conversations ─────────────────────────────────────
  router.get('/messaging/conversations', async (req, res) => {
    try {
      const userId = requireAuth(req)
      const member = await requireMember(db, userId)

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

      // Load blocks once (for DM invisibility)
      const { either: blockedEither } = await loadBlocks(db, member.id)

      // Batch "other member" lookup for all dm / dm_request conversations
      const dmLikeIds = rows
        .filter(r => r.type === 'dm' || r.type === 'dm_request')
        .map(r => r.id)
      const otherByConv = new Map()
      if (dmLikeIds.length > 0) {
        const otherRows = await db('conversation_members')
          .whereIn('conversation', dmLikeIds)
          .andWhere('member', '<>', member.id)
          .select('conversation', 'member')
        for (const r of otherRows) otherByConv.set(String(r.conversation), String(r.member))
      }

      // Batch message_requests rows for dm_request conversations
      const requestIds = rows.filter(r => r.type === 'dm_request').map(r => r.id)
      const reqByConv = new Map()
      if (requestIds.length > 0) {
        const reqRows = await db('message_requests')
          .whereIn('conversation', requestIds)
          .select('conversation', 'sender', 'recipient', 'status')
        for (const r of reqRows) reqByConv.set(String(r.conversation), r)
      }

      // Visibility filter
      const visible = rows.filter(r => {
        if (r.type === 'dm' || r.type === 'dm_request') {
          const other = otherByConv.get(String(r.id))
          if (!other) return false
          if (blockedEither.has(other)) return false
        }
        if (r.type === 'dm_request') {
          const rq = reqByConv.get(String(r.id))
          if (!rq) return false
          // Sender-silent on decline: don't surface declined requests to the sender
          if (rq.status === 'declined' && String(rq.sender) === String(member.id)) return false
        }
        return true
      })

      if (visible.length === 0) return res.json([])

      // Batch unread counts — scoped to visible ids (preserves Plan 02's pattern)
      const visibleIds = visible.map(r => r.id)
      const unreadRows = await db('messages')
        .whereIn('conversation', visibleIds)
        .andWhereRaw('sender <> ?', [member.id])
        .andWhereRaw('deleted_at IS NULL')
        .andWhere(function () {
          this.where(function () {
            for (const r of visible) {
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

      const summaries = visible.map(r => {
        const rq = r.type === 'dm_request' ? reqByConv.get(String(r.id)) : null
        const summary = shapeConversationSummary({
          conv: {
            id: r.id, type: r.type, team: r.team, title: r.title,
            last_message_at: r.last_message_at, last_message_preview: r.last_message_preview,
          },
          membership: { muted: r.muted },
          unread_count: unreadByConv.get(String(r.id)) ?? 0,
        })
        if (rq) summary.request_status = rq.status
        if (r.type === 'dm' || r.type === 'dm_request') {
          summary.other_member = otherByConv.get(String(r.id)) ?? null
        }
        return summary
      })

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
        throw new MessagingError(400, 'messaging/invalid_body', 'type must be "text"')
      }
      if (body.length < 1 || body.length > 4000) {
        throw new MessagingError(400, 'messaging/invalid_body', 'body must be 1..4000 chars')
      }

      const { conv } = await loadConversationMembership(db, conversationId, member.id)

      if (conv.type === 'team') {
        requireTeamChatEnabled(member)
        // Block-check on team conversations: do NOT reject the send; blocks only
        // filter reads server-side (spec §7) so other non-blocked members still see it.
      } else if (conv.type === 'dm' || conv.type === 'dm_request') {
        requireDmEnabled(member)
        const others = await db('conversation_members')
          .where('conversation', conv.id)
          .andWhere('member', '<>', member.id)
          .select('member')
        const otherId = others[0]?.member
        if (otherId != null) {
          const { either } = await loadBlocks(db, member.id)
          if (either.has(String(otherId))) {
            throw new MessagingError(403, 'messaging/blocked',
              'Messaging is blocked between you and this member')
          }
        }
      } else {
        throw new MessagingError(400, 'messaging/invalid_body',
          `Unsupported conversation type: ${conv.type}`)
      }

      // Write via ItemsService so Directus realtime broadcasts the create.
      // Raw-knex inserts bypass ItemsService's emit pipeline, so any subscriber
      // (the frontend useRealtime hook on the `messages` collection) would
      // never hear the new message. Admin-scoped service is safe here: policy
      // (membership, opt-in) has already been enforced above.
      const preview = body.length > 120 ? body.slice(0, 117) + '...' : body
      const nowIso = new Date().toISOString()
      const schema = await getSchema()

      const messagesService = new ItemsService('messages', { schema, knex: db })
      const conversationsService = new ItemsService('conversations', { schema, knex: db })

      const newId = crypto.randomUUID()
      await messagesService.createOne({
        id: newId,
        conversation: conversationId,
        sender: member.id,
        type: 'text',
        body,
        created_at: nowIso,
      })
      // Denorm — also via service so conversations.update emits for any future
      // subscriber (Plan 03 uses this for preview updates in the inbox list).
      await conversationsService.updateOne(conversationId, {
        last_message_at: nowIso,
        last_message_preview: preview,
      })

      const inserted = {
        id: newId,
        conversation: conversationId,
        sender: member.id,
        type: 'text',
        body,
        poll: null,
        created_at: nowIso,
        edited_at: null,
        deleted_at: null,
        sender_name: [member.first_name, member.last_name].filter(Boolean).join(' ') || null,
      }
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

      const { either: blockedEither } = await loadBlocks(db, member.id)
      const blockedIds = [...blockedEither]

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
      if (blockedIds.length > 0) q = q.whereNotIn('m.sender', blockedIds)
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

  // ── POST /messaging/conversations/dm ────────────────────────────────
  router.post('/messaging/conversations/dm', async (req, res) => {
    try {
      const userId = requireAuth(req)
      const me = await requireMember(db, userId)
      requireDmEnabled(me)

      const b = req.body ?? {}
      const recipientId = b.recipient != null ? String(b.recipient) : null
      if (!recipientId) throw new MessagingError(400, 'messaging/invalid_body', 'recipient required')
      if (recipientId === String(me.id))
        throw new MessagingError(400, 'messaging/invalid_body', 'cannot DM yourself')

      const other = await db('members').where('id', recipientId).first()
      if (!other) throw new MessagingError(400, 'messaging/invalid_body', 'recipient not found')
      if (other.communications_banned === true)
        throw new MessagingError(403, 'messaging/comms_disabled', 'Recipient cannot receive messages')
      if (other.communications_dm_enabled !== true)
        throw new MessagingError(403, 'messaging/comms_disabled',
          'Recipient has direct messages disabled')

      const { either } = await loadBlocks(db, me.id)
      if (either.has(String(recipientId)))
        throw new MessagingError(403, 'messaging/blocked', 'Messaging is blocked between you and this member')

      const existing = await findExistingDmConversation(db, me.id, recipientId)
      if (existing) {
        const code = existing.type === 'dm' ? 'messaging/conversation_exists' : 'messaging/request_pending'
        return res.status(409).json({
          code,
          message: existing.type === 'dm' ? 'DM already exists' : 'DM request already pending',
          conversation_id: existing.id,
          type: existing.type,
        })
      }

      await checkDeclineCooldown(db, me.id, recipientId)

      const sharesTeam = await shareTeam(db, me.id, recipientId)
      const convType = sharesTeam ? 'dm' : 'dm_request'

      const schema = await getSchema()
      const conversationsService = new ItemsService('conversations', { schema, knex: db })
      const convMembersService   = new ItemsService('conversation_members', { schema, knex: db })
      const requestsService      = new ItemsService('message_requests', { schema, knex: db })

      const convId = crypto.randomUUID()
      const nowIso = new Date().toISOString()

      await conversationsService.createOne({
        id: convId, type: convType, team: null, title: null,
        created_by: me.id, created_at: nowIso,
      })
      await convMembersService.createMany([
        { id: crypto.randomUUID(), conversation: convId, member: me.id,       archived: false, role: 'member', joined_at: nowIso },
        { id: crypto.randomUUID(), conversation: convId, member: recipientId, archived: false, role: 'member', joined_at: nowIso },
      ])

      let requestStatus = null
      if (convType === 'dm_request') {
        await requestsService.createOne({
          id: crypto.randomUUID(), conversation: convId,
          sender: me.id, recipient: recipientId,
          status: 'pending', created_at: nowIso,
        })
        requestStatus = 'pending'
      }

      res.json({
        conversation_id: convId,
        created: true,
        type: convType,
        request_status: requestStatus,
      })
    } catch (e) { sendError(res, log, e) }
  })

  // ── POST /messaging/requests/:id/accept ─────────────────────────────
  router.post('/messaging/requests/:id/accept', async (req, res) => {
    try {
      const userId = requireAuth(req)
      const me = await requireMember(db, userId)
      requireDmEnabled(me)
      const { req: reqRow } = await requireRequestRecipient(db, req.params.id, me.id)

      const schema = await getSchema()
      const requestsService = new ItemsService('message_requests', { schema, knex: db })
      const conversationsService = new ItemsService('conversations', { schema, knex: db })
      const nowIso = new Date().toISOString()

      await requestsService.updateOne(reqRow.id, { status: 'accepted', resolved_at: nowIso })
      await conversationsService.updateOne(reqRow.conversation, { type: 'dm' })

      res.json({ conversation_id: reqRow.conversation, status: 'accepted' })
    } catch (e) { sendError(res, log, e) }
  })

  // ── POST /messaging/requests/:id/decline ────────────────────────────
  router.post('/messaging/requests/:id/decline', async (req, res) => {
    try {
      const userId = requireAuth(req)
      const me = await requireMember(db, userId)
      const { req: reqRow } = await requireRequestRecipient(db, req.params.id, me.id)

      const schema = await getSchema()
      const requestsService = new ItemsService('message_requests', { schema, knex: db })
      const nowIso = new Date().toISOString()

      await requestsService.updateOne(reqRow.id, { status: 'declined', resolved_at: nowIso })
      res.json({ conversation_id: reqRow.conversation, status: 'declined' })
    } catch (e) { sendError(res, log, e) }
  })

  // ── POST /messaging/blocks ──────────────────────────────────────────
  router.post('/messaging/blocks', async (req, res) => {
    try {
      const userId = requireAuth(req)
      const me = await requireMember(db, userId)
      const targetId = req.body?.member != null ? String(req.body.member) : null
      if (!targetId) throw new MessagingError(400, 'messaging/invalid_body', 'member required')
      if (targetId === String(me.id))
        throw new MessagingError(400, 'messaging/invalid_body', 'cannot block yourself')

      const other = await db('members').where('id', targetId).first()
      if (!other) throw new MessagingError(400, 'messaging/invalid_body', 'member not found')

      const existing = await db('blocks').where({ blocker: me.id, blocked: targetId }).first()
      if (existing) return res.json({ blocked: targetId, created: false })

      const schema = await getSchema()
      const blocksService = new ItemsService('blocks', { schema, knex: db })
      await blocksService.createOne({
        id: crypto.randomUUID(), blocker: me.id, blocked: targetId,
        created_at: new Date().toISOString(),
      })
      res.json({ blocked: targetId, created: true })
    } catch (e) { sendError(res, log, e) }
  })

  // ── DELETE /messaging/blocks/:member ────────────────────────────────
  router.delete('/messaging/blocks/:member', async (req, res) => {
    try {
      const userId = requireAuth(req)
      const me = await requireMember(db, userId)
      const targetId = String(req.params.member)

      const row = await db('blocks').where({ blocker: me.id, blocked: targetId }).first()
      if (!row) return res.json({ unblocked: targetId, removed: false })

      const schema = await getSchema()
      const blocksService = new ItemsService('blocks', { schema, knex: db })
      await blocksService.deleteOne(row.id)
      res.json({ unblocked: targetId, removed: true })
    } catch (e) { sendError(res, log, e) }
  })

  // ── PATCH /messaging/settings ───────────────────────────────────────
  router.patch('/messaging/settings', async (req, res) => {
    try {
      const userId = requireAuth(req)
      const me = await requireMember(db, userId)

      const b = req.body ?? {}
      const patch = {}
      if (typeof b.team_chat_enabled === 'boolean')    patch.communications_team_chat_enabled = b.team_chat_enabled
      if (typeof b.dm_enabled === 'boolean')           patch.communications_dm_enabled        = b.dm_enabled
      if (typeof b.push_preview_content === 'boolean') patch.push_preview_content             = b.push_preview_content
      if (Object.keys(patch).length === 0) {
        throw new MessagingError(400, 'messaging/invalid_body', 'no known settings keys in body')
      }

      // Respect admin-forced ban — user cannot flip it off themselves.
      if (me.communications_banned === true) {
        throw new MessagingError(403, 'messaging/banned', 'Your messaging access is disabled')
      }

      // Use ItemsService so Plan 01's trg_messaging_member_team_chat_enabled fires
      // (archives/un-archives conversation_members) and any Directus subscribers
      // get the update event.
      const schema = await getSchema()
      const membersService = new ItemsService('members', { schema, knex: db })
      await membersService.updateOne(me.id, patch)
      res.json({ updated: Object.keys(patch) })
    } catch (e) { sendError(res, log, e) }
  })

  // ── The rest stay 501 for Plans 03-05 ───────────────────────────────
  router.post('/messaging/conversations/:id/clear',       stub('POST /conversations/:id/clear'))
  router.patch('/messaging/messages/:id',                 stub('PATCH /messages/:id'))
  router.delete('/messaging/messages/:id',                stub('DELETE /messages/:id'))
  router.post('/messaging/messages/:id/reactions',        stub('POST /messages/:id/reactions'))
  router.post('/messaging/reports',                       stub('POST /reports'))
  router.get('/messaging/reports',                        stub('GET /reports'))
  router.patch('/messaging/reports/:id',                  stub('PATCH /reports/:id'))
  router.post('/messaging/settings/consent',              stub('POST /settings/consent'))
  router.post('/messaging/export',                        stub('POST /export'))
}
