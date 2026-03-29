/**
 * Contact Form — ported from contact_form_api.pb.js + contact_form_lib.js
 * POST /kscw/contact — public, Turnstile protected
 */

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || ''

const SPORT_EMAILS = {
  volleyball: 'volleyball@kscw.ch',
  basketball: 'anja.jimenez@kscw.ch',
}
const GENERAL_EMAIL = 'kontakt@kscw.ch'

async function verifyTurnstile(token) {
  if (!TURNSTILE_SECRET) return true
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
      const { name, email, subject, message, team_id, sport, turnstile_token } = req.body
      if (!name || !email || !message) {
        return res.status(400).json({ error: 'name, email, message required' })
      }

      if (turnstile_token && !(await verifyTurnstile(turnstile_token))) {
        return res.status(400).json({ error: 'Captcha verification failed' })
      }

      // Determine recipient
      let toEmail = GENERAL_EMAIL
      if (team_id) {
        // Try to find team coaches/TR
        const coaches = await database('teams_coach')
          .join('members', 'members.id', 'teams_coach.members_id')
          .where('teams_coach.teams_id', team_id)
          .whereNotNull('members.email')
          .select('members.email')
        const trs = await database('teams_team_responsible')
          .join('members', 'members.id', 'teams_team_responsible.members_id')
          .where('teams_team_responsible.teams_id', team_id)
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

      log.info(`Contact form sent to ${toEmail} from ${email}`)
      res.json({ success: true })
    } catch (err) {
      log.error(`contact: ${err.message}`)
      res.status(500).json({ error: 'Internal error' })
    }
  })
}
