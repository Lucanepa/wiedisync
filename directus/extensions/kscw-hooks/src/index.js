/**
 * KSCW Directus Hooks Extension — Lean Version
 *
 * Most validation & notification logic has been pushed to Postgres triggers:
 *   - trg_slot_claims_validate      (past dates, duplicate claims)
 *   - trg_members_shell_convert     (shell→full on password set)
 *   - trg_members_coach_approval_guard (coach_approved requires member_teams)
 *   - trg_participations_guest_block (guests can't confirm games)
 *   - trg_trainings_revoke_claims   (auto-revoke on uncancelling)
 *   - trg_games_notify              (batch notifications on game CRUD)
 *   - trg_trainings_notify          (batch notifications on training CRUD)
 *   - trg_events_notify             (batch notifications on event CRUD)
 *   - trg_scorer_delegation_validate (same-team auto-accept)
 *   - Postgres DEFAULT values: members.language='german', birthdate_visibility='full'
 *
 * This extension only handles logic that CANNOT run in Postgres:
 *   1. Auth hooks (wiedisync_active on login — needs Directus auth event)
 *   2. Crons with email/HTTP (participation reminders, scorer reminders, shell lifecycle)
 *   3. Notification cleanup (old notifications)
 */

import { logCronError, logWarning, logAuthDenial, cleanOldLogs, writeErrorLog } from '../../kscw-endpoints/src/error-log.js'
import { initSentry } from '../../kscw-endpoints/src/sentry.js'
import { buildEmailLayout, buildInfoCard } from '../../kscw-endpoints/src/email-template.js'

// Frontend URL — env var or auto-detect from Directus PUBLIC_URL
const FRONTEND_URL = process.env.FRONTEND_URL
  || (process.env.PUBLIC_URL?.includes('directus-dev') ? 'https://wiedisync.pages.dev' : 'https://wiedisync.kscw.ch')

const PUSH_WORKER_URL = process.env.PUSH_WORKER_URL || 'https://kscw-push.lucanepa.workers.dev'
const PUSH_AUTH_SECRET = process.env.PUSH_AUTH_SECRET || ''

async function sendPushToMembers(db, memberIds, title, body, url, tag, log) {
  if (!memberIds || memberIds.length === 0 || !PUSH_AUTH_SECRET) return
  try {
    const subscriptions = await db('push_subscriptions')
      .whereIn('member', memberIds)
      .select('endpoint', 'keys_p256dh', 'keys_auth')
    if (subscriptions.length === 0) return

    const resp = await fetch(`${PUSH_WORKER_URL}/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PUSH_AUTH_SECRET}`,
      },
      body: JSON.stringify({
        subscriptions: subscriptions.map(s => ({
          endpoint: s.endpoint,
          keys: { p256dh: s.keys_p256dh, auth: s.keys_auth },
        })),
        title: title || 'KSC Wiedikon',
        body: body || '',
        url: url || FRONTEND_URL,
        ...(tag ? { tag } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (resp.ok) {
      const data = await resp.json()
      // Clean up expired subscriptions
      if (data.expired?.length > 0) {
        await db('push_subscriptions').whereIn('endpoint', data.expired).delete()
      }
      log.info(`[push] Sent ${data.sent || 0}, failed ${data.failed || 0}, cleaned ${data.expired?.length || 0}`)
    }
  } catch (err) {
    log.warn({ msg: `[push] Failed: ${err.message}`, event: 'push_send', memberCount: memberIds?.length, stack: err.stack })
    logWarning('push_send_failed', err.message, { memberCount: memberIds?.length, stack: err.stack })
  }
}

// ── Role Sync ────────────────────────────────────────────────────
// Keeps each member's Directus user role in sync with their app role
// (members.role array) and coach/TR junction membership.
//
// Directus 11: one role per user, multiple policies per role.
// Priority: superuser/admin > Sport Admin > Vorstand+Coach > Vorstand > Team Responsible > Member

/**
 * Determine the correct Directus role for a member.
 * @returns {{ userId: string, roleName: string } | null}
 */
async function resolveDirectusRole(db, memberId) {
  const member = await db('members').where('id', memberId).select('role', 'user').first()
  if (!member || !member.user) return null

  const roles = Array.isArray(member.role) ? member.role : []

  if (roles.includes('superuser') || roles.includes('admin')) {
    return { userId: member.user, roleName: 'Superuser' }
  }
  if (roles.includes('vb_admin') || roles.includes('bb_admin')) {
    return { userId: member.user, roleName: 'Sport Admin' }
  }

  // Check coach/TR junctions
  const isCoach = await db('teams_coaches').where('members_id', memberId).first()
  const isTR = await db('teams_responsibles').where('members_id', memberId).first()
  const isTeamResponsible = !!(isCoach || isTR)

  // Vorstand who is also a coach → Team Responsible (higher write access)
  if (roles.includes('vorstand') && isTeamResponsible) {
    return { userId: member.user, roleName: 'Team Responsible' }
  }
  if (roles.includes('vorstand')) {
    return { userId: member.user, roleName: 'Vorstand' }
  }
  if (isTeamResponsible) {
    return { userId: member.user, roleName: 'Team Responsible' }
  }

  return { userId: member.user, roleName: 'Member' }
}

// ── Turnstile CAPTCHA ────────────────────────────────────────────
// Directus filter hooks don't receive HTTP headers, so we use AsyncLocalStorage
// to bridge the X-Turnstile-Token header from middleware into filter hooks.
import { AsyncLocalStorage } from 'node:async_hooks'

const turnstileStore = new AsyncLocalStorage()
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || ''

async function verifyTurnstile(token) {
  if (!TURNSTILE_SECRET) return true // skip in dev
  if (!token) return false
  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: TURNSTILE_SECRET, response: token }).toString(),
  })
  const data = await resp.json()
  return data.success === true
}

