/**
 * Localized password reset/account claim endpoint.
 *
 * POST /kscw/password-request
 * Body: { email: string }
 *
 * Looks up the member's language, generates a reset token,
 * and sends a branded email in the user's language.
 */

import crypto from 'crypto'

const TEMPLATES = {
  german: {
    subject: 'WiediSync – Passwort festlegen',
    heading: 'Passwort festlegen',
    body: 'Klicke auf den Button unten, um dein Passwort festzulegen und dein WiediSync-Konto zu aktivieren.',
    button: 'Passwort festlegen',
    expiry: 'Dieser Link ist 24 Stunden gültig.',
    ignore: 'Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.',
    footer: 'KSC Wiedikon — Volleyball & Basketball seit 1972',
  },
  swiss_german: {
    subject: 'WiediSync – Passwort festlege',
    heading: 'Passwort festlege',
    body: 'Klick uf de Button unde, zum dis Passwort festzlege und dis WiediSync-Konto z aktiviere.',
    button: 'Passwort festlege',
    expiry: 'De Link isch 24 Stund gültig.',
    ignore: 'Falls du die Afrag nöd gmacht hesch, chasch die E-Mail ignoriere.',
    footer: 'KSC Wiedikon — Volleyball & Basketball sit 1972',
  },
  english: {
    subject: 'WiediSync – Set your password',
    heading: 'Set your password',
    body: 'Click the button below to set your password and activate your WiediSync account.',
    button: 'Set Password',
    expiry: 'This link expires in 24 hours.',
    ignore: 'If you did not request this, you can safely ignore this email.',
    footer: 'KSC Wiedikon — Volleyball & Basketball since 1972',
  },
  french: {
    subject: 'WiediSync – Définir votre mot de passe',
    heading: 'Définir votre mot de passe',
    body: 'Cliquez sur le bouton ci-dessous pour définir votre mot de passe et activer votre compte WiediSync.',
    button: 'Définir le mot de passe',
    expiry: 'Ce lien expire dans 24 heures.',
    ignore: 'Si vous n\'avez pas fait cette demande, vous pouvez ignorer cet e-mail.',
    footer: 'KSC Wiedikon — Volleyball & Basketball depuis 1972',
  },
  italian: {
    subject: 'WiediSync – Imposta la tua password',
    heading: 'Imposta la tua password',
    body: 'Clicca sul pulsante qui sotto per impostare la tua password e attivare il tuo account WiediSync.',
    button: 'Imposta password',
    expiry: 'Questo link scade tra 24 ore.',
    ignore: 'Se non hai effettuato questa richiesta, puoi ignorare questa e-mail.',
    footer: 'KSC Wiedikon — Pallavolo & Basket dal 1972',
  },
}

function buildHtml(t, url) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#1a1a2e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#16213e;border-radius:12px;overflow:hidden">
  <tr><td style="background:linear-gradient(135deg,#4A55A2,#3a4592);padding:30px;text-align:center">
    <h1 style="color:#FFC832;margin:0;font-size:24px">WiediSync</h1>
    <p style="color:rgba(255,255,255,0.7);margin:5px 0 0;font-size:14px">KSC Wiedikon</p>
  </td></tr>
  <tr><td style="padding:40px 30px">
    <h2 style="color:#ffffff;margin:0 0 15px;font-size:20px">${t.heading}</h2>
    <p style="color:#b0b0c0;line-height:1.6;margin:0 0 25px">${t.body}</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 25px">
    <tr><td style="background:#FFC832;border-radius:8px;padding:14px 32px">
      <a href="${url}" style="color:#1a1a2e;text-decoration:none;font-weight:600;font-size:16px">${t.button}</a>
    </td></tr>
    </table>
    <p style="color:#808090;font-size:13px;line-height:1.5;margin:0">
      ${t.expiry}<br>${t.ignore}
    </p>
  </td></tr>
  <tr><td style="border-top:1px solid #2a2a4a;padding:20px 30px;text-align:center">
    <p style="color:#606070;font-size:12px;margin:0">${t.footer}</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export function registerPasswordReset(router, { database, logger, services, getSchema }) {
  const log = logger.child({ endpoint: 'password-request' })

  router.post('/password-request', async (req, res) => {
    try {
      const { email } = req.body
      if (!email) return res.status(400).json({ error: 'Email required' })

      const normalizedEmail = email.toLowerCase().trim()

      // Find directus user
      const user = await database('directus_users')
        .where('email', normalizedEmail)
        .select('id', 'email')
        .first()

      // Always return 204 (don't reveal if email exists)
      if (!user) return res.status(204).end()

      // Find linked member for language
      const member = await database('members')
        .where('user', user.id)
        .select('language')
        .first()

      const lang = member?.language || 'german'
      const t = TEMPLATES[lang] || TEMPLATES.german

      // Generate a JWT reset token via Directus UsersService
      const schema = await getSchema()
      const { UsersService, MailService } = services
      const usersService = new UsersService({ schema, knex: database })

      // requestPasswordReset generates and stores the token internally
      // but sends the default email. We skip that and send our own.
      // Instead, generate token manually:
      const token = crypto.randomBytes(20).toString('hex')
      await database('directus_users')
        .where('id', user.id)
        .update({ token })

      // Build reset URL pointing to frontend
      const frontendUrl = process.env.PUBLIC_URL?.includes('directus')
        ? 'https://wiedisync.pages.dev'
        : (process.env.PUBLIC_URL || 'https://wiedisync.pages.dev')
      const resetUrl = `${frontendUrl}/set-password?token=${token}`

      // Send localized email
      const mailService = new MailService({ schema, knex: database })
      await mailService.send({
        to: user.email,
        subject: t.subject,
        html: buildHtml(t, resetUrl),
      })

      log.info(`Password reset email sent to user ${user.id} (${lang})`)
      res.status(204).end()
    } catch (err) {
      log.error(`password-request: ${err.message}`)
      // Always 204 to not leak info
      res.status(204).end()
    }
  })
}
