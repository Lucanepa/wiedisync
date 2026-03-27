/**
 * KSCW Custom API Endpoints
 *
 * Migrated from PocketBase routerAdd hooks.
 * All endpoints are prefixed with /kscw/ (e.g., /kscw/check-email)
 */

import { syncSvGames, syncSvRankings } from './sv-sync.js'
import { syncBpGames, syncBpRankings } from './bp-sync.js'

export default {
  id: 'kscw',
  handler: (router, { services, database, logger, getSchema }) => {
  const log = logger.child({ extension: 'kscw-endpoints' })

  // ── Public: Check Email ─────────────────────────────────────────
  // POST /kscw/check-email — check if email exists for signup routing
  // (was: check_email.pb.js)

  router.post('/check-email', async (req, res) => {
    try {
      const { email } = req.body
      if (!email) return res.status(400).json({ error: 'Email required' })

      const member = await database('members')
        .where('email', email.toLowerCase().trim())
        .select('id', 'wiedisync_active', 'shell')
        .first()

      res.json({
        exists: !!member,
        claimed: member?.wiedisync_active || false,
        shell: member?.shell || false,
      })
    } catch (err) {
      log.error(`check-email: ${err.message}`)
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // ── Public: Team Data ───────────────────────────────────────────
  // GET /kscw/public/teams — public team list
  // GET /kscw/public/team/:id — public team detail with roster
  // (was: public_team_data.pb.js)

  router.get('/public/teams', async (req, res) => {
    try {
      const teams = await database('teams')
        .where('active', true)
        .select('id', 'name', 'full_name', 'sport', 'league', 'season', 'color', 'team_picture', 'team_picture_pos', 'social_url')
        .orderBy('name')

      res.json({ data: teams })
    } catch (err) {
      log.error(`public/teams: ${err.message}`)
      res.status(500).json({ error: 'Internal error' })
    }
  })

  router.get('/public/team/:id', async (req, res) => {
    try {
      const team = await database('teams').where('id', req.params.id).first()
      if (!team) return res.status(404).json({ error: 'Team not found' })

      // Get roster
      const roster = await database('member_teams')
        .join('members', 'members.id', 'member_teams.member')
        .where('member_teams.team', team.id)
        .where('members.kscw_membership_active', true)
        .select(
          'members.id', 'members.first_name', 'members.last_name',
          'members.number', 'members.position', 'members.photo',
          'member_teams.guest_level',
        )

      // Get coaches via junction
      const coaches = await database('teams_coach')
        .join('members', 'members.id', 'teams_coach.members_id')
        .where('teams_coach.teams_id', team.id)
        .select('members.id', 'members.first_name', 'members.last_name', 'members.photo')

      // Get upcoming games
      const today = new Date().toISOString().split('T')[0]
      const games = await database('games')
        .where('kscw_team', team.id)
        .where('date', '>=', today)
        .orderBy('date')
        .limit(10)

      // Get trainings
      const trainings = await database('trainings')
        .where('team', team.id)
        .where('date', '>=', today)
        .where('cancelled', false)
        .orderBy('date')
        .limit(10)

      res.json({
        data: {
          ...team,
          roster,
          coaches,
          upcoming_games: games,
          upcoming_trainings: trainings,
        },
      })
    } catch (err) {
      log.error(`public/team/${req.params.id}: ${err.message}`)
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // ── Public: Sponsors ────────────────────────────────────────────
  // GET /kscw/public/sponsors
  // (was: public_sponsors.pb.js)

  router.get('/public/sponsors', async (req, res) => {
    try {
      const sponsors = await database('sponsors')
        .where('active', true)
        .orderBy('sort_order')

      res.json({ data: sponsors })
    } catch (err) {
      log.error(`public/sponsors: ${err.message}`)
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // ── Admin: Trigger Swiss Volley Sync ────────────────────────────
  // POST /kscw/admin/sv-sync (admin only)
  // Note: Actual sync logic will be ported separately; this is the trigger endpoint
  // (was: sv_sync.pb.js)

  router.post('/admin/sv-sync', async (req, res) => {
    if (!req.accountability?.admin) {
      return res.status(403).json({ error: 'Admin access required' })
    }
    try {
      log.info('Manual SV sync triggered')
      const games = await syncSvGames(database, log)
      const rankings = await syncSvRankings(database, log)
      res.json({ status: 'ok', games, rankings })
    } catch (err) {
      log.error(`sv-sync: ${err.message}`)
      res.status(500).json({ error: err.message })
    }
  })

  // ── Admin: Trigger Basketplan Sync ──────────────────────────────
  // POST /kscw/admin/bp-sync (admin only)
  // (was: bp_sync.pb.js)

  router.post('/admin/bp-sync', async (req, res) => {
    if (!req.accountability?.admin) {
      return res.status(403).json({ error: 'Admin access required' })
    }
    try {
      log.info('Manual BP sync triggered')
      const games = await syncBpGames(database, log)
      const rankings = await syncBpRankings(database, log, games.leagueHoldingIds)
      res.json({ status: 'ok', games, rankings })
    } catch (err) {
      log.error(`bp-sync: ${err.message}`)
      res.status(500).json({ error: err.message })
    }
  })

  // ── Admin: Trigger GCal Sync ────────────────────────────────────
  // POST /kscw/admin/gcal-sync (admin only)
  // (was: gcal_sync.pb.js)

  router.post('/admin/gcal-sync', async (req, res) => {
    if (!req.accountability?.admin) {
      return res.status(403).json({ error: 'Admin access required' })
    }
    try {
      log.info('Manual GCal sync triggered')
      // TODO: Port gcal_sync.pb.js logic
      res.json({ status: 'ok', message: 'GCal sync triggered' })
    } catch (err) {
      log.error(`gcal-sync: ${err.message}`)
      res.status(500).json({ error: err.message })
    }
  })

  // ── Shell Invite Endpoints ──────────────────────────────────────
  // (was: shell_invite_api.pb.js)

  router.get('/team-invites/info/:token', async (req, res) => {
    try {
      const invite = await database('team_invites')
        .where('token', req.params.token)
        .where('status', 'pending')
        .first()

      if (!invite) return res.status(404).json({ error: 'Invite not found or expired' })

      const team = await database('teams').where('id', invite.team).first()

      res.json({
        data: {
          team_name: team?.name || 'Unknown',
          team_sport: team?.sport || '',
          guest_level: invite.guest_level,
          expires_at: invite.expires_at,
        },
      })
    } catch (err) {
      log.error(`team-invites/info: ${err.message}`)
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // ── Participation Reminders (manual trigger) ────────────────────
  // POST /kscw/admin/participation-reminders (admin only)

  router.post('/admin/participation-reminders', async (req, res) => {
    if (!req.accountability?.admin) {
      return res.status(403).json({ error: 'Admin access required' })
    }
    try {
      log.info('Manual participation reminders triggered')
      // TODO: Same logic as cron in hooks extension
      res.json({ status: 'ok', message: 'Participation reminders triggered' })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Scorer Reminders (manual trigger) ───────────────────────────
  // POST /kscw/admin/scorer-reminders (admin only)

  router.post('/admin/scorer-reminders', async (req, res) => {
    if (!req.accountability?.admin) {
      return res.status(403).json({ error: 'Admin access required' })
    }
    try {
      log.info('Manual scorer reminders triggered')
      // TODO: Port scorer_reminders logic
      res.json({ status: 'ok', message: 'Scorer reminders triggered' })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  log.info('KSCW endpoints loaded: 10 routes')
  },
}
