/**
 * Game Scheduling (Terminplanung) — ported from game_scheduling_api.pb.js
 * Public: register, view slots, book home, propose away
 * Admin: generate slots, confirm away, block slot
 */

import crypto from 'crypto'
import { FRONTEND_URL } from './email-template.js'

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || ''

async function verifyTurnstile(token) {
  if (!TURNSTILE_SECRET) return true
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
      if (turnstile_token && !(await verifyTurnstile(turnstile_token))) {
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
      log.error(`terminplanung/register: ${err.message}`)
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // GET /kscw/terminplanung/slots/:token — view available slots
  router.get('/terminplanung/slots/:token', async (req, res) => {
    try {
      const opponent = await database('game_scheduling_opponents')
        .where('token', req.params.token).where('status', 'active').first()
      if (!opponent) return res.status(404).json({ error: 'Invalid or expired link' })
      if (opponent.expires_at && new Date() > new Date(opponent.expires_at)) {
        return res.status(400).json({ error: 'Link expired' })
      }

      const slots = await database('game_scheduling_slots')
        .where('kscw_team', opponent.kscw_team)
        .where('blocked', false)
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
      log.error(`terminplanung/slots: ${err.message}`)
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // POST /kscw/terminplanung/book-home/:token — book a home slot
  router.post('/terminplanung/book-home/:token', async (req, res) => {
    try {
      const opponent = await database('game_scheduling_opponents')
        .where('token', req.params.token).where('status', 'active').first()
      if (!opponent) return res.status(404).json({ error: 'Invalid link' })

      const { slot_id } = req.body
      if (!slot_id) return res.status(400).json({ error: 'slot_id required' })

      const slot = await database('game_scheduling_slots').where('id', slot_id).first()
      if (!slot || slot.blocked) return res.status(400).json({ error: 'Slot not available' })

      // Check no duplicate booking
      const existing = await database('game_scheduling_bookings')
        .where('slot', slot_id).where('status', 'confirmed').first()
      if (existing) return res.status(400).json({ error: 'Slot already booked' })

      await database('game_scheduling_bookings').insert({
        opponent: opponent.id, slot: slot_id, type: 'home',
        date: slot.date, start_time: slot.start_time, end_time: slot.end_time,
        hall: slot.hall, status: 'confirmed',
      })

      res.json({ success: true })
    } catch (err) {
      log.error(`terminplanung/book-home: ${err.message}`)
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // POST /kscw/terminplanung/propose-away/:token — propose 3 away dates
  router.post('/terminplanung/propose-away/:token', async (req, res) => {
    try {
      const opponent = await database('game_scheduling_opponents')
        .where('token', req.params.token).where('status', 'active').first()
      if (!opponent) return res.status(404).json({ error: 'Invalid link' })

      const { proposals } = req.body
      if (!Array.isArray(proposals) || proposals.length === 0 || proposals.length > 3) {
        return res.status(400).json({ error: '1-3 proposals required' })
      }

      for (const p of proposals) {
        if (!p.date) return res.status(400).json({ error: 'Each proposal needs a date' })
        await database('game_scheduling_bookings').insert({
          opponent: opponent.id, type: 'away',
          date: p.date, start_time: p.start_time || null, end_time: p.end_time || null,
          location: p.location || '', notes: p.notes || '', status: 'proposed',
        })
      }

      res.json({ success: true, proposals_count: proposals.length })
    } catch (err) {
      log.error(`terminplanung/propose-away: ${err.message}`)
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
                end_time: slot.end_time, hall: slot.hall, blocked: false,
              })
              created++
            }
          }
          d.setDate(d.getDate() + 1)
        }
      }

      res.json({ success: true, created })
    } catch (err) {
      log.error(`generate-slots: ${err.message}`)
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
      log.error(`confirm-away: ${err.message}`)
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // POST /kscw/admin/terminplanung/block-slot — block/unblock a slot
  router.post('/admin/terminplanung/block-slot', async (req, res) => {
    if (!req.accountability?.admin) return res.status(403).json({ error: 'Admin only' })
    try {
      const { slot_id, blocked } = req.body
      if (!slot_id) return res.status(400).json({ error: 'slot_id required' })
      await database('game_scheduling_slots').where('id', slot_id).update({ blocked: !!blocked })
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: 'Internal error' })
    }
  })
}
