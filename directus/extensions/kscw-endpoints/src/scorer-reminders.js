/**
 * Scorer Reminders — ported from scorer_reminders_lib.js
 * POST /kscw/admin/scorer-reminders — manual trigger
 * POST /kscw/admin/scorer-reminders/dry-run — test with fake data
 * Cron registered in hooks extension (09:00 UTC)
 */

function tomorrowYMD() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function arrivalMinutes(role, sport) {
  if (sport === 'basketball') return 15
  if (role === 'taefeler') return 10
  return 30 // scorer default
}

const ROLE_MEMBER = {
  scorer: 'scorer_member', taefeler: 'taefeler_member',
  bb_anschreiber: 'bb_anschreiber', bb_zeitnehmer: 'bb_zeitnehmer', bb_24s: 'bb_24s',
}

export function registerScorerReminders(router, { database, logger, services, getSchema }) {
  const log = logger.child({ endpoint: 'scorer-reminders' })

  async function sendReminders(db, getSchemaFn, mailServiceClass) {
    // Check if enabled
    const setting = await db('app_settings').where('key', 'scorer_reminders_enabled').first()
    if (!setting || setting.value !== 'true') {
      return { sent: 0, skipped: 'disabled' }
    }

    const tomorrow = tomorrowYMD()
    const games = await db('games')
      .where('date', tomorrow)
      .where('type', 'home')
      .whereIn('source', ['swiss_volley', 'basketplan'])
      .whereNotIn('status', ['completed', 'postponed', 'cancelled'])
      .select('*')

    if (games.length === 0) return { sent: 0, games: 0 }

    const schema = await getSchemaFn()
    const mailService = new mailServiceClass({ schema, knex: db })
    let sent = 0, errors = 0

    for (const game of games) {
      const sport = game.source === 'basketplan' ? 'basketball' : 'volleyball'

      // Find assigned roles
      const roles = sport === 'volleyball'
        ? ['scorer', 'taefeler']
        : ['bb_anschreiber', 'bb_zeitnehmer', 'bb_24s']

      for (const role of roles) {
        const memberField = ROLE_MEMBER[role]
        const memberId = game[memberField]
        if (!memberId) continue

        const member = await db('members').where('id', memberId).first()
        if (!member || !member.email || member.email.includes('@placeholder')) continue

        const hall = game.hall ? await db('halls').where('id', game.hall).first() : null
        const arrival = arrivalMinutes(role, sport)
        const gameTime = game.time || '??:??'

        // Calculate arrival time
        let arrivalTime = gameTime
        if (gameTime !== '??:??') {
          const [h, m] = gameTime.split(':').map(Number)
          const totalMin = h * 60 + m - arrival
          arrivalTime = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
        }

        const subject = `Schreibereinsatz morgen: ${game.home_team} vs ${game.away_team}`
        const text = [
          `Hallo ${member.first_name},`,
          '',
          `Du bist morgen als ${role} eingeteilt:`,
          `Spiel: ${game.home_team} vs ${game.away_team}`,
          `Datum: ${game.date}`,
          `Anpfiff: ${gameTime}`,
          `Ankunft: ${arrivalTime} (${arrival} Min. vor Anpfiff)`,
          hall ? `Halle: ${hall.name}` : '',
          '',
          'KSC Wiedikon',
        ].filter(Boolean).join('\n')

        try {
          await mailService.send({ to: member.email, subject, text })
          sent++
        } catch (mailErr) {
          log.warn(`Scorer reminder failed for ${member.email}: ${mailErr.message}`)
          errors++
        }
      }
    }

    return { sent, errors, games: games.length }
  }

  router.post('/admin/scorer-reminders', async (req, res) => {
    if (!req.accountability?.admin) return res.status(403).json({ error: 'Admin access required' })
    try {
      const { MailService } = services
      const result = await sendReminders(database, getSchema, MailService)
      res.json({ status: 'ok', tomorrow: tomorrowYMD(), ...result })
    } catch (err) {
      log.error(`scorer-reminders: ${err.message}`)
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/admin/scorer-reminders/dry-run', async (req, res) => {
    if (!req.accountability?.admin) return res.status(403).json({ error: 'Admin access required' })
    try {
      const tomorrow = tomorrowYMD()
      const games = await database('games')
        .where('date', tomorrow).where('type', 'home')
        .whereIn('source', ['swiss_volley', 'basketplan'])
        .select('id', 'home_team', 'away_team', 'date', 'time', 'scorer_member', 'taefeler_member')

      res.json({ status: 'ok', tomorrow, games })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