export default ({ action, filter, init, schedule }, { services, database, logger, getSchema }) => {
  initSentry().catch(() => {})
  const log = logger.child({ extension: 'kscw-hooks' })

  // ── 0. Turnstile Middleware + Filter Hooks ─────────────────────
  // Capture X-Turnstile-Token from request headers via AsyncLocalStorage,
  // then validate in filter hooks for public item creation.

  init('middlewares.before', ({ app }) => {
    app.use((req, _res, next) => {
      const token = req.headers['x-turnstile-token'] || ''
      turnstileStore.run({ turnstileToken: token }, next)
    })
  })

  // Block unauthenticated members.create and feedback.create without valid Turnstile
  filter('items.create', async (payload, meta, context) => {
    const collection = meta.collection
    if (collection !== 'members' && collection !== 'feedback') return payload

    // Skip for authenticated users (admins creating members, logged-in feedback)
    if (context.accountability?.user) return payload

    // Skip in dev (no secret configured)
    if (!TURNSTILE_SECRET) return payload

    const store = turnstileStore.getStore()
    const token = store?.turnstileToken
    if (!(await verifyTurnstile(token))) {
      log.warn({
        msg: 'Turnstile CAPTCHA failed on public create',
        collection,
        event: 'captcha_failed',
      })
      logWarning('captcha_failed', 'Turnstile verification failed', { collection })
      const err = new Error('Captcha verification failed')
      err.status = 403
      throw err
    }
    return payload
  })

  // ── 0b. Cascade: Directus user deletion → delete linked member ──
  // When a user is deleted from Directus admin UI, also delete the linked member.
  // The Postgres CASCADE constraints then clean up all member-owned data.

  // Capture member IDs before user deletion (filter runs before delete)
  const pendingUserDeletes = new Map()

  filter('users.delete', async (keys) => {
    try {
      const members = await database('members').whereIn('user', keys).select('id', 'user', 'email')
      for (const m of members) {
        pendingUserDeletes.set(m.user, { memberId: m.id, email: m.email })
      }
    } catch (e) {
      log.warn({ msg: `user-delete cascade lookup failed: ${e.message}`, event: 'cascade_delete' })
    }
    return keys
  })

  action('users.delete', async ({ keys }) => {
    for (const userId of keys) {
      const pending = pendingUserDeletes.get(userId)
      if (!pending) continue
      pendingUserDeletes.delete(userId)
      try {
        // Clean up email verifications (not FK-linked)
        if (pending.email) {
          await database('email_verifications').where('email', pending.email).delete()
        }
        // Delete member — CASCADE handles all child records
        await database('members').where('id', pending.memberId).delete()
        log.info(`[cascade] Deleted member ${pending.memberId} (user ${userId} deleted from admin)`)
      } catch (err) {
        log.error({ msg: `[cascade] Member delete failed for ${pending.memberId}: ${err.message}`, event: 'cascade_delete', userId, memberId: pending.memberId, stack: err.stack })
        logCronError('cascade_delete', err, { userId, memberId: pending.memberId })
      }
    }
  })

  // ── 1. Wiedisync Active on Auth ─────────────────────────────────
  // Mark wiedisync_active=true on successful login
  // (Can't be a Postgres trigger because Directus auth doesn't write to members table)

  action('auth.login', async ({ user }) => {
    if (!user) return
    try {
      await database('members')
        .where('user', user)
        .where('wiedisync_active', false)
        .update({ wiedisync_active: true })
    } catch (err) {
      log.warn({ msg: `wiedisync_active: ${err.message}`, event: 'auth.login', userId: user, stack: err.stack })
      logWarning('auth_login_hook', err.message, { userId: user, stack: err.stack })
    }
  })

  // ── 1b. Role Sync — keep Directus user role in sync ─────────────
  // When members.role changes or coach/TR junctions change, update the
  // linked Directus user's role to the correct tier.

  let roleNameToId = null

  async function getRoleMap() {
    if (roleNameToId) return roleNameToId
    const roles = await database('directus_roles').select('id', 'name')
    roleNameToId = Object.fromEntries(roles.map(r => [r.name, r.id]))
    return roleNameToId
  }

  async function syncMemberRole(memberId) {
    try {
      const map = await getRoleMap()
      const result = await resolveDirectusRole(database, memberId)
      if (!result) return

      const roleId = map[result.roleName]
      if (!roleId) {
        log.warn(`[role-sync] Role "${result.roleName}" not found in Directus`)
        return
      }

      const currentUser = await database('directus_users').where('id', result.userId).select('role').first()
      if (currentUser && currentUser.role !== roleId) {
        await database('directus_users').where('id', result.userId).update({ role: roleId })
        log.info(`[role-sync] Member ${memberId} → ${result.roleName}`)
      }
    } catch (err) {
      log.warn({ msg: `[role-sync] Failed for member ${memberId}: ${err.message}`, event: 'role_sync', memberId, stack: err.stack })
      logWarning('role_sync', err.message, { memberId, stack: err.stack })
    }
  }

  // Sync when members.role array changes
  action('members.items.update', async ({ keys, payload }) => {
    if (!payload || !('role' in payload)) return
    for (const id of keys) {
      await syncMemberRole(id)
    }
  })

  // Sync when coach/TR junctions change (create)
  action('teams_coaches.items.create', async ({ payload }) => {
    if (payload?.members_id) await syncMemberRole(payload.members_id)
  })
  action('teams_responsibles.items.create', async ({ payload }) => {
    if (payload?.members_id) await syncMemberRole(payload.members_id)
  })

  // Sync when coach/TR junctions change (delete)
  // Capture member IDs before deletion via filter, then sync in action
  const pendingJunctionDeletes = new Map()

  filter('teams_coaches.items.delete', async (keys) => {
    try {
      const rows = await database('teams_coaches').whereIn('id', keys).select('members_id')
      for (const r of rows) pendingJunctionDeletes.set(`coach-${r.members_id}`, r.members_id)
    } catch (e) { /* ignore */ }
    return keys
  })

  filter('teams_responsibles.items.delete', async (keys) => {
    try {
      const rows = await database('teams_responsibles').whereIn('id', keys).select('members_id')
      for (const r of rows) pendingJunctionDeletes.set(`tr-${r.members_id}`, r.members_id)
    } catch (e) { /* ignore */ }
    return keys
  })

  action('teams_coaches.items.delete', async () => {
    for (const [key, memberId] of pendingJunctionDeletes) {
      if (key.startsWith('coach-')) {
        await syncMemberRole(memberId)
        pendingJunctionDeletes.delete(key)
      }
    }
  })

  action('teams_responsibles.items.delete', async () => {
    for (const [key, memberId] of pendingJunctionDeletes) {
      if (key.startsWith('tr-')) {
        await syncMemberRole(memberId)
        pendingJunctionDeletes.delete(key)
      }
    }
  })

  // ── Absence Auto-Decline ────────────────────────────────────────
  // When an absence is created or updated, auto-decline all overlapping
  // future trainings/games/events for that member. Skips activities where
  // the member already has a participation record (so manual overrides stick).
  // Also handles weekly absences (day-of-week matching).

  /**
   * Auto-decline future activities that overlap with the given absence.
   * Uses a single INSERT...SELECT per activity type (no per-row loop).
   */
  async function autoDeclineForAbsence(absenceId) {
    try {
      const absence = await database('absences').where('id', absenceId).first()
      if (!absence) return

      const memberId = absence.member
      const startDate = absence.start_date?.split?.('T')[0] || absence.start_date
      const endDate = absence.end_date?.split?.('T')[0] || absence.end_date
      const today = new Date().toISOString().split('T')[0]
      const effectiveStart = startDate > today ? startDate : today

      // Parse affects — JSON array like ["all"] or ["trainings","games"]
      let affects = absence.affects
      if (typeof affects === 'string') {
        try { affects = JSON.parse(affects) } catch { affects = ['all'] }
      }
      if (!Array.isArray(affects) || affects.length === 0) affects = ['all']
      const allTypes = affects.includes('all')

      const isWeekly = absence.type === 'weekly'
      let daysOfWeek = absence.days_of_week
      if (isWeekly) {
        if (typeof daysOfWeek === 'string') {
          try { daysOfWeek = JSON.parse(daysOfWeek) } catch { daysOfWeek = [] }
        }
        if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) return
      }

      // Day-of-week filter for weekly absences (Postgres: 0=Sun,1=Mon..6=Sat; our format: 0=Mon..6=Sun)
      // Convert our Mon=0..Sun=6 to Postgres EXTRACT(DOW): Sun=0,Mon=1..Sat=6
      const pgDowClause = isWeekly
        ? `AND EXTRACT(DOW FROM d.date) IN (${daysOfWeek.map(d => (d + 1) % 7).join(',')})`
        : ''

      let declined = 0

      // Trainings
      if (allTypes || affects.includes('trainings')) {
        const res = await database.raw(`
          INSERT INTO participations (member, activity_type, activity_id, status, note, guest_count, is_staff)
          SELECT ?::integer, 'training', t.id::text, 'declined', ?, 0, false
          FROM trainings t
          WHERE t.date >= ?::date AND t.date <= ?::date
            AND t.cancelled = false
            ${pgDowClause}
            AND EXISTS (SELECT 1 FROM member_teams mt WHERE mt.team = t.team AND mt.member = ?::integer)
            AND NOT EXISTS (
              SELECT 1 FROM participations p
              WHERE p.activity_type = 'training' AND p.activity_id = t.id::text AND p.member = ?::integer
            )
        `, [memberId, absence.reason || '', effectiveStart, endDate, memberId, memberId])
        declined += res?.rowCount || 0
      }

      // Games
      if (allTypes || affects.includes('games')) {
        const res = await database.raw(`
          INSERT INTO participations (member, activity_type, activity_id, status, note, guest_count, is_staff)
          SELECT ?::integer, 'game', g.id::text, 'declined', ?, 0, false
          FROM games g
          WHERE g.date >= ?::date AND g.date <= ?::date
            AND g.kscw_team IS NOT NULL
            AND COALESCE(g.status, '') NOT IN ('completed', 'postponed', 'cancelled')
            ${pgDowClause.replace(/d\.date/g, 'g.date')}
            AND EXISTS (SELECT 1 FROM member_teams mt WHERE mt.team = g.kscw_team AND mt.member = ?::integer)
            AND NOT EXISTS (
              SELECT 1 FROM participations p
              WHERE p.activity_type = 'game' AND p.activity_id = g.id::text AND p.member = ?::integer
            )
        `, [memberId, absence.reason || '', effectiveStart, endDate, memberId, memberId])
        declined += res?.rowCount || 0
      }

      // Events
      if (allTypes || affects.includes('events')) {
        const res = await database.raw(`
          INSERT INTO participations (member, activity_type, activity_id, status, note, guest_count, is_staff)
          SELECT ?::integer, 'event', e.id::text, 'declined', ?, 0, false
          FROM events e
          JOIN events_teams et ON et.events_id = e.id
          WHERE e.start_date::date >= ?::date AND e.start_date::date <= ?::date
            ${pgDowClause.replace(/d\.date/g, 'e.start_date::date')}
            AND EXISTS (SELECT 1 FROM member_teams mt WHERE mt.team = et.teams_id AND mt.member = ?::integer)
            AND NOT EXISTS (
              SELECT 1 FROM participations p
              WHERE p.activity_type = 'event' AND p.activity_id = e.id::text AND p.member = ?::integer
            )
        `, [memberId, absence.reason || '', effectiveStart, endDate, memberId, memberId])
        declined += res?.rowCount || 0
      }

      if (declined > 0) log.info(`[absence-auto-decline] Absence ${absenceId}: ${declined} activities declined for member ${memberId}`)
    } catch (err) {
      log.error({ msg: `[absence-auto-decline] ${err.message}`, event: 'absence_auto_decline', absenceId, stack: err.stack })
      logCronError('absence_auto_decline', err)
    }
  }

  action('absences.items.create', async ({ key }) => { await autoDeclineForAbsence(key) })
  action('absences.items.update', async ({ keys }) => { for (const k of keys) await autoDeclineForAbsence(k) })

  // When a training/game is created, auto-decline for members with overlapping absences
  action('trainings.items.create', async ({ key }) => {
    try {
      const training = await database('trainings').where('id', key).first()
      if (!training || training.cancelled || !training.team || !training.date) return
      const dateStr = training.date.toISOString?.().split('T')[0] || String(training.date).split('T')[0]
      // Postgres DOW for this date
      const pgDow = `EXTRACT(DOW FROM DATE '${dateStr}')`

      const res = await database.raw(`
        INSERT INTO participations (member, activity_type, activity_id, status, note, guest_count, is_staff)
        SELECT mt.member, 'training', ?::text, 'declined', COALESCE(a.reason, ''), 0, false
        FROM member_teams mt
        JOIN absences a ON a.member = mt.member
        WHERE mt.team = ?::integer
          AND a.start_date::date <= ?::date AND a.end_date::date >= ?::date
          AND (a.affects::jsonb @> '"all"' OR a.affects::jsonb @> '"trainings"')
          AND (a.type != 'weekly' OR (a.days_of_week::jsonb @> to_jsonb((${pgDow}::int + 6) % 7)))
          AND NOT EXISTS (
            SELECT 1 FROM participations p
            WHERE p.activity_type = 'training' AND p.activity_id = ?::text AND p.member = mt.member
          )
      `, [String(key), training.team, dateStr, dateStr, String(key)])
      if (res?.rowCount > 0) log.info(`[absence-auto-decline] Training ${key}: ${res.rowCount} members auto-declined`)
    } catch (err) {
      log.error({ msg: `[absence-auto-decline] Training create: ${err.message}`, event: 'absence_auto_decline_training', key, stack: err.stack })
    }
  })

  action('games.items.create', async ({ key }) => {
    try {
      const game = await database('games').where('id', key).first()
      if (!game || !game.kscw_team || !game.date) return
      const dateStr = game.date.toISOString?.().split('T')[0] || String(game.date).split('T')[0]
      const pgDow = `EXTRACT(DOW FROM DATE '${dateStr}')`

      const res = await database.raw(`
        INSERT INTO participations (member, activity_type, activity_id, status, note, guest_count, is_staff)
        SELECT mt.member, 'game', ?::text, 'declined', COALESCE(a.reason, ''), 0, false
        FROM member_teams mt
        JOIN absences a ON a.member = mt.member
        WHERE mt.team = ?::integer
          AND a.start_date::date <= ?::date AND a.end_date::date >= ?::date
          AND (a.affects::jsonb @> '"all"' OR a.affects::jsonb @> '"games"')
          AND (a.type != 'weekly' OR (a.days_of_week::jsonb @> to_jsonb((${pgDow}::int + 6) % 7)))
          AND NOT EXISTS (
            SELECT 1 FROM participations p
            WHERE p.activity_type = 'game' AND p.activity_id = ?::text AND p.member = mt.member
          )
      `, [String(key), game.kscw_team, dateStr, dateStr, String(key)])
      if (res?.rowCount > 0) log.info(`[absence-auto-decline] Game ${key}: ${res.rowCount} members auto-declined`)
    } catch (err) {
      log.error({ msg: `[absence-auto-decline] Game create: ${err.message}`, event: 'absence_auto_decline_game', key, stack: err.stack })
    }
  })

  // ── Cron: Absence Auto-Decline Sweep (01:30 UTC) ────────────────
  // Catches gaps: existing absences + newly generated recurring trainings,
  // or any edge case missed by the create/update hooks above.
  schedule('30 1 * * *', async () => {
    try {
      let total = 0

      // Trainings: decline for absent members who have no participation yet
      const t1 = await database.raw(`
        INSERT INTO participations (member, activity_type, activity_id, status, note, guest_count, is_staff)
        SELECT mt.member, 'training', t.id::text, 'declined', COALESCE(a.reason, ''), 0, false
        FROM trainings t
        JOIN member_teams mt ON mt.team = t.team
        JOIN absences a ON a.member = mt.member
        WHERE t.date >= CURRENT_DATE AND t.cancelled = false
          AND a.start_date::date <= t.date AND a.end_date::date >= t.date
          AND (a.affects::jsonb @> '"all"' OR a.affects::jsonb @> '"trainings"')
          AND (a.type != 'weekly' OR (a.days_of_week::jsonb @> to_jsonb(((EXTRACT(DOW FROM t.date)::int + 6) % 7))))
          AND NOT EXISTS (
            SELECT 1 FROM participations p
            WHERE p.activity_type = 'training' AND p.activity_id = t.id::text AND p.member = mt.member
          )
      `)
      total += t1?.rowCount || 0

      // Games
      const t2 = await database.raw(`
        INSERT INTO participations (member, activity_type, activity_id, status, note, guest_count, is_staff)
        SELECT mt.member, 'game', g.id::text, 'declined', COALESCE(a.reason, ''), 0, false
        FROM games g
        JOIN member_teams mt ON mt.team = g.kscw_team
        JOIN absences a ON a.member = mt.member
        WHERE g.date >= CURRENT_DATE AND g.kscw_team IS NOT NULL
          AND COALESCE(g.status, '') NOT IN ('completed', 'postponed', 'cancelled')
          AND a.start_date::date <= g.date AND a.end_date::date >= g.date
          AND (a.affects::jsonb @> '"all"' OR a.affects::jsonb @> '"games"')
          AND (a.type != 'weekly' OR (a.days_of_week::jsonb @> to_jsonb(((EXTRACT(DOW FROM g.date)::int + 6) % 7))))
          AND NOT EXISTS (
            SELECT 1 FROM participations p
            WHERE p.activity_type = 'game' AND p.activity_id = g.id::text AND p.member = mt.member
          )
      `)
      total += t2?.rowCount || 0

      // Events
      const t3 = await database.raw(`
        INSERT INTO participations (member, activity_type, activity_id, status, note, guest_count, is_staff)
        SELECT DISTINCT mt.member, 'event', e.id::text, 'declined', COALESCE(a.reason, ''), 0, false
        FROM events e
        JOIN events_teams et ON et.events_id = e.id
        JOIN member_teams mt ON mt.team = et.teams_id
        JOIN absences a ON a.member = mt.member
        WHERE e.start_date::date >= CURRENT_DATE
          AND a.start_date::date <= e.start_date::date AND a.end_date::date >= e.start_date::date
          AND (a.affects::jsonb @> '"all"' OR a.affects::jsonb @> '"events"')
          AND (a.type != 'weekly' OR (a.days_of_week::jsonb @> to_jsonb(((EXTRACT(DOW FROM e.start_date::date)::int + 6) % 7))))
          AND NOT EXISTS (
            SELECT 1 FROM participations p
            WHERE p.activity_type = 'event' AND p.activity_id = e.id::text AND p.member = mt.member
          )
      `)
      total += t3?.rowCount || 0

      if (total > 0) log.info(`[absence-sweep] Auto-declined ${total} participations`)
    } catch (err) {
      log.error({ msg: `[absence-sweep] ${err.message}`, event: 'cron.absence_sweep', stack: err.stack })
      logCronError('absence_sweep', err)
    }
  })

  // ── 2. Cron: Shell Account Expiry (02:00 UTC) ──────────────────
  // Batch UPDATE — no loop needed

  schedule('0 2 * * *', async () => {
    try {
      const count = await database('members')
        .where('shell', true)
        .where('shell_expires', '<', new Date().toISOString())
        .whereNotNull('shell_expires')
        .where('kscw_membership_active', true)
        .update({ kscw_membership_active: false })
      if (count > 0) log.info(`Shell expiry: ${count} deactivated`)
    } catch (err) {
      log.error({ msg: `Shell expiry: ${err.message}`, event: 'cron.shell_expiry', stack: err.stack })
      logCronError('shell_expiry', err)
    }
  })

  // ── 3. Cron: Invite Expiry (03:00 UTC) ─────────────────────────
  // Expire pending team_invites past their expiry date

  schedule('0 3 * * *', async () => {
    try {
      const count = await database('team_invites')
        .where('status', 'pending')
        .where('expires_at', '<', new Date().toISOString())
        .update({ status: 'expired' })
      if (count > 0) log.info(`Invite expiry: ${count} expired`)
    } catch (err) {
      log.error({ msg: `Invite expiry: ${err.message}`, event: 'cron.invite_expiry', stack: err.stack })
      logCronError('invite_expiry', err)
    }
  })

  // ── 4. Cron: Scorer Delegation Expiry (05:00 UTC) ──────────────
  // Expire pending delegations for past games

  schedule('0 5 * * *', async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const count = await database('scorer_delegations')
        .where('status', 'pending')
        .whereIn('game', function () {
          this.select('id').from('games').where('date', '<', today)
        })
        .update({ status: 'expired' })
      if (count > 0) log.info(`Delegation expiry: ${count} expired`)
    } catch (err) {
      log.error({ msg: `Delegation expiry: ${err.message}`, event: 'cron.delegation_expiry', stack: err.stack })
      logCronError('delegation_expiry', err)
    }
  })

  // ── 5. Cron: Notification Cleanup (04:00 UTC) ──────────────────
  // Delete notifications older than 60 days

  schedule('0 4 * * *', async () => {
    try {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 60)
      const count = await database('notifications')
        .where('date_created', '<', cutoff.toISOString())
        .delete()
      if (count > 0) log.info(`Notification cleanup: ${count} deleted`)
    } catch (err) {
      log.error({ msg: `Notification cleanup: ${err.message}`, event: 'cron.notification_cleanup', stack: err.stack })
      logCronError('notification_cleanup', err)
    }
  })

  // ── 6. Cron: Participation Reminders (07:00 UTC) ───────────────
  // Creates in-app notifications for unresponded members when deadline is tomorrow.
  // Uses batch INSERT...SELECT — no per-member loop.

  schedule('0 7 * * *', async () => {
    try {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]

      // Games with respond_by = tomorrow
      const gamesInserted = await database.raw(`
        INSERT INTO notifications (member, type, title, body, activity_type, activity_id, team, read)
        SELECT mt.member, 'deadline_reminder',
               'RSVP: ' || COALESCE(g.home_team, '') || ' vs ' || COALESCE(g.away_team, ''),
               COALESCE(g.date::text, ''),
               'game', g.id::text, g.kscw_team, false
        FROM games g
        JOIN member_teams mt ON mt.team = g.kscw_team
        WHERE g.respond_by::date = ?::date
          AND g.kscw_team IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM participations p
            WHERE p.activity_type = 'game' AND p.activity_id = g.id::text AND p.member = mt.member
          )
      `, [tomorrowStr])

      // Trainings with respond_by = tomorrow
      const trainingsInserted = await database.raw(`
        INSERT INTO notifications (member, type, title, body, activity_type, activity_id, team, read)
        SELECT mt.member, 'deadline_reminder',
               'RSVP: Training ' || COALESCE(t.date::text, ''),
               COALESCE(t.start_time::text, ''),
               'training', t.id::text, t.team, false
        FROM trainings t
        JOIN member_teams mt ON mt.team = t.team
        WHERE t.respond_by::date = ?::date
          AND t.team IS NOT NULL
          AND t.cancelled = false
          AND NOT EXISTS (
            SELECT 1 FROM participations p
            WHERE p.activity_type = 'training' AND p.activity_id = t.id::text AND p.member = mt.member
          )
      `, [tomorrowStr])

      // Auto-cancel trainings past deadline with insufficient participation
      const autoCancelled = await database.raw(`
        UPDATE trainings SET cancelled = true, cancel_reason = 'auto_cancel_min_not_met'
        WHERE auto_cancel_on_min = true
          AND cancelled = false
          AND respond_by IS NOT NULL
          AND respond_by::date <= CURRENT_DATE
          AND min_participants > 0
          AND (
            SELECT COUNT(*) FROM participations p
            WHERE p.activity_type = 'training' AND p.activity_id = trainings.id::text AND p.status = 'confirmed'
          ) < min_participants
      `)

      // Auto-decline tentatives past deadline (per-team feature)
      await database.raw(`
        UPDATE participations SET status = 'declined'
        WHERE status = 'tentative'
          AND activity_type IN ('game', 'training')
          AND EXISTS (
            SELECT 1 FROM (
              SELECT id::text AS aid, respond_by, team AS team_id FROM trainings WHERE respond_by IS NOT NULL
              UNION ALL
              SELECT id::text AS aid, respond_by, kscw_team AS team_id FROM games WHERE respond_by IS NOT NULL
            ) a
            JOIN teams t ON t.id = a.team_id
            WHERE a.aid = participations.activity_id
              AND a.respond_by::date <= CURRENT_DATE
              AND (t.features_enabled->>'auto_decline_tentative')::boolean = true
          )
      `)

      log.info(`Participation reminders: games=${gamesInserted?.rowCount || 0}, trainings=${trainingsInserted?.rowCount || 0}, auto-cancelled=${autoCancelled?.rowCount || 0}`)

      // Send push notifications for deadline reminders
      try {
        const deadlineMembers = await database('notifications')
          .where('type', 'deadline_reminder')
          .where('read', false)
          .whereRaw("date_created::date = CURRENT_DATE")
          .distinct('member')
          .pluck('member')
        if (deadlineMembers.length > 0) {
          await sendPushToMembers(database, deadlineMembers, 'RSVP Erinnerung', 'Anmeldefrist läuft morgen ab', FRONTEND_URL, 'deadline_reminder', log)
        }
      } catch (pushErr) {
        log.warn({ msg: `Deadline push: ${pushErr.message}`, event: 'cron.deadline_push', stack: pushErr.stack })
        logCronError('deadline_push', pushErr)
      }
    } catch (err) {
      log.error({ msg: `Participation reminders: ${err.message}`, event: 'cron.participation_reminders', stack: err.stack })
      logCronError('participation_reminders', err)
    }
  })

  // ── 7. Cron: Daily Notification Reminders (06:30 UTC) ──────────
  // Upcoming activity notifications for tomorrow's games/trainings/events

  schedule('30 6 * * *', async () => {
    try {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]

      // Games tomorrow
      await database.raw(`
        INSERT INTO notifications (member, type, title, body, activity_type, activity_id, team, read)
        SELECT mt.member, 'upcoming_activity',
               'upcoming_game',
               json_build_object(
                 'home_team', COALESCE(g.home_team, ''),
                 'away_team', COALESCE(g.away_team, ''),
                 'date', COALESCE(to_char(g.date, 'DD.MM.YY'), ''),
                 'time', COALESCE(to_char(g.time, 'HH24:MI'), ''),
                 'hall', COALESCE(h.name, '')
               )::text,
               'game', g.id::text, g.kscw_team, false
        FROM games g
        JOIN member_teams mt ON mt.team = g.kscw_team
        LEFT JOIN halls h ON h.id = g.hall
        WHERE g.date = ?::date AND g.kscw_team IS NOT NULL
          AND COALESCE(g.status, '') NOT IN ('completed', 'postponed', 'cancelled')
      `, [tomorrowStr])

      // Trainings tomorrow
      await database.raw(`
        INSERT INTO notifications (member, type, title, body, activity_type, activity_id, team, read)
        SELECT mt.member, 'upcoming_activity',
               'upcoming_training',
               json_build_object(
                 'date', COALESCE(to_char(t.date, 'DD.MM.YY'), ''),
                 'time', COALESCE(to_char(t.start_time, 'HH24:MI'), ''),
                 'hall', COALESCE(h.name, '')
               )::text,
               'training', t.id::text, t.team, false
        FROM trainings t
        JOIN member_teams mt ON mt.team = t.team
        LEFT JOIN halls h ON h.id = t.hall
        WHERE t.date = ?::date AND t.team IS NOT NULL AND t.cancelled = false
      `, [tomorrowStr])

      // Events tomorrow
      await database.raw(`
        INSERT INTO notifications (member, type, title, body, activity_type, activity_id, team, read)
        SELECT DISTINCT mt.member, 'upcoming_activity',
               'upcoming_event',
               json_build_object(
                 'title', COALESCE(e.title, 'Event'),
                 'date', COALESCE(to_char(e.start_date, 'DD.MM.YY'), ''),
                 'time', COALESCE(to_char(e.start_date, 'HH24:MI'), ''),
                 'location', COALESCE(NULLIF(h.name, ''), e.location, '')
               )::text,
               'event', e.id::text, et.teams_id, false
        FROM events e
        JOIN events_teams et ON et.events_id = e.id
        JOIN member_teams mt ON mt.team = et.teams_id
        LEFT JOIN halls h ON h.id = e.hall
        WHERE e.start_date::date = ?::date
      `, [tomorrowStr])

      log.info('Daily notification reminders sent')

      // Send push notifications for upcoming activities
      try {
        const upcomingMembers = await database('notifications')
          .where('type', 'upcoming_activity')
          .where('read', false)
          .whereRaw("date_created::date = CURRENT_DATE")
          .distinct('member')
          .pluck('member')
        if (upcomingMembers.length > 0) {
          await sendPushToMembers(database, upcomingMembers, 'Morgen', 'Du hast morgen eine Aktivität', FRONTEND_URL, 'upcoming_activity', log)
        }
      } catch (pushErr) {
        log.warn({ msg: `Upcoming push: ${pushErr.message}`, event: 'cron.upcoming_push', stack: pushErr.stack })
        logCronError('upcoming_push', pushErr)
      }
    } catch (err) {
      log.error({ msg: `Daily reminders: ${err.message}`, event: 'cron.daily_reminders', stack: err.stack })
      logCronError('daily_reminders', err)
    }
  })

  // ── 8. Cron: Shell Reminder (09:00 UTC) ────────────────────────
  // Email shell members 10 days before expiry

  schedule('0 9 * * *', async () => {
    try {
      const reminderDate = new Date()
      reminderDate.setDate(reminderDate.getDate() + 10)
      const reminderStr = reminderDate.toISOString().split('T')[0]

      const expiring = await database('members')
        .where('shell', true)
        .where('kscw_membership_active', true)
        .where('shell_reminder_sent', false)
        .whereNotNull('shell_expires')
        .whereRaw("shell_expires::date <= ?::date", [reminderStr])
        .select('id', 'email', 'first_name', 'shell_expires')

      if (expiring.length === 0) return

      const schema = await getSchema()
      const { MailService } = services
      const mailService = new MailService({ schema, knex: database })

      for (const m of expiring) {
        if (!m.email || m.email.includes('@placeholder')) continue
        try {
          await mailService.send({
            to: m.email,
            subject: 'WiediSync — Dein Gastkonto läuft bald ab',
            text: `Hallo ${m.first_name || ''},\n\nDein WiediSync-Gastkonto läuft am ${m.shell_expires} ab.\nMelde dich bei deinem Coach, um es zu verlängern.\n\nKSC Wiedikon`,
          })
          await database('members').where('id', m.id).update({ shell_reminder_sent: true })
        } catch (mailErr) {
          log.warn({ msg: `Shell reminder mail failed for member ${m.id}`, event: 'cron.shell_reminder', memberId: m.id, stack: mailErr.stack })
          logCronError('shell_reminder_mail', mailErr, { memberId: m.id })
        }
      }
      log.info(`Shell reminder: ${expiring.length} members notified`)
    } catch (err) {
      log.error({ msg: `Shell reminder: ${err.message}`, event: 'cron.shell_reminder', stack: err.stack })
      logCronError('shell_reminder', err)
    }
  })

  // ── 9. Cron: Swiss Volley Sync (06:00 UTC) ────────────────────
  // Calls the existing SV sync endpoint via internal HTTP

  schedule('0 6 * * *', async () => {
    const token = process.env.DIRECTUS_ADMIN_TOKEN
    if (!token) { log.warn('SV sync skipped: DIRECTUS_ADMIN_TOKEN not set'); return }
    try {
      const res = await fetch('http://localhost:8055/kscw/admin/sv-sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.text()
      if (!res.ok) throw new Error(`${res.status} ${body}`)
      log.info(`SV sync cron: ${body}`)
    } catch (err) {
      log.error({ msg: `SV sync cron: ${err.message}`, event: 'cron.sv_sync', stack: err.stack })
      logCronError('sv_sync', err)
    }
  })

  // ── 10. Cron: Basketplan Sync (06:05 UTC) ─────────────────────
  // Calls the existing BP sync endpoint via internal HTTP

  schedule('5 6 * * *', async () => {
    const token = process.env.DIRECTUS_ADMIN_TOKEN
    if (!token) { log.warn('BP sync skipped: DIRECTUS_ADMIN_TOKEN not set'); return }
    try {
      const res = await fetch('http://localhost:8055/kscw/admin/bp-sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.text()
      if (!res.ok) throw new Error(`${res.status} ${body}`)
      log.info(`BP sync cron: ${body}`)
    } catch (err) {
      log.error({ msg: `BP sync cron: ${err.message}`, event: 'cron.bp_sync', stack: err.stack })
      logCronError('bp_sync', err)
    }
  })

  // ── 10b. Cron: Volleymanager Sync (1st of each month, 04:00 UTC) ──
  // Calls the vm-sync-check script via the admin endpoint

  schedule('0 4 1 * *', async () => {
    const token = process.env.DIRECTUS_ADMIN_TOKEN
    if (!token) { log.warn('VM sync skipped: DIRECTUS_ADMIN_TOKEN not set'); return }
    if (!process.env.VM_USERNAME || !process.env.VM_PASSWORD) {
      log.warn('VM sync skipped: VM_USERNAME or VM_PASSWORD not set')
      return
    }
    try {
      const { execSync } = await import('node:child_process')
      // Only pass required env vars to child process (avoid leaking secrets in crash dumps)
      const env = {
        HOME: process.env.HOME,
        PATH: process.env.PATH,
        VM_USERNAME: process.env.VM_USERNAME,
        VM_PASSWORD: process.env.VM_PASSWORD,
        DIRECTUS_URL: 'http://127.0.0.1:8055',
        DIRECTUS_TOKEN: token,
      }
      const output = execSync('node /directus/scripts/vm-sync-check.mjs', {
        env,
        timeout: 120_000,
        encoding: 'utf-8',
      })
      log.info(`VM sync cron: ${output.split('\n').slice(-6).join(' | ')}`)
    } catch (err) {
      log.error({ msg: `VM sync cron: ${err.message}`, exitCode: err.status, event: 'cron.vm_sync' })
      logCronError('vm_sync', new Error(err.message))
    }
  })

  // ── 11. Filter: Member Privacy (birthdate_visibility, hide_phone) ──
  // Enforces privacy settings at the API level so even direct API access respects them.
  // Admins and the member's own record are exempt.

  filter('members.items.read', async (payload, meta, context) => {
    // Admins see everything
    if (context.accountability?.admin) return payload

    const currentUser = context.accountability?.user || null

    const items = Array.isArray(payload) ? payload : [payload]
    for (const item of items) {
      if (!item) continue

      // Skip filtering for the member's own record
      if (currentUser && item.user === currentUser) continue

      // Birthdate visibility
      if (item.birthdate_visibility === 'hidden') {
        item.birthdate = null
      } else if (item.birthdate_visibility === 'year_only' && item.birthdate) {
        // Extract just the year (handles both '1990-01-01' and ISO datetime strings)
        item.birthdate = String(item.birthdate).substring(0, 4)
      }

      // Phone visibility
      if (item.hide_phone === true) {
        item.phone = null
      }

      // AHV number — only visible to self and admins
      item.ahv_nummer = null
    }

    return Array.isArray(payload) ? items : items[0]
  })

  // ── 12. Cron: Error Log Cleanup (03:30 UTC) ─────────────────────
  // Delete error log files older than 30 days

  schedule('30 3 * * *', () => {
    try {
      cleanOldLogs()
      log.info('Error log cleanup completed')
    } catch (err) {
      log.error({ msg: `Error log cleanup: ${err.message}`, event: 'cron.error_log_cleanup', stack: err.stack })
    }
  })

  // ── 13. Registration Approval → CSV email ─────────────────────
  // When a registration status changes to 'approved', generate a CSV
  // and email it to the owner (luca.canepa@gmail.com)

  const OWNER_EMAIL = 'luca.canepa@gmail.com'
  const RADO_EMAIL = 'radomir.radovanovic.b@gmail.com'
  const VB_ADMIN_EMAIL = 'thamayanth.kanagalingam@uzh.ch'
  const BB_ADMIN_EMAIL = 'kscwiedikonbasketball@gmail.com'

  function getApprovalRecipients(membershipType) {
    switch (membershipType) {
      case 'basketball':
        return { to: [BB_ADMIN_EMAIL], cc: [OWNER_EMAIL] }
      case 'volleyball':
        return { to: [VB_ADMIN_EMAIL, RADO_EMAIL], cc: [OWNER_EMAIL] }
      default: // passive, unknown
        return { to: [OWNER_EMAIL], cc: [] }
    }
  }

  function csvEscapeHook(val) {
    const s = String(val ?? '')
    if (s.includes(';') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }

  function buildRegistrationCSV(item) {
    const headers = [
      'Nachname', 'Vorname', 'Firma', 'Adresse', 'PLZ', 'Ort',
      'Telefon Privat', 'Telefon Mobil', '[Gruppen]', 'Sektion', 'Gruppe', 'Gruppen',
      'Anrede', 'Titel', 'Briefanrede', 'Benutzer-Id', 'Adress-Zusatz', 'Land',
      'Nationalität', 'Telefon Geschäft', 'Fax', 'E-Mail', 'E-Mail Alternativ',
      'Status', '[Rolle]', 'Eintritt', 'Mitgliedsjahre', 'Austritt', 'Zivilstand',
      'Geschlecht', 'Geburtsdatum', 'Jahrgang', 'Alter', 'Bemerkungen',
      'Firmen-Webseite', 'Rechnungsversand', 'Nie mahnen', 'IBAN', 'BIC', 'Kontoinhaber',
      'Lizenznummer', 'Lizenzart', 'Lizenz bestellt', 'Beitragskategorie',
      'Betrag Bezahlt', 'Clubnummer', 'Mittelschule ZH', 'Offiziellen Lizenz',
      'Mitgliederbeitrag', 'AHV Nummer', 'Passivmitglied', 'Offiziellen 100er',
      'Funktion', 'Rolle'
    ]

    let dob = ''
    let jahrgang = ''
    if (item.geburtsdatum) {
      const parts = String(item.geburtsdatum).substring(0, 10).split('-')
      dob = parts[2] + '.' + parts[1] + '.' + parts[0]
      jahrgang = parts[0]
    }

    const now = new Date()
    const todayStr = String(now.getDate()).padStart(2, '0') + '.' +
      String(now.getMonth() + 1).padStart(2, '0') + '.' + now.getFullYear()

    const sektion = item.membership_type === 'volleyball' ? 'Volleyball'
      : item.membership_type === 'basketball' ? 'Basketball' : 'KSCW'
    const status = item.membership_type === 'passive' ? 'Passivmitglied' : 'Aktivmitglied'
    const isPassive = item.membership_type === 'passive' ? 'ja' : ''

    const row = [
      item.nachname || '', item.vorname || '', '',
      item.adresse || '', item.plz || '', item.ort || '',
      '', item.telefon_mobil || '',
      item.team || '', sektion, '', '',
      item.anrede || '', '', '', '', '', 'Schweiz',
      item.nationalitaet || '', '', '',
      item.email || '', '',
      status, '', todayStr, '', '', '',
      item.geschlecht || '', dob, jahrgang, '',
      item.bemerkungen || '',
      '', 'E-Mail', 'Nein', '', '', '',
      '', '', '',
      item.beitragskategorie || '',
      '', '',
      item.kantonsschule || '',
      item.lizenz || '',
      '',
      item.ahv_nummer || '',
      isPassive, '',
      item.rolle || '', '',
    ].map(csvEscapeHook)

    return '\uFEFF' + headers.join(';') + '\n' + row.join(';')
  }

  // ── i18n for registration status emails ───────────────────────
  const REG_T = {
    de: {
      approvedTitle: 'Anmeldung bestätigt',
      approvedSubtitle: 'Willkommen beim KSC Wiedikon!',
      approvedSubject: 'Anmeldung bestätigt — KSC Wiedikon',
      approvedGreeting: name => `Hallo ${name},`,
      approvedBody: `<p style="text-align:justify">Deine Anmeldung wurde geprüft und bestätigt. Willkommen beim KSC Wiedikon!</p>
        <p style="text-align:justify"><strong style="color:#e2e8f0">Nächster Schritt:</strong> Erstelle dein Konto auf unserer Vereinsplattform WiediSync, um Spielpläne, Trainings und Teaminfos zu sehen.</p>
        <p style="text-align:justify">Bei Fragen erreichst du uns unter <a href="mailto:kontakt@kscw.ch" style="color:#4A55A2">kontakt@kscw.ch</a>.</p>`,
      approvedCtaLabel: 'Konto erstellen',
      approvedFooter: 'Sportliche Grüsse — KSC Wiedikon',
      rejectedTitle: 'Anmeldung abgelehnt',
      rejectedSubtitle: 'KSC Wiedikon',
      rejectedSubject: 'Anmeldung abgelehnt — KSC Wiedikon',
      rejectedGreeting: name => `Hallo ${name},`,
      rejectedReasonLabel: 'Begründung',
      rejectedBody: `<p style="text-align:justify">Leider wurde deine Anmeldung abgelehnt.</p>`,
      rejectedContact: `<p style="text-align:justify">Falls du Fragen hast, melde dich bei <a href="mailto:kontakt@kscw.ch" style="color:#4A55A2">kontakt@kscw.ch</a>.</p>`,
      rejectedFooter: 'KSC Wiedikon',
      name: 'Name', team: 'Team', sport: 'Sportart', ref: 'Referenz',
    },
    en: {
      approvedTitle: 'Registration Approved',
      approvedSubtitle: 'Welcome to KSC Wiedikon!',
      approvedSubject: 'Registration Approved — KSC Wiedikon',
      approvedGreeting: name => `Hello ${name},`,
      approvedBody: `<p style="text-align:justify">Your registration has been reviewed and approved. Welcome to KSC Wiedikon!</p>
        <p style="text-align:justify"><strong style="color:#e2e8f0">Next step:</strong> Create your account on our club platform WiediSync to see schedules, trainings, and team info.</p>
        <p style="text-align:justify">For questions, reach us at <a href="mailto:kontakt@kscw.ch" style="color:#4A55A2">kontakt@kscw.ch</a>.</p>`,
      approvedCtaLabel: 'Create account',
      approvedFooter: 'Best regards — KSC Wiedikon',
      rejectedTitle: 'Registration Rejected',
      rejectedSubtitle: 'KSC Wiedikon',
      rejectedSubject: 'Registration Rejected — KSC Wiedikon',
      rejectedGreeting: name => `Hello ${name},`,
      rejectedReasonLabel: 'Reason',
      rejectedBody: `<p style="text-align:justify">Unfortunately, your registration has been rejected.</p>`,
      rejectedContact: `<p style="text-align:justify">If you have any questions, contact us at <a href="mailto:kontakt@kscw.ch" style="color:#4A55A2">kontakt@kscw.ch</a>.</p>`,
      rejectedFooter: 'KSC Wiedikon',
      name: 'Name', team: 'Team', sport: 'Sport', ref: 'Reference',
    },
  }
  function regT(locale) { return REG_T[locale] || REG_T.de }

  // ── Helper: season string (e.g. "2025/26") ─────────────────────
  function getCurrentSeason() {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    return m < 8 ? `${y - 1}/${String(y).slice(2)}` : `${y}/${String(y + 1).slice(2)}`
  }

  // ── Normalize registration geschlecht to member sex (m/f) ───
  function normalizeSex(val) {
    if (!val) return null
    const v = val.toLowerCase()
    if (v === 'm' || v === 'männlich' || v === 'male') return 'm'
    if (v === 'f' || v === 'weiblich' || v === 'female') return 'f'
    return null
  }

  // ── Map registration licence strings to member licence codes ───
  function mapLicences(lizenzStr, membershipType) {
    if (!lizenzStr) return []
    const parts = lizenzStr.split(',').map(s => s.trim().toLowerCase())
    const mapped = []
    for (const p of parts) {
      if (membershipType === 'volleyball') {
        if (p.includes('schreiber') || p === 'scorer') mapped.push('scorer_vb')
        if (p.includes('schiedsrichter') || p === 'referee') mapped.push('referee_vb')
      } else if (membershipType === 'basketball') {
        if (p.includes('otr 1') || p === 'otr1') mapped.push('otr1_bb')
        if (p.includes('otr 2') || p === 'otr2') mapped.push('otr2_bb')
        if (p.includes('otn')) mapped.push('otn_bb')
        if (p.includes('schiedsrichter') || p === 'referee') mapped.push('referee_bb')
      }
    }
    return [...new Set(mapped)]
  }

  // ── Create or link member from approved registration ───────────
  async function createMemberFromRegistration(db, reg, log) {
    const email = reg.email.toLowerCase().trim()
    const rolle = (reg.rolle || '').toLowerCase()

    // 1. Check if member already exists
    const existingMember = await db('members').where('email', email).first()

    let memberId
    if (existingMember) {
      memberId = existingMember.id
      log.info({ msg: 'Member already exists, linking registration', memberId, email })
      // Update fields that might be missing
      const updates = {}
      if (!existingMember.phone && reg.telefon_mobil) updates.phone = reg.telefon_mobil
      if (!existingMember.adresse && reg.adresse) updates.adresse = reg.adresse
      if (!existingMember.plz && reg.plz) updates.plz = reg.plz
      if (!existingMember.ort && reg.ort) updates.ort = reg.ort
      if (!existingMember.nationalitaet && reg.nationalitaet) updates.nationalitaet = reg.nationalitaet
      if (!existingMember.sex && reg.geschlecht) updates.sex = normalizeSex(reg.geschlecht)
      if (!existingMember.ahv_nummer && reg.ahv_nummer) updates.ahv_nummer = reg.ahv_nummer
      if (!existingMember.beitragskategorie && reg.beitragskategorie) updates.beitragskategorie = reg.beitragskategorie
      // Merge licences
      const existingLicences = existingMember.licences || []
      const newLicences = mapLicences(reg.lizenz, reg.membership_type)
      const mergedLicences = [...new Set([...existingLicences, ...newLicences])]
      if (mergedLicences.length > existingLicences.length) {
        updates.licences = JSON.stringify(mergedLicences)
      }
      if (Object.keys(updates).length) {
        await db('members').where('id', memberId).update(updates)
      }
    } else {
      // 2. Create new shell member
      const shellExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const licences = mapLicences(reg.lizenz, reg.membership_type)
      const lang = reg.locale === 'en' ? 'english' : 'german'

      const [member] = await db('members').insert({
        first_name: reg.vorname,
        last_name: reg.nachname,
        email,
        phone: reg.telefon_mobil || null,
        adresse: reg.adresse || null,
        plz: reg.plz || null,
        ort: reg.ort || null,
        birthdate: reg.geburtsdatum || null,
        nationalitaet: reg.nationalitaet || null,
        sex: normalizeSex(reg.geschlecht),
        ahv_nummer: reg.ahv_nummer || null,
        beitragskategorie: reg.beitragskategorie || null,
        licences: JSON.stringify(licences),
        shell: true,
        shell_expires: shellExpires,
        shell_reminder_sent: false,
        wiedisync_active: false,
        coach_approved_team: true,
        kscw_membership_active: true,
        birthdate_visibility: 'hidden',
        language: lang,
        role: JSON.stringify(['user']),
      }).returning('id')

      memberId = member.id || member
      log.info({ msg: 'Shell member created from registration', memberId, email })
    }

    // 3. Link to team(s) based on rolle
    if (reg.team && reg.membership_type !== 'passive') {
      const teamNames = reg.team.split(',').map(t => t.trim()).filter(Boolean)
      const teamRows = await db('teams')
        .whereIn('name', teamNames).andWhere('active', true).select('id', 'name')

      const season = getCurrentSeason()

      for (const team of teamRows) {
        if (rolle.includes('trainer') || rolle.includes('coach')) {
          // Coach → teams_coaches
          const exists = await db('teams_coaches')
            .where({ teams_id: team.id, members_id: memberId }).first()
          if (!exists) {
            await db('teams_coaches').insert({ teams_id: team.id, members_id: memberId })
            log.info({ msg: 'Added as coach', memberId, team: team.name })
          }
        } else if (rolle.includes('teamverantwortlich') || rolle.includes('team responsible')) {
          // Team Responsible → teams_responsibles
          const exists = await db('teams_responsibles')
            .where({ teams_id: team.id, members_id: memberId }).first()
          if (!exists) {
            await db('teams_responsibles').insert({ teams_id: team.id, members_id: memberId })
            log.info({ msg: 'Added as team responsible', memberId, team: team.name })
          }
        } else if (rolle.includes('spieler') || rolle.includes('player') || !rolle || rolle.includes('andere') || rolle.includes('other')) {
          // Player → member_teams
          const exists = await db('member_teams')
            .where({ member: memberId, team: team.id, season }).first()
          if (!exists) {
            await db('member_teams').insert({
              member: memberId, team: team.id, season, guest_level: 0,
            })
            log.info({ msg: 'Added to team roster', memberId, team: team.name, season })
          }
        }
      }
    }

    return memberId
  }

  action('items.update', async ({ collection, keys, payload }, { schema }) => {
    if (collection !== 'registrations') return
    if (payload.status !== 'approved' && payload.status !== 'rejected') return

    try {
      const { ItemsService, MailService } = services
      const itemsService = new ItemsService('registrations', { schema, knex: database })
      const mail = new MailService({ schema, knex: database })

      for (const id of keys) {
        const reg = await itemsService.readOne(id)
        const locale = reg.locale || 'de'
        const l = regT(locale)
        const sport = reg.membership_type === 'volleyball' ? 'volleyball'
          : reg.membership_type === 'basketball' ? 'basketball' : null

        const summaryCard = buildInfoCard([
          { label: l.name, value: `${reg.vorname} ${reg.nachname}`, halfWidth: true },
          { label: l.sport, value: reg.membership_type.charAt(0).toUpperCase() + reg.membership_type.slice(1), halfWidth: true },
          { label: l.team, value: reg.team || '-', halfWidth: true },
          { label: l.ref, value: reg.reference_number, halfWidth: true },
        ])

        if (payload.status === 'approved') {
          // ── 1. Gather coach/TR emails for CC ──
          let coachTrCc = []
          if (reg.team && reg.membership_type !== 'passive') {
            try {
              const teamNames = reg.team.split(',').map(t => t.trim()).filter(Boolean)
              const teamRows = await database('teams')
                .whereIn('name', teamNames).andWhere('active', true).select('id')
              if (teamRows.length) {
                const teamIds = teamRows.map(r => r.id)
                const coachRows = await database('teams_coaches')
                  .whereIn('teams_id', teamIds)
                  .join('members', 'teams_coaches.members_id', 'members.id')
                  .join('directus_users', 'members.user', 'directus_users.id')
                  .whereNotNull('directus_users.email').select('directus_users.email')
                const trRows = await database('teams_responsibles')
                  .whereIn('teams_id', teamIds)
                  .join('members', 'teams_responsibles.members_id', 'members.id')
                  .join('directus_users', 'members.user', 'directus_users.id')
                  .whereNotNull('directus_users.email').select('directus_users.email')
                coachTrCc = [...new Set([...coachRows, ...trRows].map(r => r.email.toLowerCase()))]
                  .filter(e => e !== reg.email.toLowerCase())
              }
            } catch (teamErr) {
              log.warn({ msg: `Coach/TR lookup failed: ${teamErr.message}`, id })
            }
          }

          // ── 2. Confirmation email to user (CC coach/TR) ──
          const approvalHtml = buildEmailLayout(
            summaryCard + `<div style="font-size:13px;color:#94a3b8;line-height:1.7;margin-top:12px">${l.approvedBody}</div>`,
            { title: l.approvedTitle, subtitle: l.approvedSubtitle, sport, greeting: l.approvedGreeting(reg.vorname), footerExtra: l.approvedFooter, ctaUrl: `${FRONTEND_URL}/signup`, ctaLabel: l.approvedCtaLabel }
          )
          await mail.send({
            to: reg.email,
            ...(coachTrCc.length ? { cc: coachTrCc } : {}),
            subject: l.approvedSubject,
            html: approvalHtml,
          })
          log.info({ msg: 'Approval confirmation sent', id, email: reg.email, cc: coachTrCc.length })

          // ── 3. Create or link member in Directus ──
          try {
            await createMemberFromRegistration(database, reg, log)
          } catch (memberErr) {
            log.error({ msg: `Member creation failed: ${memberErr.message}`, id, stack: memberErr.stack })
          }

          // ── 4. CSV email to sport-specific admins ──
          const csv = buildRegistrationCSV(reg)
          const csvBuffer = Buffer.from(csv, 'utf-8')
          const filename = `anmeldung_${reg.nachname}_${reg.vorname}_${reg.reference_number}.csv`
          const recipients = getApprovalRecipients(reg.membership_type)
          const adminCsvBody = buildInfoCard([
            { label: 'Name', value: `${reg.vorname} ${reg.nachname}`, halfWidth: true },
            { label: 'Typ', value: reg.membership_type, halfWidth: true },
            { label: 'Team', value: reg.team || '-', halfWidth: true },
            { label: 'E-Mail', value: reg.email, halfWidth: true },
            { label: 'Referenz', value: reg.reference_number },
          ]) + `<div style="font-size:13px;color:#94a3b8;line-height:1.7;margin-top:12px;text-align:justify"><p>Die Anmeldung wurde bestätigt. Die CSV-Datei für den ClubDesk-Import ist im Anhang.</p></div>`
          const adminCsvHtml = buildEmailLayout(adminCsvBody, {
            title: 'Anmeldung bestätigt',
            subtitle: `${reg.vorname} ${reg.nachname} — ${reg.membership_type}`,
            sport,
            ctaUrl: 'https://wiedisync.kscw.ch/admin/anmeldungen',
            ctaLabel: 'Im Admin öffnen',
          })
          await mail.send({
            to: recipients.to,
            ...(recipients.cc.length ? { cc: recipients.cc } : {}),
            subject: `[KSCW] Anmeldung bestätigt: ${reg.vorname} ${reg.nachname} (${reg.membership_type})`,
            html: adminCsvHtml,
            attachments: [{ filename, content: csvBuffer, contentType: 'application/vnd.ms-excel' }],
          })
          log.info({ msg: 'Approval CSV sent', id, ref: reg.reference_number })

        } else if (payload.status === 'rejected') {
          // ── Rejection email to user ──
          const reason = payload.rejection_reason || reg.rejection_reason || ''
          const reasonBlock = reason
            ? `<div style="background:#450a0a;border:1px solid #7f1d1d;border-radius:8px;padding:12px 16px;margin:12px 0"><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#f87171;font-weight:700;margin-bottom:4px">${l.rejectedReasonLabel}</div><div style="font-size:13px;color:#fca5a5">${reason}</div></div>`
            : ''
          const rejectionHtml = buildEmailLayout(
            summaryCard + `<div style="font-size:13px;color:#94a3b8;line-height:1.7;margin-top:12px">${l.rejectedBody}</div>` + reasonBlock + `<div style="font-size:13px;color:#94a3b8;line-height:1.7;margin-top:12px">${l.rejectedContact}</div>`,
            { title: l.rejectedTitle, subtitle: l.rejectedSubtitle, greeting: l.rejectedGreeting(reg.vorname), footerExtra: l.rejectedFooter }
          )
          await mail.send({ to: reg.email, subject: l.rejectedSubject, html: rejectionHtml })
          log.info({ msg: 'Rejection email sent to user', id, email: reg.email })
        }
      }
    } catch (err) {
      log.error({ msg: `Registration status email: ${err.message}`, event: 'registration.status', stack: err.stack })
    }
  })

  log.info('KSCW hooks loaded: role-sync (5 actions, 2 filters), Turnstile, member privacy, registration approval, 10 crons (validations+notifications in Postgres)')
}
