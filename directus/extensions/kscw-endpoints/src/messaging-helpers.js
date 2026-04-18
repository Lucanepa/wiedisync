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
