/**
 * Game Scheduling (Terminplanung)
 * Public: register, view slots, book home, propose away
 * Admin: generate slots, confirm away, block slot
 */

import crypto from 'crypto'
import { FRONTEND_URL } from './email-template.js'

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || ''

async function verifyTurnstile(token) {
  if (!TURNSTILE_SECRET) {
    console.error('[game-scheduling] TURNSTILE_SECRET not configured — rejecting request')
    return false
  }
  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${TURNSTILE_SECRET}&response=${token}`,
  })
  return (await resp.json()).success === true
}

export function registerGameScheduling(router, { database, logger, services, getSchema }) {
  const log = logger.child({ endpoint: 'game-scheduling' })

  // POST /kscw/terminplanung/register — opponent registers (public + Turnstile)
  router.post('/terminplanung/register', async (req, res) => {
    try {
      const { team_name, contact_name, contact_email, turnstile_token, kscw_team } = req.body
      if (!team_name || !contact_name || !contact_email || !kscw_team) {
        return res.status(400).json({ error: 'team_name, contact_name, contact_email, kscw_team required' })
      }
      if (!turnstile_token || !(await verifyTurnstile(turnstile_token))) {
        return res.status(400).json({ error: 'Captcha verification failed' })
      }

      const token = crypto.randomBytes(16).toString('hex')
      const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString()

      await database('game_scheduling_opponents').insert({
        team_name, contact_name, contact_email: contact_email.toLowerCase().trim(),
        token, kscw_team, status: 'active', expires_at: expiresAt,
      })

      // Send confirmation email
      try {
        const schema = await getSchema()
        const { MailService } = services
        const mail = new MailService({ schema, knex: database })
        await mail.send({
          to: contact_email,
          subject: `KSC Wiedikon – Spielplanung`,
          text: `Hallo ${contact_name},\n\nDein Zugangslink zur Spielplanung:\n${FRONTEND_URL}/terminplanung/${token}\n\nDieser Link ist 30 Tage gültig.\n\nKSC Wiedikon`,
        })
      } catch (mailErr) {
        log.warn(`Scheduling email failed: ${mailErr.message}`)
      }

      res.json({ success: true, token, expires_at: expiresAt })
    } catch (err) {
      log.error({ msg: `terminplanung/register: ${err.message}`, endpoint: 'terminplanung/register', userId: req.accountability?.user || null, method: req.method, stack: err.stack })
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // In-memory rate limiter for token lookups and writes (per IP)
  const tokenAttempts = new Map() // ip → { count, resetAt }
  const writeAttempts = new Map() // ip → { count, resetAt }

  function rateLimit(map, req, maxAttempts, windowMs) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown'
    const now = Date.now()
    const attempt = map.get(ip)
    if (attempt && now < attempt.resetAt) {
      if (attempt.count >= maxAttempts) return false
      attempt.count++
    } else {
      map.set(ip, { count: 1, resetAt: now + windowMs })
    }
    if (map.size > 1000) {
      for (const [k, v] of map) { if (now > v.resetAt) map.delete(k) }
    }
    return true
  }

  // GET /kscw/terminplanung/slots/:token — view available slots
  router.get('/terminplanung/slots/:token', async (req, res) => {
    try {
      // Rate limit: max 10 token lookups per 15 min per IP
      if (!rateLimit(tokenAttempts, req, 10, 15 * 60 * 1000)) {
        return res.status(429).json({ error: 'Too many requests. Try again later.' })
      }

      const opponent = await database('game_scheduling_opponents')
        .where('token', req.params.token)
        .whereIn('status', ['active', 'invited', 'viewed', 'booked'])
        .first()
      if (!opponent) return res.status(404).json({ error: 'Invalid or expired link' })
      if (opponent.expires_at && new Date() > new Date(opponent.expires_at)) {
        return res.status(400).json({ error: 'Link expired' })
      }

      // Status lifecycle: first view transitions invited → viewed
      if (opponent.status === 'invited') {
        const nowIso = new Date().toISOString()
        await database('game_scheduling_opponents')
          .where('id', opponent.id)
          .update({ status: 'viewed', first_viewed_at: nowIso })
        opponent.status = 'viewed'
        opponent.first_viewed_at = nowIso
      }

      const slots = await database('game_scheduling_slots')
        .where('kscw_team', opponent.kscw_team)
        .whereNot('status', 'blocked')
        .orderBy('date')

      const bookings = await database('game_scheduling_bookings')
        .where('opponent', opponent.id)
        .select('*')

      const team = await database('teams').where('id', opponent.kscw_team).first()

      res.json({
        data: {
          team_name: team?.name || '', opponent_team: opponent.team_name,
          slots, bookings,
        },
      })
    } catch (err) {
      log.error({ msg: `terminplanung/slots: ${err.message}`, endpoint: 'terminplanung/slots', userId: req.accountability?.user || null, method: req.method, stack: err.stack })
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // POST /kscw/terminplanung/book-home/:token — book a home slot
  router.post('/terminplanung/book-home/:token', async (req, res) => {
    try {
      // Rate limit: max 10 booking attempts per 15 min per IP
      if (!rateLimit(writeAttempts, req, 10, 15 * 60 * 1000)) {
        return res.status(429).json({ error: 'Too many requests. Try again later.' })
      }

      const opponent = await database('game_scheduling_opponents')
        .where('token', req.params.token)
        .whereIn('status', ['active', 'invited', 'viewed', 'booked'])
        .first()
      if (!opponent) return res.status(404).json({ error: 'Invalid link' })

      const { slot_id } = req.body
      if (!slot_id) return res.status(400).json({ error: 'slot_id required' })

      const slot = await database('game_scheduling_slots').where('id', slot_id).first()
      if (!slot || slot.status === 'blocked' || slot.status === 'booked') {
        return res.status(400).json({ error: 'Slot not available' })
      }

      // Check no duplicate booking
      const existing = await database('game_scheduling_bookings')
        .where('slot', slot_id).where('status', 'confirmed').first()
      if (existing) return res.status(400).json({ error: 'Slot already booked' })

      // Insert home booking (schema: opponent FK, slot FK, type, season, status)
      await database('game_scheduling_bookings').insert({
        opponent: opponent.id,
        slot: slot_id,
        type: 'home_slot_pick',
        season: slot.season,
        status: 'confirmed',
      })
      // Mark the slot itself as booked so it disappears from available lists
      await database('game_scheduling_slots').where('id', slot_id).update({ status: 'booked' })

      // Status lifecycle: booking transitions invited/viewed → booked
      await database('game_scheduling_opponents')
        .where('id', opponent.id)
        .whereIn('status', ['invited', 'viewed'])
        .update({ status: 'booked' })

      res.json({ success: true })
    } catch (err) {
      log.error({ msg: `terminplanung/book-home: ${err.message}`, endpoint: 'terminplanung/book-home', userId: req.accountability?.user || null, method: req.method, stack: err.stack })
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // POST /kscw/terminplanung/propose-away/:token — propose 3 away dates
  router.post('/terminplanung/propose-away/:token', async (req, res) => {
    try {
      // Rate limit: max 10 proposal attempts per 15 min per IP
      if (!rateLimit(writeAttempts, req, 10, 15 * 60 * 1000)) {
        return res.status(429).json({ error: 'Too many requests. Try again later.' })
      }

      const opponent = await database('game_scheduling_opponents')
        .where('token', req.params.token)
        .whereIn('status', ['active', 'invited', 'viewed', 'booked'])
        .first()
      if (!opponent) return res.status(404).json({ error: 'Invalid link' })

      const { proposals } = req.body
      if (!Array.isArray(proposals) || proposals.length === 0 || proposals.length > 3) {
        return res.status(400).json({ error: '1-3 proposals required' })
      }

      // Schema stores up to 3 proposals as parallel columns on a single booking row
      const row = {
        opponent: opponent.id,
        type: 'away_proposal',
        status: 'pending',
      }
      proposals.forEach((p, i) => {
        if (!p.date) throw new Error('Each proposal needs a date')
        const dt = p.start_time ? `${p.date}T${p.start_time}` : p.date
        row[`proposed_datetime_${i + 1}`] = dt
        row[`proposed_place_${i + 1}`] = p.location || p.place || ''
      })
      await database('game_scheduling_bookings').insert(row)

      // Status lifecycle: away proposal transitions invited/viewed → booked
      await database('game_scheduling_opponents')
        .where('id', opponent.id)
        .whereIn('status', ['invited', 'viewed'])
        .update({ status: 'booked' })

      res.json({ success: true, proposals_count: proposals.length })
    } catch (err) {
      log.error({ msg: `terminplanung/propose-away: ${err.message}`, endpoint: 'terminplanung/propose-away', userId: req.accountability?.user || null, method: req.method, stack: err.stack })
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // POST /kscw/admin/terminplanung/generate-slots — generate slots for season
  router.post('/admin/terminplanung/generate-slots', async (req, res) => {
    if (!req.accountability?.admin) return res.status(403).json({ error: 'Admin only' })
    try {
      const { kscw_team, season_id } = req.body
      if (!kscw_team || !season_id) return res.status(400).json({ error: 'kscw_team and season_id required' })

      const season = await database('game_scheduling_seasons').where('id', season_id).first()
      if (!season) return res.status(404).json({ error: 'Season not found' })

      // Get recurring hall slots for this team
      const hallSlots = await database('hall_slots')
        .join('hall_slots_teams', 'hall_slots.id', 'hall_slots_teams.hall_slots_id')
        .where('hall_slots_teams.teams_id', kscw_team)
        .select('hall_slots.*')

      let created = 0
      const startDate = new Date(season.start_date)
      const endDate = new Date(season.end_date)

      for (const slot of hallSlots) {
        const d = new Date(startDate)
        while (d <= endDate) {
          if (d.getDay() === slot.day_of_week) {
            const dateStr = d.toISOString().split('T')[0]
            // Check not already exists
            const exists = await database('game_scheduling_slots')
              .where('kscw_team', kscw_team).where('date', dateStr)
              .where('start_time', slot.start_time).first()
            if (!exists) {
              await database('game_scheduling_slots').insert({
                kscw_team, date: dateStr, start_time: slot.start_time,
                end_time: slot.end_time, hall: slot.hall, status: 'available',
              })
              created++
            }
          }
          d.setDate(d.getDate() + 1)
        }
      }

      res.json({ success: true, created })
    } catch (err) {
      log.error({ msg: `generate-slots: ${err.message}`, endpoint: 'generate-slots', userId: req.accountability?.user || null, method: req.method, stack: err.stack })
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // POST /kscw/admin/terminplanung/confirm-away — confirm one of 3 proposals
  router.post('/admin/terminplanung/confirm-away', async (req, res) => {
    if (!req.accountability?.admin) return res.status(403).json({ error: 'Admin only' })
    try {
      const { booking_id } = req.body
      if (!booking_id) return res.status(400).json({ error: 'booking_id required' })

      const booking = await database('game_scheduling_bookings').where('id', booking_id).first()
      if (!booking || booking.status !== 'proposed') {
        return res.status(400).json({ error: 'Invalid booking' })
      }

      // Confirm this one, reject siblings
      await database('game_scheduling_bookings').where('id', booking_id).update({ status: 'confirmed' })
      await database('game_scheduling_bookings')
        .where('opponent', booking.opponent).where('type', 'away')
        .where('status', 'proposed').whereNot('id', booking_id)
        .update({ status: 'rejected' })

      // Email opponent
      try {
        const opponent = await database('game_scheduling_opponents').where('id', booking.opponent).first()
        if (opponent?.contact_email) {
          const schema = await getSchema()
          const { MailService } = services
          const mail = new MailService({ schema, knex: database })
          await mail.send({
            to: opponent.contact_email,
            subject: 'KSC Wiedikon – Auswärtsspiel bestätigt',
            text: `Hallo ${opponent.contact_name},\n\nDas Auswärtsspiel am ${booking.date} wurde bestätigt.\n\nKSC Wiedikon`,
          })
        }
      } catch (mailErr) {
        log.warn(`Confirm-away email failed: ${mailErr.message}`)
      }

      res.json({ success: true })
    } catch (err) {
      log.error({ msg: `confirm-away: ${err.message}`, endpoint: 'confirm-away', userId: req.accountability?.user || null, method: req.method, stack: err.stack })
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // POST /kscw/admin/terminplanung/block-slot — block/unblock a slot
  router.post('/admin/terminplanung/block-slot', async (req, res) => {
    if (!req.accountability?.admin) return res.status(403).json({ error: 'Admin only' })
    try {
      const { slot_id, blocked } = req.body
      if (!slot_id) return res.status(400).json({ error: 'slot_id required' })
      await database('game_scheduling_slots').where('id', slot_id).update({ status: blocked ? 'blocked' : 'available' })
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // POST /kscw/admin/terminplanung/svrz-sync — manual trigger for bulk SVRZ sync
  // Spawns the sync script detached; the HTTP caller returns immediately. Errors inside
  // the child are NOT reported back (stdio: 'ignore') — the try/catch here only covers
  // spawn-fork failures. Observability comes from the daily cron's log output.
  router.post('/admin/terminplanung/svrz-sync', async (req, res) => {
    if (!req.accountability?.admin) return res.status(403).json({ error: 'Admin only' })
    try {
      const { season_uuid, season_name } = req.body || {}
      const auth = req.headers?.authorization || ''
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
      if (!token) return res.status(401).json({ error: 'Missing bearer token' })

      // Derive defaults from the current date (Aug 1 cutover). Look up the
      // matching SVRZ UUID from the most recent sync for that season; fall
      // back to the 2025/26 UUID as a safety net.
      const now = new Date()
      const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
      const defaultSeasonName = `${startYear}/${startYear + 1}`
      const known = await database('svrz_spielplaner_contacts')
        .where('season_name', defaultSeasonName).whereNotNull('season_uuid').first()
      const defaultSeasonUuid = known?.season_uuid || 'dcafddfe-8139-4e02-baad-d3f88ec00cd0'

      const { spawn } = await import('node:child_process')
      // Scoped env — do NOT spread process.env; forward only the secrets the child needs
      const env = {
        HOME: process.env.HOME,
        PATH: process.env.PATH,
        VM_USERNAME: process.env.VM_USERNAME,
        VM_PASSWORD: process.env.VM_PASSWORD,
        DIRECTUS_URL: 'http://127.0.0.1:8055',
        DIRECTUS_TOKEN: token,
        SVRZ_SEASON_UUID: season_uuid || defaultSeasonUuid,
        SVRZ_SEASON_NAME: season_name || defaultSeasonName,
      }
      const child = spawn('node', ['/directus/scripts/svrz-scheduling-sync.mjs'], {
        env,
        detached: true,
        stdio: 'ignore',
      })
      child.unref()
      log.info({ msg: `svrz-sync spawned`, pid: child.pid, userId: req.accountability?.user })
      res.json({ started: true, pid: child.pid })
    } catch (err) {
      log.error({ msg: `svrz-sync: ${err.message}`, endpoint: 'admin/terminplanung/svrz-sync', userId: req.accountability?.user || null, method: req.method, stack: err.stack })
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Admin invites (per-verein tokenized links, auto-populated from SVRZ)
  // ─────────────────────────────────────────────────────────────────────────

  const INVITE_TTL_DAYS = 90
  const ACTIVE_INVITE_STATUSES = ['invited', 'viewed', 'booked', 'active']
  const KSCW_SVRZ_CLUB_ID = process.env.KSCW_SVRZ_CLUB_ID || '912530'

  function newInviteExpiry() {
    return new Date(Date.now() + INVITE_TTL_DAYS * 86400000).toISOString()
  }

  // GET /admin/terminplanung/svrz-available-seasons — list seasons seen in synced data
  router.get('/admin/terminplanung/svrz-available-seasons', async (req, res) => {
    if (!req.accountability?.admin) return res.status(403).json({ error: 'Admin only' })
    try {
      const rows = await database('svrz_spielplaner_contacts')
        .distinct('season_uuid', 'season_name')
        .whereNotNull('season_uuid')
        .orderBy('season_name', 'desc')
      res.json({ data: rows.map((r) => ({ uuid: r.season_uuid, name: r.season_name })) })
    } catch (err) {
      log.error({ msg: `svrz-available-seasons: ${err.message}`, endpoint: 'admin/terminplanung/svrz-available-seasons', userId: req.accountability?.user || null, method: req.method, stack: err.stack })
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // POST /admin/terminplanung/invites — create tokenized invites
  router.post('/admin/terminplanung/invites', async (req, res) => {
    if (!req.accountability?.admin) return res.status(403).json({ error: 'Admin only' })
    try {
      const { kscw_team, season, rows } = req.body || {}
      if (!kscw_team || !season || !Array.isArray(rows)) {
        return res.status(400).json({ error: 'kscw_team, season, rows[] required' })
      }
      const created = []
      const existing = []
      for (const r of rows) {
        const email = (r.contact_email || '').toLowerCase().trim()
        if (!email || !r.team_name) continue
        const existingRow = await database('game_scheduling_opponents')
          .where({ kscw_team, season, contact_email: email })
          .whereIn('status', ACTIVE_INVITE_STATUSES)
          .first()
        if (existingRow) {
          existing.push({ id: existingRow.id, token: existingRow.token, email, team_name: existingRow.team_name })
          continue
        }
        const token = crypto.randomBytes(16).toString('hex')
        const expiresAt = newInviteExpiry()
        const inserted = await database('game_scheduling_opponents').insert({
          kscw_team, season, team_name: r.team_name, contact_email: email,
          contact_name: r.contact_name || '', token, status: 'invited',
          source: r.source || 'manual', created_by_admin: true, expires_at: expiresAt,
        }).returning(['id'])
        const newId = Array.isArray(inserted) ? (inserted[0]?.id ?? inserted[0]) : inserted
        created.push({ id: newId, token, email, team_name: r.team_name })
      }
      res.json({ created: created.length, existing: existing.length, rows: [...created, ...existing] })
    } catch (err) {
      log.error({ msg: `invites create: ${err.message}`, endpoint: 'admin/terminplanung/invites', userId: req.accountability?.user || null, method: req.method, stack: err.stack })
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // GET /admin/terminplanung/invites?kscw_team=&season= — list invites
  router.get('/admin/terminplanung/invites', async (req, res) => {
    if (!req.accountability?.admin) return res.status(403).json({ error: 'Admin only' })
    try {
      const { kscw_team, season } = req.query
      if (!kscw_team) return res.status(400).json({ error: 'kscw_team required' })
      const q = database('game_scheduling_opponents').where('kscw_team', kscw_team)
      if (season) q.where('season', season)
      const invites = await q.orderBy('date_created', 'desc')
      res.json({ data: invites })
    } catch (err) {
      log.error({ msg: `invites list: ${err.message}`, endpoint: 'admin/terminplanung/invites', userId: req.accountability?.user || null, method: req.method, stack: err.stack })
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // POST /admin/terminplanung/invites/:id/reissue — new token + reset lifecycle
  router.post('/admin/terminplanung/invites/:id/reissue', async (req, res) => {
    if (!req.accountability?.admin) return res.status(403).json({ error: 'Admin only' })
    try {
      const id = parseInt(req.params.id, 10)
      if (!id) return res.status(400).json({ error: 'invalid id' })
      const token = crypto.randomBytes(16).toString('hex')
      const expiresAt = newInviteExpiry()
      const updated = await database('game_scheduling_opponents')
        .where('id', id)
        .update({ token, status: 'invited', first_viewed_at: null, expires_at: expiresAt })
      if (!updated) return res.status(404).json({ error: 'not found' })
      res.json({ success: true, token, expires_at: expiresAt })
    } catch (err) {
      log.error({ msg: `invites reissue: ${err.message}`, endpoint: 'admin/terminplanung/invites/:id/reissue', userId: req.accountability?.user || null, method: req.method, stack: err.stack })
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // POST /admin/terminplanung/invites/:id/revoke — disable token
  router.post('/admin/terminplanung/invites/:id/revoke', async (req, res) => {
    if (!req.accountability?.admin) return res.status(403).json({ error: 'Admin only' })
    try {
      const id = parseInt(req.params.id, 10)
      if (!id) return res.status(400).json({ error: 'invalid id' })
      const updated = await database('game_scheduling_opponents')
        .where('id', id).update({ status: 'revoked' })
      if (!updated) return res.status(404).json({ error: 'not found' })
      res.json({ success: true })
    } catch (err) {
      log.error({ msg: `invites revoke: ${err.message}`, endpoint: 'admin/terminplanung/invites/:id/revoke', userId: req.accountability?.user || null, method: req.method, stack: err.stack })
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // GET /admin/terminplanung/invites/import-from-svrz?kscw_team=&season= — preview
  // Lists opponent clubs from synced svrz_games plus per-game Spielplanverantwortlicher
  // contacts, with fallback to the bulk svrz_spielplaner_contacts feed.
  router.get('/admin/terminplanung/invites/import-from-svrz', async (req, res) => {
    if (!req.accountability?.admin) return res.status(403).json({ error: 'Admin only' })
    try {
      const { kscw_team, season } = req.query
      if (!kscw_team || !season) return res.status(400).json({ error: 'kscw_team, season required' })

      const seasonRow = await database('game_scheduling_seasons').where('id', season).first()
      if (!seasonRow) return res.status(404).json({ error: 'season not found' })
      const kscwTeamRow = await database('teams').where('id', kscw_team).first()
      if (!kscwTeamRow) return res.status(404).json({ error: 'kscw_team not found' })
      const seasonUuid = seasonRow.svrz_season_uuid || process.env.SVRZ_SEASON_UUID || ''

      // 1. Pull schedulable KSCW games in this team's league
      const games = await database('svrz_games')
        .whereIn('status', ['open', 'waitingForApproval'])
        .where(function () {
          this.where('home_club_id', KSCW_SVRZ_CLUB_ID).orWhere('away_club_id', KSCW_SVRZ_CLUB_ID)
        })
        .andWhere(function () {
          if (kscwTeamRow.league) {
            this.where('league_short', kscwTeamRow.league).orWhere('league_name', 'like', `%${kscwTeamRow.league}%`)
          }
        })
        .orderBy('starting_date_time')

      // 2. Group by opponent club
      const byClub = new Map()
      for (const g of games) {
        const isHomeKscw = g.home_club_id === KSCW_SVRZ_CLUB_ID
        const oppClubId = isHomeKscw ? g.away_club_id : g.home_club_id
        const oppClubName = isHomeKscw ? g.away_club_name : g.home_club_name
        const oppTeamName = isHomeKscw ? g.away_team_name : g.home_team_name
        if (!oppClubId) continue
        if (!byClub.has(oppClubId)) {
          byClub.set(oppClubId, { club_id: oppClubId, club_name: oppClubName, team_name: oppTeamName, games: [], contacts: new Map() })
        }
        byClub.get(oppClubId).games.push({ id: g.svrz_persistence_id, display_name: g.display_name, starting_date_time: g.starting_date_time, is_home_kscw: isHomeKscw })
      }

      // 3. Per-game contact lookup (primary). Fall back to bulk feed if empty.
      let jar = null
      let ctx = null
      const tryLogin = async () => {
        if (jar) return true
        try {
          const vm = await import('/directus/scripts/vm-client.mjs')
          if (!process.env.VM_USERNAME || !process.env.VM_PASSWORD) return false
          jar = await vm.vmLogin({ username: process.env.VM_USERNAME, password: process.env.VM_PASSWORD })
          ctx = await vm.csrfFromPage(jar, '/sportmanager.indoorvolleyball/game/index')
          ctx.VM_BASE = vm.VM_BASE
          ctx.UA = vm.UA
          return true
        } catch (e) {
          log.warn(`[invites import] SVRZ login failed: ${e.message}`)
          return false
        }
      }

      async function getGameContacts(gameUuid) {
        if (!(await tryLogin())) return null
        const url = `${ctx.VM_BASE}/api/sportmanager.indoorvolleyball/api%5cgame/getTeamContactInfosByGame?game=${gameUuid}`
        const headers = {
          'User-Agent': ctx.UA, Accept: '*/*', Cookie: jar.header(),
          Referer: `${ctx.VM_BASE}/sportmanager.indoorvolleyball/game/index`,
        }
        if (ctx.wuid) headers['Window-Unique-Id'] = ctx.wuid
        try {
          const r = await fetch(url, { headers })
          if (!r.ok) return null
          return await r.json()
        } catch (e) {
          log.warn(`[invites import] game contacts fetch ${gameUuid}: ${e.message}`)
          return null
        }
      }

      for (const group of byClub.values()) {
        // Primary: per-game contacts, union across games for this opponent
        for (const g of group.games) {
          const resp = await getGameContacts(g.id)
          if (!resp) continue
          const pool = g.is_home_kscw ? (resp.teamAway || []) : (resp.teamHome || [])
          for (const c of pool) {
            if (c.addressOrganisationMemberFunctionTitle !== 'Spielplanverantwortlicher') continue
            const email = (c.primaryEmailAddress || '').toLowerCase().trim()
            if (!email || group.contacts.has(email)) continue
            group.contacts.set(email, {
              name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
              email,
              phone: c.primaryPhoneNumber || '',
              source: 'per_game',
            })
          }
        }
        // Fallback: club-level bulk feed
        if (group.contacts.size === 0 && seasonUuid) {
          const bulk = await database('svrz_spielplaner_contacts')
            .where({ club_id: group.club_id, season_uuid: seasonUuid })
          for (const c of bulk) {
            const email = (c.contact_email || '').toLowerCase().trim()
            if (!email || group.contacts.has(email)) continue
            group.contacts.set(email, {
              name: c.contact_name || '',
              email,
              phone: c.contact_phone || '',
              source: 'club_fallback',
            })
          }
        }
      }

      const opponents = [...byClub.values()].map((g) => {
        const contacts = [...g.contacts.values()]
        return {
          club_id: g.club_id,
          club_name: g.club_name,
          team_name: g.team_name,
          game_count: g.games.length,
          contacts,
          warning: contacts.length === 0 ? 'no_contact' : undefined,
          source: contacts.length === 0 ? 'none' : contacts[0].source,
        }
      })

      res.json({
        season: seasonRow.season,
        season_uuid: seasonUuid || null,
        kscw_team: { id: kscwTeamRow.id, name: kscwTeamRow.name, league: kscwTeamRow.league },
        opponents,
        total_games_matched: games.length,
      })
    } catch (err) {
      log.error({ msg: `import-from-svrz: ${err.message}`, endpoint: 'admin/terminplanung/invites/import-from-svrz', userId: req.accountability?.user || null, method: req.method, stack: err.stack })
      res.status(500).json({ error: 'Internal error' })
    }
  })
}
