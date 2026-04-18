/**
 * KSCW Messaging — shared helpers for endpoints.
 * Plan 02 scope: just the helpers needed by the 4 team-chat endpoints.
 * Plan 03+ will add DM/request-specific helpers here.
 */

export class MessagingError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

/**
 * Ensure the request is authenticated and return the accountability user id
 * (which is the directus_users.id — NOT the members.id).
 */
export function requireAuth(req) {
  const userId = req.accountability?.user
  if (!userId) {
    throw new MessagingError(401, 'messaging/unauthenticated', 'Authentication required')
  }
  return userId
}

/**
 * Resolve a directus_users.id to the corresponding members.id.
 * Throws if the user has no linked member.
 * Returns the full row we need for opt-in / ban checks.
 *
 * NOTE: the FK column on `members` pointing at `directus_users.id` is named
 * `members.user` (not `members.directus_user`). Every existing endpoint
 * confirms this — grep for `where('user'` in directus/extensions/kscw-endpoints/src/
 * (e.g. clubdesk-update.js:84, index.js:250,520,836,1174). Do NOT "fix" this
 * to `directus_user` — it is the real column name.
 */
export async function requireMember(db, directusUserId) {
  const row = await db('members')
    .where('user', directusUserId)
    .select(
      'id', 'first_name', 'last_name',
      'communications_team_chat_enabled',
      'communications_dm_enabled',
      'communications_banned',
      'push_preview_content',
    )
    .first()
  if (!row) {
    throw new MessagingError(403, 'messaging/no_member_profile',
      'No member profile linked to this user')
  }
  if (row.communications_banned) {
    throw new MessagingError(403, 'messaging/banned', 'Your messaging access is disabled')
  }
  return row
}

/**
 * Load the conversation + the caller's conversation_members row in one shot.
 * Returns { conv, membership } or throws 403 `messaging/not_a_member` if the
 * caller is not a member (or the conversation doesn't exist).
 *
 * Deliberately merges "not found" and "not a member" into one 403 (per spec §4
 * error table) so non-members cannot enumerate conversation ids via 404/403 drift.
 */
export async function loadConversationMembership(db, conversationId, memberId) {
  const conv = await db('conversations').where('id', conversationId).first()
  if (!conv) {
    throw new MessagingError(403, 'messaging/not_a_member', 'Conversation not found or no access')
  }
  const membership = await db('conversation_members')
    .where({ conversation: conversationId, member: memberId })
    .first()
  if (!membership || membership.archived === true) {
    throw new MessagingError(403, 'messaging/not_a_member', 'Conversation not found or no access')
  }
  return { conv, membership }
}

/**
 * For team conversations, require the caller has team chat enabled.
 * (For DM conversations, Plan 03 adds a similar check on dm_enabled.)
 */
export function requireTeamChatEnabled(member) {
  if (member.communications_team_chat_enabled !== true) {
    throw new MessagingError(403, 'messaging/comms_disabled',
      'Team chat is disabled in your settings')
  }
}

/**
 * Shape a conversation row + the caller's membership + an unread count
 * into the ConversationSummary contract expected by the frontend.
 */
export function shapeConversationSummary({ conv, membership, unread_count }) {
  return {
    id: conv.id,
    type: conv.type,
    team: conv.team ?? null,
    title: conv.title ?? null,
    last_message_at: conv.last_message_at ?? null,
    last_message_preview: conv.last_message_preview ?? null,
    unread_count: Number.isFinite(unread_count) ? unread_count : 0,
    muted: membership.muted === true,
    request_status: null, // Plan 03 fills this for dm_request conversations
    other_member: null,   // Plan 03 fills this for dm / dm_request conversations
  }
}

/**
 * Convert a thrown MessagingError (or unexpected error) into an Express response.
 * Use inside try/catch in each route handler.
 */
export function sendError(res, logger, err) {
  if (err instanceof MessagingError) {
    return res.status(err.status).json({ code: err.code, message: err.message, details: err.details })
  }
  logger.error({ err: err?.message ?? String(err), stack: err?.stack }, 'messaging endpoint crash')
  return res.status(500).json({
    code: 'messaging/internal', message: 'Internal server error',
  })
}

// ─── Plan 03: DM / request / block helpers ───────────────────────────────────

