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
    // filled in Task 5
    res.status(501).json({ code: 'messaging/not_implemented',
      message: 'POST /messages — coming in Task 5', details: { method: req.method, path: req.path } })
  })

  // ── POST /messaging/conversations/:id/read ──────────────────────────
  router.post('/messaging/conversations/:id/read', async (req, res) => {
    // filled in Task 6
    res.status(501).json({ code: 'messaging/not_implemented',
      message: 'POST /conversations/:id/read — coming in Task 6', details: { method: req.method, path: req.path } })
  })

  // ── POST /messaging/conversations/:id/mute ──────────────────────────
  router.post('/messaging/conversations/:id/mute', async (req, res) => {
    // filled in Task 7
    res.status(501).json({ code: 'messaging/not_implemented',
      message: 'POST /conversations/:id/mute — coming in Task 7', details: { method: req.method, path: req.path } })
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
