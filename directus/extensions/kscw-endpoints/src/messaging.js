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
  requireMessageOwner, requireTeamModerator, snapshotMessage, requireAdmin,
  resolveRecipientsForPush, buildPushPreview,
  checkExportRateLimit, markExportDone,
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

  // Non-blocking push fan-out. Fire-and-forget — never awaited by the caller.
  // Groups recipients by push_preview_content flag and calls sendPushToMembers
  // once per group. Errors logged but don't propagate.
  async function firePushForMessage(conv, sender, body, opts = {}) {
    try {
      const recipientIds = await resolveRecipientsForPush(db, conv, sender.id)
      if (recipientIds.length === 0) return
      const recipients = await db('members')
        .whereIn('id', recipientIds)
        .select('id', 'push_preview_content')
      const senderName = [sender.first_name, sender.last_name].filter(Boolean).join(' ') || 'KSCW'

      const withPreview = recipients.filter(r => r.push_preview_content === true).map(r => r.id)
      const genericOnly = recipients.filter(r => r.push_preview_content !== true).map(r => r.id)

      const { sendPushToMembers } = await import('./web-push.js')
      const url = process.env.FRONTEND_URL || 'https://wiedisync.kscw.ch'
      const pushUrl = `${url}/inbox/${conv.id}`
      const tag = `msg-${conv.id}`

      if (withPreview.length > 0) {
        const previewBody = buildPushPreview({ push_preview_content: true }, senderName, opts.pollQuestion ? `📊 ${opts.pollQuestion}` : body)
        await sendPushToMembers(db, withPreview, senderName, previewBody, pushUrl, tag, log)
      }
      if (genericOnly.length > 0) {
        const genericBody = buildPushPreview({ push_preview_content: false }, senderName, body)
        await sendPushToMembers(db, genericOnly, 'KSC Wiedikon', genericBody, pushUrl, tag, log)
      }
    } catch (err) {
      log.error({ err: err?.message ?? String(err) }, 'messaging push fan-out failed')
    }
  }

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
      } else if (conv.type === 'activity_chat') {
        // Activity chats are event-commitment-tied, not team-chat-opt-in-tied.
        // Membership was already validated by loadConversationMembership above;
        // communications_banned was enforced by requireMember. No block check:
        // activity chats aren't DMs.
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
      // Non-blocking push fan-out (spec §5). Fire-and-forget.
      ;(async () => { await firePushForMessage(conv, member, body) })()
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

  // ── POST /messaging/messages/:id/reactions ──────────────────────────
  router.post('/messaging/messages/:id/reactions', async (req, res) => {
    try {
      const userId = requireAuth(req)
      const me = await requireMember(db, userId)

      const emoji = typeof req.body?.emoji === 'string' ? req.body.emoji : ''
      if (emoji.length < 1 || emoji.length > 8) {
        throw new MessagingError(400, 'messaging/invalid_body', 'emoji must be 1..8 chars')
      }

      const msg = await db('messages').where('id', req.params.id).first()
      if (!msg) throw new MessagingError(404, 'messaging/not_found', 'Message not found')
      // Caller must be in the conversation
      await loadConversationMembership(db, msg.conversation, me.id)
      // Block filter
      const { either } = await loadBlocks(db, me.id)
      if (either.has(String(msg.sender))) {
        throw new MessagingError(403, 'messaging/blocked', 'Cannot react on a blocked sender\u2019s message')
      }

      const existing = await db('message_reactions')
        .where({ message: msg.id, member: me.id, emoji }).first()

      const schema = await getSchema()
      const reactionsService = new ItemsService('message_reactions', { schema, knex: db })

      if (existing) {
        await reactionsService.deleteOne(existing.id)
        return res.json({ added: false, emoji })
      }
      await reactionsService.createOne({
        id: crypto.randomUUID(), message: msg.id, member: me.id,
        emoji, created_at: new Date().toISOString(),
      })
      res.json({ added: true, emoji })
    } catch (e) { sendError(res, log, e) }
  })

  // ── PATCH /messaging/messages/:id ───────────────────────────────────
  router.patch('/messaging/messages/:id', async (req, res) => {
    try {
      const userId = requireAuth(req)
      const me = await requireMember(db, userId)
      const msg = await requireMessageOwner(db, req.params.id, me.id)

      if (msg.deleted_at != null)
        throw new MessagingError(400, 'messaging/invalid_body', 'Cannot edit a deleted message')
      if (msg.type !== 'text')
        throw new MessagingError(400, 'messaging/invalid_body', 'Only text messages can be edited')

      const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
      if (body.length < 1 || body.length > 4000)
        throw new MessagingError(400, 'messaging/invalid_body', 'body must be 1..4000 chars')

      const schema = await getSchema()
      const messagesService = new ItemsService('messages', { schema, knex: db })
      const nowIso = new Date().toISOString()
      await messagesService.updateOne(msg.id, { body, edited_at: nowIso })

      res.json({ id: msg.id, body, edited_at: nowIso })
    } catch (e) { sendError(res, log, e) }
  })

  // ── DELETE /messaging/messages/:id ──────────────────────────────────
  router.delete('/messaging/messages/:id', async (req, res) => {
    try {
      const userId = requireAuth(req)
      const me = await requireMember(db, userId)

      const msg = await db('messages').where('id', req.params.id).first()
      if (!msg) throw new MessagingError(404, 'messaging/not_found', 'Message not found')
      if (msg.deleted_at != null)
        throw new MessagingError(400, 'messaging/invalid_body', 'Already deleted')

      const isSelf = String(msg.sender) === String(me.id)
      if (!isSelf) {
        // Moderator path — only valid for team conversations
        await requireTeamModerator(db, msg.id, me.id)
      }

      const schema = await getSchema()
      const messagesService = new ItemsService('messages', { schema, knex: db })
      const reportsService  = new ItemsService('reports',  { schema, knex: db })
      const nowIso = new Date().toISOString()

      await messagesService.updateOne(msg.id, { deleted_at: nowIso })

      if (!isSelf) {
        // Moderator audit — auto-close report row
        await reportsService.createOne({
          id: crypto.randomUUID(),
          reporter: me.id,
          reported_member: msg.sender,
          message: msg.id,
          conversation: msg.conversation,
          reason: 'moderator_delete',
          note: null,
          message_snapshot: msg.body ?? null,
          status: 'resolved',
          resolved_by: me.id,
          resolved_at: nowIso,
        })
      }

      res.json({ id: msg.id, deleted_at: nowIso, moderator_delete: !isSelf })
    } catch (e) { sendError(res, log, e) }
  })

  // ── POST /messaging/reports ─────────────────────────────────────────
  const ALLOWED_REPORT_REASONS = new Set(['harassment', 'spam', 'inappropriate', 'other'])

  router.post('/messaging/reports', async (req, res) => {
    try {
      const userId = requireAuth(req)
      const me = await requireMember(db, userId)

      const b = req.body ?? {}
      const reportedMember = b.reported_member != null ? Number(b.reported_member) : null
      const messageId = typeof b.message === 'string' ? b.message : null
      const conversationId = typeof b.conversation === 'string' ? b.conversation : null
      const reason = typeof b.reason === 'string' ? b.reason : null
      const note = typeof b.note === 'string' ? b.note.slice(0, 500) : null

      if (!reportedMember) throw new MessagingError(400, 'messaging/invalid_body', 'reported_member required')
      if (reportedMember === me.id) throw new MessagingError(400, 'messaging/invalid_body', 'cannot report yourself')
      if (!messageId && !conversationId) throw new MessagingError(400, 'messaging/invalid_body', 'message or conversation required')
      if (!reason || !ALLOWED_REPORT_REASONS.has(reason))
        throw new MessagingError(400, 'messaging/invalid_body', `reason must be one of ${[...ALLOWED_REPORT_REASONS].join(',')}`)

      const snapshot = messageId ? await snapshotMessage(db, messageId) : null

      const schema = await getSchema()
      const reportsService = new ItemsService('reports', { schema, knex: db })
      const id = crypto.randomUUID()
      await reportsService.createOne({
        id,
        reporter: me.id,
        reported_member: reportedMember,
        message: messageId, conversation: conversationId,
        reason, note,
        message_snapshot: snapshot,
        status: 'open',
      })

      // Admin in-app notifications — fan out to every member with role containing
      // 'admin' or 'superuser'. Fetch all members with a non-null role and filter
      // in JS to avoid knex-vs-Postgres `?|` operator bind-parameter conflicts.
      //
      // Notifications column shape: type/title/body/activity_type/activity_id/
      // read/member/team/date_created (DB default CURRENT_TIMESTAMP). Do NOT pass
      // created_at. Matches existing fan-out in src/index.js:1051.
      const allMembersWithRole = await db('members').whereNotNull('role').select('id', 'role')
      const admins = allMembersWithRole.filter(m => {
        const roles = Array.isArray(m.role) ? m.role : (typeof m.role === 'string' ? JSON.parse(m.role) : [])
        return roles.includes('admin') || roles.includes('superuser')
      })
      if (admins.length > 0) {
        const notifRows = admins.map(a => ({
          member: a.id,
          type: 'new_report',
          title: 'new_report',
          body: JSON.stringify({ reportId: id, reason }),
          activity_type: 'report',
          activity_id: id,
          read: false,
        }))
        await db('notifications').insert(notifRows)
      }

      res.json({ id })
    } catch (e) { sendError(res, log, e) }
  })

  // ── GET /messaging/reports ──────────────────────────────────────────
  router.get('/messaging/reports', async (req, res) => {
    try {
      const userId = requireAuth(req)
      // System admins (DIRECTUS_ADMIN_TOKEN) have no members row; try lookup but
      // allow null — requireAdmin will short-circuit via accountability.admin.
      const me = await db('members').where('user', userId)
        .select('id', 'role').first().then(r => r ?? null)
      await requireAdmin(db, me?.id ?? null, req.accountability)

      const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500)
      const statusFilter = typeof req.query.status === 'string' ? req.query.status : null

      let q = db('reports as r')
        .leftJoin('members as rep', 'rep.id', 'r.reporter')
        .leftJoin('members as rm',  'rm.id',  'r.reported_member')
        .orderBy('r.created_at', 'desc')
        .limit(limit)
        .select(
          'r.id', 'r.reporter', 'r.reported_member', 'r.message', 'r.conversation',
          'r.reason', 'r.note', 'r.message_snapshot', 'r.status',
          'r.resolved_by', 'r.resolved_at', 'r.created_at',
          'rep.first_name as reporter_first_name', 'rep.last_name as reporter_last_name',
          'rm.first_name as reported_first_name', 'rm.last_name as reported_last_name',
        )
      if (statusFilter) q = q.where('r.status', statusFilter)
      const rows = await q

      const reports = rows.map(r => ({
        id: r.id, reporter: r.reporter, reported_member: r.reported_member,
        message: r.message, conversation: r.conversation,
        reason: r.reason, note: r.note, message_snapshot: r.message_snapshot,
        status: r.status, resolved_by: r.resolved_by, resolved_at: r.resolved_at, created_at: r.created_at,
        reporter_name: [r.reporter_first_name, r.reporter_last_name].filter(Boolean).join(' ') || null,
        reported_name: [r.reported_first_name, r.reported_last_name].filter(Boolean).join(' ') || null,
      }))

      res.json({ reports })
    } catch (e) { sendError(res, log, e) }
  })

  // ── PATCH /messaging/reports/:id ────────────────────────────────────
  const ALLOWED_REPORT_STATUSES = new Set(['resolved', 'dismissed'])

  router.patch('/messaging/reports/:id', async (req, res) => {
    try {
      const userId = requireAuth(req)
      // System admins (DIRECTUS_ADMIN_TOKEN) have no members row; try lookup but
      // allow null — requireAdmin will short-circuit via accountability.admin.
      const me = await db('members').where('user', userId)
        .select('id', 'role').first().then(r => r ?? null)
      await requireAdmin(db, me?.id ?? null, req.accountability)

      const b = req.body ?? {}
      if (!ALLOWED_REPORT_STATUSES.has(b.status))
        throw new MessagingError(400, 'messaging/invalid_body', 'status must be resolved or dismissed')
      const deleteMessage = b.delete_message === true
      const ban = b.ban === true

      const report = await db('reports').where('id', req.params.id).first()
      if (!report) throw new MessagingError(404, 'messaging/not_found', 'Report not found')

      const schema = await getSchema()
      const reportsService = new ItemsService('reports', { schema, knex: db })
      const messagesService = new ItemsService('messages', { schema, knex: db })
      const membersService = new ItemsService('members', { schema, knex: db })
      const nowIso = new Date().toISOString()

      await reportsService.updateOne(report.id, {
        status: b.status, resolved_by: me?.id ?? null, resolved_at: nowIso,
      })

      if (deleteMessage && report.message) {
        const msg = await db('messages').where('id', report.message).first()
        if (msg && msg.deleted_at == null) {
          await messagesService.updateOne(msg.id, { deleted_at: nowIso })
        }
      }

      if (ban && report.reported_member) {
        await membersService.updateOne(report.reported_member, {
          communications_banned: true,
          communications_team_chat_enabled: false,
          communications_dm_enabled: false,
        })
      }

      res.json({ id: report.id, status: b.status, delete_message: deleteMessage, ban })
    } catch (e) { sendError(res, log, e) }
  })

  // ── POST /messaging/settings/consent ────────────────────────────────
  const CONSENT_DECISIONS = new Set(['accepted', 'declined', 'later'])

  router.post('/messaging/settings/consent', async (req, res) => {
    try {
      const userId = requireAuth(req)
      const me = await requireMember(db, userId)

      const decision = req.body?.decision
      if (!CONSENT_DECISIONS.has(decision))
        throw new MessagingError(400, 'messaging/invalid_body', 'decision must be accepted|declined|later')

      if (me.communications_banned === true)
        throw new MessagingError(403, 'messaging/banned', 'Your messaging access is disabled')

      const schema = await getSchema()
      const membersService = new ItemsService('members', { schema, knex: db })
      const nowIso = new Date().toISOString()
      const patch = { consent_prompted_at: nowIso }
      if (decision === 'accepted') {
        patch.consent_decision = 'accepted'
        patch.communications_team_chat_enabled = true
        patch.communications_dm_enabled = true
      } else if (decision === 'declined') {
        patch.consent_decision = 'declined'
      }
      // 'later' only bumps consent_prompted_at.
      await membersService.updateOne(me.id, patch)

      res.json({ decision, consent_prompted_at: nowIso })
    } catch (e) { sendError(res, log, e) }
  })

  // ── POST /messaging/polls ───────────────────────────────────────────
  router.post('/messaging/polls', async (req, res) => {
    try {
      const userId = requireAuth(req)
      const me = await requireMember(db, userId)

      const b = req.body ?? {}
      const conversationId = typeof b.conversation === 'string' ? b.conversation : null
      const question = typeof b.question === 'string' ? b.question.trim() : ''
      const options = Array.isArray(b.options) ? b.options.map(String).map(s => s.trim()).filter(Boolean) : []
      const mode = b.mode === 'multi' ? 'multi' : 'single'
      const anonymous = b.anonymous === true
      const deadline = typeof b.deadline === 'string' && b.deadline.length > 0 ? b.deadline : null

      if (!conversationId) throw new MessagingError(400, 'messaging/invalid_body', 'conversation required')
      if (question.length < 1 || question.length > 255)
        throw new MessagingError(400, 'messaging/invalid_body', 'question must be 1..255 chars')
      if (options.length < 2 || options.length > 10)
        throw new MessagingError(400, 'messaging/invalid_body', 'options must be 2..10 non-empty strings')

      const { conv } = await loadConversationMembership(db, conversationId, me.id)
      if (conv.type === 'team') requireTeamChatEnabled(me)
      else if (conv.type === 'dm' || conv.type === 'dm_request') requireDmEnabled(me)
      else throw new MessagingError(400, 'messaging/invalid_body', `Unsupported conversation type: ${conv.type}`)

      const schema = await getSchema()
      const pollsService = new ItemsService('polls', { schema, knex: db })
      const messagesService = new ItemsService('messages', { schema, knex: db })
      const conversationsService = new ItemsService('conversations', { schema, knex: db })
      const nowIso = new Date().toISOString()

      // polls.id is integer (serial). ItemsService.createOne returns the PK.
      const pollId = await pollsService.createOne({
        conversation: conversationId,
        team: null,
        question, options, mode, deadline, anonymous,
        created_by: me.id, status: 'open',
      })

      const messageId = crypto.randomUUID()
      await messagesService.createOne({
        id: messageId, conversation: conversationId, sender: me.id,
        type: 'poll', body: null, poll: pollId, created_at: nowIso,
      })

      const preview = `📊 ${question.length > 100 ? question.slice(0, 97) + '...' : question}`
      await conversationsService.updateOne(conversationId, {
        last_message_at: nowIso, last_message_preview: preview,
      })

      // Non-blocking push fan-out (poll variant — use question as preview)
      ;(async () => { await firePushForMessage(conv, me, null, { pollQuestion: question }) })()
      res.json({ poll_id: pollId, message_id: messageId })
    } catch (e) { sendError(res, log, e) }
  })

  // ── POST /messaging/conversations/:id/clear ─────────────────────────
  router.post('/messaging/conversations/:id/clear', async (req, res) => {
    try {
      const userId = requireAuth(req)
      const me = await requireMember(db, userId)
      await loadConversationMembership(db, req.params.id, me.id)

      const schema = await getSchema()
      const messagesService = new ItemsService('messages', { schema, knex: db })
      const nowIso = new Date().toISOString()

      const rows = await db('messages')
        .where('conversation', req.params.id)
        .andWhere('sender', me.id)
        .andWhereRaw('deleted_at IS NULL')
        .select('id')
      if (rows.length === 0) return res.json({ cleared: 0 })

      await messagesService.updateMany(rows.map(r => r.id), { deleted_at: nowIso })

      res.json({ cleared: rows.length })
    } catch (e) { sendError(res, log, e) }
  })

  // ── POST /messaging/export ──────────────────────────────────────────
  router.post('/messaging/export', async (req, res) => {
    try {
      const userId = requireAuth(req)
      const me = await requireMember(db, userId)

      const cachedAt = await checkExportRateLimit(db, me.id)
      if (cachedAt) {
        return res.status(200).json({
          cached: true, last_export_at: cachedAt,
          message: 'Rate-limited to 1 export per 24h. Re-request after 24h from last_export_at.',
        })
      }

      const myConvs = await db('conversation_members as cm')
        .join('conversations as c', 'c.id', 'cm.conversation')
        .where('cm.member', me.id)
        .select('c.id', 'c.type', 'c.team', 'c.title', 'c.created_at', 'c.last_message_at',
                'cm.joined_at', 'cm.last_read_at', 'cm.muted', 'cm.archived')

      const convIds = myConvs.map(c => c.id)

      const messages = convIds.length > 0
        ? await db('messages').whereIn('conversation', convIds)
            .select('id', 'conversation', 'sender', 'type', 'body', 'poll',
                    'created_at', 'edited_at', 'deleted_at')
        : []

      const reactions = convIds.length > 0
        ? await db('message_reactions as mr')
            .join('messages as m', 'm.id', 'mr.message')
            .whereIn('m.conversation', convIds)
            .andWhere(function () {
              this.where('mr.member', me.id).orWhere('m.sender', me.id)
            })
            .select('mr.id', 'mr.message', 'mr.member', 'mr.emoji', 'mr.created_at')
        : []

      const blocks = await db('blocks').where('blocker', me.id)
        .select('id', 'blocker', 'blocked', 'created_at')

      const settingsRow = await db('members').where('id', me.id)
        .select('communications_team_chat_enabled', 'communications_dm_enabled',
                'communications_banned', 'push_preview_content',
                'consent_decision', 'consent_prompted_at', 'last_export_at')
        .first()

      const reportsFiled = await db('reports').where('reporter', me.id)
        .select('id', 'reported_member', 'message', 'conversation',
                'reason', 'note', 'message_snapshot', 'status', 'created_at')

      const bundle = {
        generated_at: new Date().toISOString(),
        member_id: me.id,
        conversations: myConvs,
        messages,
        reactions,
        blocks,
        settings: settingsRow,
        reports_filed: reportsFiled,
      }

      await markExportDone(db, me.id)
      res.json(bundle)
    } catch (e) { sendError(res, log, e) }
  })
}