/**
 * For DM conversations, require the caller has DM enabled.
 * Symmetric to requireTeamChatEnabled.
 */
export function requireDmEnabled(member) {
  if (member.communications_dm_enabled !== true) {
    throw new MessagingError(403, 'messaging/comms_disabled',
      'Direct messages are disabled in your settings')
  }
}

/**
 * Load blocks relevant to `memberId`: who I've blocked + who has blocked me.
 * Plan 03 uses this for:
 *   • GET /conversations — hide DMs where a block exists in either direction.
 *   • POST /messages — 403 `messaging/blocked` when DM is blocked.
 *   • GET /conversations/:id/messages — filter out blocker's messages in shared team chats.
 *
 * Returns two Sets of string member ids for O(1) lookups.
 */
export async function loadBlocks(db, memberId) {
  const rows = await db('blocks')
    .where('blocker', memberId).orWhere('blocked', memberId)
    .select('blocker', 'blocked')
  const outgoing = new Set()   // members *I* have blocked
  const incoming = new Set()   // members who have blocked *me*
  for (const r of rows) {
    if (String(r.blocker) === String(memberId)) outgoing.add(String(r.blocked))
    else if (String(r.blocked) === String(memberId)) incoming.add(String(r.blocker))
  }
  const either = new Set([...outgoing, ...incoming])
  return { outgoing, incoming, either }
}

/**
 * Do members A and B share at least one active team this season?
 * member_teams.season is filtered to the current season — matches the frontend
 * `loadTeamContext` convention (see src/hooks/useAuth.tsx:106).
 *
 * Season threshold: Aug 1 UTC. Year-crossing: Aug 2026 → season '2026/27'.
 * If Swiss season rules ever shift, update both src/utils/dateHelpers.ts
 * (frontend) and this helper in lock-step.
 */
export async function shareTeam(db, memberIdA, memberIdB) {
  const now = new Date()
  const year = now.getUTCFullYear()
  const startYear = now.getUTCMonth() >= 7 ? year : year - 1   // Aug = 7 (0-indexed)
  const season = `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`
  const row = await db('member_teams as mt1')
    .join('member_teams as mt2', function () {
      this.on('mt1.team', '=', 'mt2.team').andOn('mt1.season', '=', 'mt2.season')
    })
    .where('mt1.member', memberIdA)
    .andWhere('mt2.member', memberIdB)
    .andWhere('mt1.season', season)
    .select('mt1.team').first()
  return !!row
}

/**
 * Find an existing (dm|dm_request) conversation between two members.
 * Returns the conversations row (incl. type) or null.
 * Uses conversation_members as the join predicate; DMs have no `team` FK.
 */
export async function findExistingDmConversation(db, memberIdA, memberIdB) {
  const row = await db('conversations as c')
    .join('conversation_members as cm1', 'cm1.conversation', 'c.id')
    .join('conversation_members as cm2', 'cm2.conversation', 'c.id')
    .whereIn('c.type', ['dm', 'dm_request'])
    .andWhere('cm1.member', memberIdA)
    .andWhere('cm2.member', memberIdB)
    .select('c.id', 'c.type', 'c.last_message_at', 'c.last_message_preview')
    .first()
  return row ?? null
}

/**
 * Per spec §7: after a decline, the sender cannot re-request for 30 days.
 * Throws 429 messaging/request_cooldown if a declined request exists from
 * `senderId` → `recipientId` with `resolved_at` within the last 30 days.
 */
export async function checkDeclineCooldown(db, senderId, recipientId) {
  const cutoffMs = Date.now() - 30 * 24 * 3600 * 1000
  const row = await db('message_requests')
    .where('sender', senderId).andWhere('recipient', recipientId)
    .andWhere('status', 'declined')
    .andWhere('resolved_at', '>', new Date(cutoffMs).toISOString())
    .select('resolved_at').first()
  if (row) {
    throw new MessagingError(429, 'messaging/request_cooldown',
      'You must wait 30 days before sending another request to this member',
      { resolved_at: row.resolved_at })
  }
}

/**
 * Verify the caller is the **recipient** of a message_requests row.
 * Only the recipient can accept/decline. Returns { req, conv }.
 * Throws 403 not_a_member if anything doesn't line up.
 */
