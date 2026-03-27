/**
 * KSCW Directus Hooks Extension
 *
 * Migrated from PocketBase hooks. Covers:
 * 1. Data integrity (team_permissions, member_defaults)
 * 2. Activity tracking (wiedisync_active on auth)
 * 3. Notifications (activity changes)
 * 4. Participation guards (guest bumping, waitlist)
 */

export default ({ filter, action, schedule, init }, { services, database, logger, getSchema }) => {
  const log = logger.child({ extension: 'kscw-hooks' })

  // ── 1. Member Defaults ──────────────────────────────────────────
  // Ensure required fields on member creation (was: member_defaults.pb.js)

  filter('members.items.create', async (payload) => {
    if (!payload.language) payload.language = 'german'
    if (payload.kscw_membership_active === undefined) payload.kscw_membership_active = true
    if (payload.wiedisync_active === undefined) payload.wiedisync_active = false
    if (payload.birthdate_visibility === undefined) payload.birthdate_visibility = 'full'
    return payload
  })

  // ── 2. Team Permission Guards ───────────────────────────────────
  // Enforce coach_approved_team requires member_teams (was: team_permissions.pb.js)

  filter('members.items.update', async (payload, meta, { database: db }) => {
    if (payload.coach_approved_team === true) {
      const memberId = meta.keys?.[0]
      if (memberId) {
        const mt = await db('member_teams').where('member', memberId).first()
        if (!mt) {
          throw new Error('Cannot approve team coaching without member_teams record')
        }
      }
    }
    return payload
  })

  // ── 3. Wiedisync Active on Auth ─────────────────────────────────
  // Mark wiedisync_active=true on successful login (was: wiedisync_active.pb.js)

  action('auth.login', async ({ user }, { database: db }) => {
    if (!user) return
    try {
      // Find member linked to this user
      const member = await db('members').where('user', user).first()
      if (member && !member.wiedisync_active) {
        await db('members').where('id', member.id).update({ wiedisync_active: true })
        log.info(`Member ${member.id} marked wiedisync_active`)
      }
    } catch (err) {
      log.warn(`wiedisync_active update failed: ${err.message}`)
    }
  })

  // ── 4. Participation Priority & Guest Bumping ───────────────────
  // Block guests from game confirmations, handle waitlist (was: participation_priority.pb.js)

  filter('participations.items.create', async (payload, meta, { database: db }) => {
    if (payload.activity_type === 'game' && payload.status === 'confirmed') {
      // Check if member is a guest (guest_level > 0)
      if (payload.member) {
        const mt = await db('member_teams')
          .where('member', payload.member)
          .where('guest_level', '>', 0)
          .first()
        if (mt) {
          throw new Error('Guests cannot directly confirm game participation')
        }
      }
    }
    return payload
  })

  // ── 5. Slot Claim Validation ────────────────────────────────────
  // No past dates, no duplicates (was: slot_claims.pb.js)

  filter('slot_claims.items.create', async (payload, meta, { database: db }) => {
    if (payload.date) {
      const claimDate = new Date(payload.date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (claimDate < today) {
        throw new Error('Cannot claim slots in the past')
      }
    }

    // Check for duplicate active claims
    if (payload.hall_slot && payload.date) {
      const existing = await db('slot_claims')
        .where('hall_slot', payload.hall_slot)
        .where('date', payload.date)
        .where('status', 'active')
        .first()
      if (existing) {
        throw new Error('This slot is already claimed for this date')
      }
    }

    return payload
  })

  // ── 6. Auto-revoke slot claims when training uncancelled ────────

  action('trainings.items.update', async (meta, { database: db }) => {
    const keys = meta.keys || []
    for (const id of keys) {
      try {
        const training = await db('trainings').where('id', id).first()
        if (training && !training.cancelled && training.hall_slot) {
          // If training was uncancelled, revoke any active claims on its slot for that date
          await db('slot_claims')
            .where('hall_slot', training.hall_slot)
            .where('date', training.date)
            .where('freed_reason', 'cancelled_training')
            .where('status', 'active')
            .update({ status: 'revoked' })
        }
      } catch (err) {
        log.warn(`Slot claim auto-revoke failed for training ${id}: ${err.message}`)
      }
    }
  })

  // ── 7. Notification on Activity Changes ─────────────────────────
  // Create notifications when games/trainings/events change (was: notifications.pb.js)

  action('games.items.update', async (meta, { database: db }) => {
    const keys = meta.keys || []
    for (const id of keys) {
      try {
        const game = await db('games').where('id', id).first()
        if (!game || !game.kscw_team) continue

        // Get team members
        const members = await db('member_teams')
          .where('team', game.kscw_team)
          .select('member')

        for (const { member } of members) {
          await db('notifications').insert({
            member,
            type: 'activity_change',
            title: `Game updated: ${game.home_team} vs ${game.away_team}`,
            body: `${game.date} ${game.time || ''}`,
            activity_type: 'game',
            activity_id: String(id),
            team: game.kscw_team,
            read: false,
          })
        }
      } catch (err) {
        log.warn(`Game notification failed for ${id}: ${err.message}`)
      }
    }
  })

  action('trainings.items.create', async (meta, { database: db }) => {
    const key = meta.key
    if (!key) return
    try {
      const training = await db('trainings').where('id', key).first()
      if (!training || !training.team) return

      const members = await db('member_teams')
        .where('team', training.team)
        .select('member')

      for (const { member } of members) {
        await db('notifications').insert({
          member,
          type: 'upcoming_activity',
          title: 'New training scheduled',
          body: `${training.date} ${training.start_time || ''}-${training.end_time || ''}`,
          activity_type: 'training',
          activity_id: String(key),
          team: training.team,
          read: false,
        })
      }
    } catch (err) {
      log.warn(`Training notification failed: ${err.message}`)
    }
  })

  // ── 8. Cron: Shell Account Expiry ───────────────────────────────
  // Daily at 02:00 UTC — expire shell accounts past shell_expires (was: shell_crons.pb.js)

  schedule('0 2 * * *', async () => {
    log.info('Cron: shell account expiry check')
    try {
      const now = new Date().toISOString()
      const expired = await database('members')
        .where('shell', true)
        .where('shell_expires', '<', now)
        .whereNotNull('shell_expires')
        .select('id', 'email')

      for (const m of expired) {
        await database('members').where('id', m.id).update({
          kscw_membership_active: false,
        })
        log.info(`Shell expired: ${m.email}`)
      }
      log.info(`Shell expiry: ${expired.length} accounts deactivated`)
    } catch (err) {
      log.error(`Shell expiry cron failed: ${err.message}`)
    }
  })

  // ── 9. Cron: Participation Reminders ────────────────────────────
  // Daily at 07:00 UTC — remind unresponded members (was: participation_reminders.pb.js)

  schedule('0 7 * * *', async () => {
    log.info('Cron: participation reminder check')
    try {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]

      // Find games/trainings with respond_by = tomorrow
      const games = await database('games')
        .where('respond_by', '>=', tomorrowStr + 'T00:00:00')
        .where('respond_by', '<', tomorrowStr + 'T23:59:59')
        .whereNotNull('kscw_team')
        .select('id', 'kscw_team', 'home_team', 'away_team', 'date')

      for (const game of games) {
        const teamMembers = await database('member_teams')
          .where('team', game.kscw_team)
          .select('member')

        const responded = await database('participations')
          .where('activity_type', 'game')
          .where('activity_id', String(game.id))
          .select('member')
        const respondedIds = new Set(responded.map(r => r.member))

        for (const { member } of teamMembers) {
          if (!respondedIds.has(member)) {
            await database('notifications').insert({
              member,
              type: 'deadline_reminder',
              title: 'RSVP reminder',
              body: `Please respond: ${game.home_team} vs ${game.away_team} on ${game.date}`,
              activity_type: 'game',
              activity_id: String(game.id),
              team: game.kscw_team,
              read: false,
            })
          }
        }
      }
      log.info(`Participation reminders sent for ${games.length} games`)
    } catch (err) {
      log.error(`Participation reminder cron failed: ${err.message}`)
    }
  })

  // ── 10. Cron: Scorer Delegation Expiry ──────────────────────────
  // Daily at 05:00 UTC (was: scorer_delegation.pb.js)

  schedule('0 5 * * *', async () => {
    log.info('Cron: scorer delegation expiry')
    try {
      const result = await database('scorer_delegations')
        .where('status', 'pending')
        .where('created', '<', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .update({ status: 'expired' })
      log.info(`Expired ${result} pending delegations`)
    } catch (err) {
      log.error(`Delegation expiry cron failed: ${err.message}`)
    }
  })

  log.info('KSCW hooks loaded: 7 filters, 4 actions, 3 crons')
}
