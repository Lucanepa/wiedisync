/**
 * Contact Form — ported from contact_form_api.pb.js + contact_form_lib.js
 * POST /kscw/contact — public, Turnstile protected
 */

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || ''

const SPORT_EMAILS = {
  volleyball: process.env.CONTACT_EMAIL_VB || 'volleyball@kscw.ch',
  basketball: process.env.CONTACT_EMAIL_BB || 'basketball@kscw.ch',
}
const GENERAL_EMAIL = process.env.CONTACT_EMAIL_GENERAL || 'kontakt@kscw.ch'

async function verifyTurnstile(token) {
  if (!TURNSTILE_SECRET) {
    console.error('[contact-form] TURNSTILE_SECRET not configured — rejecting request')
    return false
  }
  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${TURNSTILE_SECRET}&response=${token}`,
  })
  return (await resp.json()).success === true
}

export function registerContactForm(router, { database, logger, services, getSchema }) {
  const log = logger.child({ endpoint: 'contact-form' })

  router.post('/contact', async (req, res) => {
    try {
      const { name: rawName, email, subject: rawSubject, message, team_id, sport, turnstile_token } = req.body
      if (!rawName || !email || !message) {
        return res.status(400).json({ error: 'name, email, message required' })
      }
      // Strip control characters to prevent email header injection
      const name = String(rawName).replace(/[\r\n\t]/g, '')
      const subject = rawSubject ? String(rawSubject).replace(/[\r\n\t]/g, '') : ''
      // Validate email format (reject control characters)
      if (/[\r\n\t]/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' })
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' })
      }

      if (!turnstile_token || !(await verifyTurnstile(turnstile_token))) {
        return res.status(400).json({ error: 'Captcha verification failed' })
      }

      // Determine recipient
      let toEmail = GENERAL_EMAIL
      if (team_id) {
        // Try to find team coaches/TR
        const coaches = await database('teams_coaches')
          .join('members', 'members.id', 'teams_coaches.members_id')
          .where('teams_coaches.teams_id', team_id)
          .whereNotNull('members.email')
          .select('members.email')
        const trs = await database('teams_responsibles')
          .join('members', 'members.id', 'teams_responsibles.members_id')
          .where('teams_responsibles.teams_id', team_id)
          .whereNotNull('members.email')
          .select('members.email')
        const recipients = [...coaches, ...trs]
          .map(r => r.email).filter(e => e && !e.includes('@placeholder'))
        if (recipients.length > 0) toEmail = recipients.join(',')
      } else if (sport && SPORT_EMAILS[sport]) {
        toEmail = SPORT_EMAILS[sport]
      }

      const schema = await getSchema()
      const { MailService } = services
      const mail = new MailService({ schema, knex: database })

      await mail.send({
        to: toEmail,
        subject: `[KSCW Kontakt] ${subject || 'Anfrage'} von ${name}`,
        text: `Name: ${name}\nEmail: ${email}\nBetreff: ${subject || '-'}\n\n${message}`,
      })

      log.info(`Contact form sent to team ${team_id} contact`)
      res.json({ success: true })
    } catch (err) {
      log.error({
        msg: `contact: ${err.message}`,
        endpoint: 'contact',
        method: req.method,
        body: { team_id: req.body?.team_id, sport: req.body?.sport },
        stack: err.stack,
      })
      res.status(500).json({ error: 'Internal error' })
    }
  })
}