export async function requireRequestRecipient(db, requestId, memberId) {
  const req = await db('message_requests').where('id', requestId).first()
  if (!req || String(req.recipient) !== String(memberId)) {
    throw new MessagingError(403, 'messaging/not_a_member', 'Request not found or access denied')
  }
  if (req.status !== 'pending') {
    throw new MessagingError(409, 'messaging/request_already_resolved', 'This request was already resolved',
      { status: req.status })
  }
  const conv = await db('conversations').where('id', req.conversation).first()
  if (!conv) throw new MessagingError(403, 'messaging/not_a_member', 'Conversation not found')
  return { req, conv }
}

// ─── Plan 04: message-action + moderation helpers ────────────────────────────

/**
 * Fail fast if caller isn't the sender. Used by PATCH /messages/:id and by
 * DELETE /messages/:id's self-delete path.
 */
export async function requireMessageOwner(db, messageId, memberId) {
  const msg = await db('messages').where('id', messageId).first()
  if (!msg) throw new MessagingError(404, 'messaging/not_found', 'Message not found')
  if (String(msg.sender) !== String(memberId)) {
    throw new MessagingError(403, 'messaging/forbidden', 'You can only modify your own messages')
  }
  return msg
}

/**
 * For DELETE /messages/:id — allow coach OR team_responsible of the team
 * that owns the conversation. DM conversations never have moderators (spec §8:
 * admin via report flow only). Returns { msg, conv } on allow, throws on deny.
 *
 * The caller is allowed if:
 *   - conversation is type='team' AND caller is in teams_coaches OR teams_responsibles
 *     for that team.
 * DM / dm_request → moderator path is disallowed. Reports handle DM moderation.
 */
export async function requireTeamModerator(db, messageId, memberId) {
  const msg = await db('messages').where('id', messageId).first()
  if (!msg) throw new MessagingError(404, 'messaging/not_found', 'Message not found')
  const conv = await db('conversations').where('id', msg.conversation).first()
  if (!conv) throw new MessagingError(404, 'messaging/not_found', 'Conversation not found')

  if (conv.type !== 'team' || !conv.team) {
    throw new MessagingError(403, 'messaging/forbidden', 'Moderator delete is only available in team chats')
  }
  const isCoach = await db('teams_coaches')
    .where({ teams_id: conv.team, members_id: memberId }).first()
  const isTR = await db('teams_responsibles')
    .where({ teams_id: conv.team, members_id: memberId }).first()
  if (!isCoach && !isTR) {
    throw new MessagingError(403, 'messaging/forbidden', 'You must be a coach or team responsible')
  }
  return { msg, conv }
}

/**
 * Snapshot a message body for audit retention in a report.
 * Returns the stored body verbatim (may be null for poll messages).
 *
 * Called at report-file time (POST /reports), not at resolution time.
 * The snapshot is stored on reports.message_snapshot and survives later
 * message purge (Plan 05's retention cron hard-deletes messages but leaves
 * report.message_snapshot intact per spec §9).
 *
 * If the message is already soft-deleted when the report is filed, body
 * is still non-null (soft-delete only sets deleted_at, doesn't clear body).
 * The hard-purge in Plan 05 is what ultimately removes messages.body.
 */
export async function snapshotMessage(db, messageId) {
  const row = await db('messages').where('id', messageId).select('body', 'type', 'poll').first()
  if (!row) return null
  // For poll messages, snapshot the question instead of null.
  if (row.type === 'poll' && row.poll != null) {
    const poll = await db('polls').where('id', row.poll).select('question').first()
    return poll?.question ?? null
  }
  return row.body ?? null
}

/**
 * Admin gate — members.role JSONB array contains 'admin' OR 'superuser'.
 * Uses JS filter (not knex `?|` bind) to avoid operator-vs-parameter conflicts.
 */
export async function requireAdmin(db, memberId) {
  const row = await db('members').where('id', memberId).select('role').first()
  const roles = Array.isArray(row?.role) ? row.role : (typeof row?.role === 'string' ? JSON.parse(row.role) : [])
  if (!roles.includes('admin') && !roles.includes('superuser')) {
    throw new MessagingError(403, 'messaging/forbidden', 'Admin access required')
  }
}
