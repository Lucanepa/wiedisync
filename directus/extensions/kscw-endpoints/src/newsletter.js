/**
 * Newsletter Subscribe/Verify/Unsubscribe endpoints
 * POST /kscw/newsletter/subscribe — public, Turnstile protected
 * POST /kscw/newsletter/verify — public
 * POST /kscw/newsletter/unsubscribe — public
 */

import crypto from 'crypto';

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || '';
const WEBSITE_URL = process.env.KSCW_WEBSITE_URL || 'https://kscw.ch';

async function verifyTurnstile(token) {
  if (!TURNSTILE_SECRET) return true;
  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${TURNSTILE_SECRET}&response=${token}`,
  });
  return (await resp.json()).success === true;
}

export function registerNewsletter(router, { database, logger, services, getSchema }) {
  const log = logger.child({ endpoint: 'newsletter' });

  // POST /kscw/newsletter/subscribe
  router.post('/newsletter/subscribe', async (req, res) => {
    try {
      const { email, locale, categories, turnstile_token } = req.body;
      if (!email) return res.status(400).json({ error: 'email required' });

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email' });

      if (!turnstile_token || !(await verifyTurnstile(turnstile_token))) {
        return res.status(400).json({ error: 'Captcha verification failed' });
      }

      const validLocales = ['de', 'en'];
      const loc = validLocales.includes(locale) ? locale : 'de';
      const cats = Array.isArray(categories) ? categories.filter(c => ['volleyball', 'basketball', 'club'].includes(c)) : ['volleyball', 'basketball', 'club'];

      // Check existing
      const existing = await database('newsletter_subscribers').where('email', email.toLowerCase()).first();
      if (existing) {
        if (existing.verified) {
          return res.json({ success: true, already_subscribed: true });
        }
        // Resend verification
        const schema = await getSchema();
        const { MailService } = services;
        const mail = new MailService({ schema, knex: database });
        const verifyUrl = `${WEBSITE_URL}/${existing.locale}/news/?verify=${existing.verify_token}`;
        await mail.send({
          to: email,
          subject: loc === 'de' ? 'KSCW Newsletter — Bestätigung' : 'KSCW Newsletter — Confirmation',
          text: loc === 'de'
            ? `Bitte bestätige dein Newsletter-Abo: ${verifyUrl}`
            : `Please confirm your newsletter subscription: ${verifyUrl}`,
        });
        return res.json({ success: true });
      }

      const verifyToken = crypto.randomBytes(32).toString('hex');
      const unsubToken = crypto.randomBytes(32).toString('hex');

      await database('newsletter_subscribers').insert({
        id: crypto.randomUUID(),
        email: email.toLowerCase(),
        locale: loc,
        categories: JSON.stringify(cats),
        verified: false,
        verify_token: verifyToken,
        unsubscribe_token: unsubToken,
      });

      // Send verification email
      const schema = await getSchema();
      const { MailService } = services;
      const mail = new MailService({ schema, knex: database });
      const verifyUrl = `${WEBSITE_URL}/${loc}/news/?verify=${verifyToken}`;

      await mail.send({
        to: email,
        subject: loc === 'de' ? 'KSCW Newsletter — Bestätigung' : 'KSCW Newsletter — Confirmation',
        text: loc === 'de'
          ? `Bitte bestätige dein Newsletter-Abo: ${verifyUrl}`
          : `Please confirm your newsletter subscription: ${verifyUrl}`,
      });

      log.info(`Newsletter subscribe: ${email}`);
      res.json({ success: true });
    } catch (err) {
      log.error({ msg: `newsletter/subscribe: ${err.message}`, stack: err.stack });
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // POST /kscw/newsletter/verify
  router.post('/newsletter/verify', async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: 'token required' });

      const updated = await database('newsletter_subscribers')
        .where('verify_token', token)
        .where('verified', false)
        .update({ verified: true });

      if (!updated) return res.status(404).json({ error: 'Invalid or expired token' });

      log.info('Newsletter verified');
      res.json({ success: true });
    } catch (err) {
      log.error({ msg: `newsletter/verify: ${err.message}`, stack: err.stack });
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // POST /kscw/newsletter/unsubscribe
  router.post('/newsletter/unsubscribe', async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: 'token required' });

      const deleted = await database('newsletter_subscribers')
        .where('unsubscribe_token', token)
        .delete();

      if (!deleted) return res.status(404).json({ error: 'Invalid token' });

      log.info('Newsletter unsubscribed');
      res.json({ success: true });
    } catch (err) {
      log.error({ msg: `newsletter/unsubscribe: ${err.message}`, stack: err.stack });
      res.status(500).json({ error: 'Internal error' });
    }
  });
}
