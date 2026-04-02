/**
 * Registration Form — unified member registration (VB/BB/Passive)
 * POST /kscw/registration — public, Turnstile protected
 * POST /kscw/registration/:id/files — public, upload ID files after registration
 */

import { buildEmailLayout, buildInfoCard, formatDateCH } from './email-template.js'
import crypto from 'crypto'

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || ''

const ADMIN_EMAIL = 'kontakt@kscw.ch'
const OWNER_EMAIL = 'luca.canepa@gmail.com'
const BB_ADMIN_EMAIL = 'basketball@kscw.ch'  // Basketball-specific admin
const VB_ADMIN_EMAIL = 'volleyball@kscw.ch'  // Volleyball-specific admin

async function verifyTurnstile(token) {
  if (!TURNSTILE_SECRET) return true
  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${TURNSTILE_SECRET}&response=${token}`,
  })
  return (await resp.json()).success === true
}

function generateRefNumber() {
  const now = new Date()
  const y = now.getFullYear()
  const rand = String(1000 + (crypto.randomBytes(2).readUInt16BE(0) % 9000))
  return `REG-${y}-${rand}`
}

// ── Confirmation emails ─────────────────────────────────────────

function buildVolleyballEmail(reg) {
  const dob = reg.geburtsdatum ? formatDateCH(reg.geburtsdatum) : '-'

  const summary = buildInfoCard([
    { label: 'Name', value: `${reg.vorname} ${reg.nachname}`, halfWidth: true },
    { label: 'Team', value: reg.team || '-', halfWidth: true },
    { label: 'Beitragskategorie', value: reg.beitragskategorie || '-', halfWidth: true },
    { label: 'Geburtsdatum', value: dob, halfWidth: true },
    { label: 'E-Mail', value: reg.email },
    { label: 'Telefon', value: reg.telefon_mobil || '-' },
    { label: 'Adresse', value: `${reg.adresse || ''}, ${reg.plz || ''} ${reg.ort || ''}` },
    { label: 'Nationalität', value: reg.nationalitaet || '-', halfWidth: true },
    { label: 'Geschlecht', value: reg.geschlecht || '-', halfWidth: true },
    ...(reg.lizenz ? [{ label: 'Lizenz', value: reg.lizenz }] : []),
    ...(reg.schiedsrichter_stufe ? [{ label: 'Schiedsrichter-Stufe', value: reg.schiedsrichter_stufe }] : []),
    { label: 'Referenz', value: reg.reference_number },
  ])

  const feeTable = `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #334155;border-radius:8px;overflow:hidden;margin:12px 0">
  <tr><td style="padding:16px 20px">
    <div style="font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;margin-bottom:8px;font-weight:700">Mitgliederbeiträge</div>
    <div style="font-size:13px;color:#e2e8f0;line-height:1.8">
      Erwerbstätige: CHF 440.–<br>
      Studenten/Studentinnen / Lernende: CHF 380.–<br>
      Schüler/Schülerinnen (Meisterschaft): CHF 310.–<br>
      Schüler/Schülerinnen (nur Turniere): CHF 210.–<br>
      Schüler/Schülerinnen (nur Turniere, 1. Saison): CHF 110.–
    </div>
  </td></tr>
</table>`

  const body = summary + feeTable + `
<div style="font-size:13px;color:#94a3b8;line-height:1.7;margin-top:12px">
  <p>Bitte beachte, dass der Lizenzierungsprozess ab Zahlung des Mitgliederbeitrags mind. eine Woche dauert.</p>
  <p>Du erhältst in den nächsten Tagen (oder im August, der Hauptrechnungsperiode) eine Rechnung von uns. Deine Lizenz wird erst bestellt, wenn der Beitrag beim KSCW eingetroffen ist — also einfach möglichst bald einzahlen.</p>
  <p>Neu musst du dir unter <a href="https://volleymanager.volleyball.ch/login" style="color:#FFC832">volleymanager.volleyball.ch</a> ein Login erstellen, falls du noch keines besitzt.</p>
  <p>Bei Fragen zum Club, deinem Team oder dem Lizenzierungsprozess kann dir dein Coach oder auch wir gerne Auskunft geben.</p>
</div>`

  return buildEmailLayout(body, {
    title: 'Willkommen beim KSC Wiedikon!',
    subtitle: 'Deine Volleyball-Anmeldung ist eingegangen',
    sport: 'volleyball',
    greeting: `Hallo ${reg.vorname},`,
    footerExtra: 'Sportliche Grüsse — KSC Wiedikon Volleyball',
  })
}

function buildBasketballEmail(reg) {
  const dob = reg.geburtsdatum ? formatDateCH(reg.geburtsdatum) : '-'

  const summary = buildInfoCard([
    { label: 'Name', value: `${reg.vorname} ${reg.nachname}`, halfWidth: true },
    { label: 'Team', value: reg.team || '-', halfWidth: true },
    { label: 'Beitragskategorie', value: reg.beitragskategorie || '-', halfWidth: true },
    { label: 'Geburtsdatum', value: dob, halfWidth: true },
    { label: 'E-Mail', value: reg.email },
    { label: 'Telefon', value: reg.telefon_mobil || '-' },
    { label: 'Adresse', value: `${reg.adresse || ''}, ${reg.plz || ''} ${reg.ort || ''}` },
    { label: 'Nationalität', value: reg.nationalitaet || '-', halfWidth: true },
    { label: 'Geschlecht', value: reg.geschlecht || '-', halfWidth: true },
    ...(reg.lizenz ? [{ label: 'Lizenz', value: reg.lizenz }] : []),
    { label: 'Referenz', value: reg.reference_number },
  ])

  const body = summary + `
<div style="font-size:13px;color:#94a3b8;line-height:1.7;margin-top:12px">
  <p>Deine Anmeldung wird von unserem Admin-Team geprüft. Du wirst benachrichtigt, sobald sie genehmigt wurde.</p>
  <p><strong style="color:#e2e8f0">Nächste Schritte:</strong></p>
  <ul style="padding-left:20px;margin:8px 0">
    <li>Stelle sicher, dass du deine ID-Kopie (Vorder- und Rückseite) hochgeladen hast</li>
    <li>Der Lizenzantrag wird vom Admin vorbereitet</li>
    <li>Die Bearbeitung dauert in der Regel einige Werktage</li>
  </ul>
  <p>Bei Fragen wende dich an deinen Coach oder an <a href="mailto:kontakt@kscw.ch" style="color:#F97316">kontakt@kscw.ch</a>.</p>
</div>`

  return buildEmailLayout(body, {
    title: 'Anmeldung eingegangen',
    subtitle: 'KSC Wiedikon Basketball',
    sport: 'basketball',
    greeting: `Hallo ${reg.vorname},`,
    footerExtra: 'KSC Wiedikon Basketball',
  })
}

function buildPassiveEmail(reg) {
  const summary = buildInfoCard([
    { label: 'Name', value: `${reg.vorname} ${reg.nachname}` },
    { label: 'E-Mail', value: reg.email },
    { label: 'Telefon', value: reg.telefon_mobil || '-' },
    ...(reg.lizenz ? [{ label: 'Lizenz', value: reg.lizenz }] : []),
    ...(reg.schiedsrichter_stufe ? [{ label: 'Schiedsrichter-Stufe', value: reg.schiedsrichter_stufe }] : []),
    { label: 'Referenz', value: reg.reference_number },
  ])

  const body = summary + `
<div style="font-size:13px;color:#94a3b8;line-height:1.7;margin-top:12px">
  <p>Deine Anmeldung als Passivmitglied ist eingegangen und wird geprüft.</p>
  <p>Du erhältst in den nächsten Tagen eine Rechnung für den Passivmitgliederbeitrag (CHF 50.–).</p>
  <p>Bei Fragen erreichst du uns unter <a href="mailto:kontakt@kscw.ch" style="color:#4A55A2">kontakt@kscw.ch</a>.</p>
</div>`

  return buildEmailLayout(body, {
    title: 'Passivmitgliedschaft',
    subtitle: 'Anmeldung eingegangen',
    greeting: `Hallo ${reg.vorname},`,
    footerExtra: 'KSC Wiedikon',
  })
}

// ── Admin notification email ────────────────────────────────────

function buildAdminNotificationEmail(reg) {
  const dob = reg.geburtsdatum ? formatDateCH(reg.geburtsdatum) : '-'
  const sport = reg.membership_type === 'volleyball' ? 'volleyball' : reg.membership_type === 'basketball' ? 'basketball' : null

  const summary = buildInfoCard([
    { label: 'Name', value: `${reg.vorname} ${reg.nachname}`, halfWidth: true },
    { label: 'Typ', value: reg.membership_type, halfWidth: true },
    { label: 'Team', value: reg.team || '-', halfWidth: true },
    { label: 'Beitragskategorie', value: reg.beitragskategorie || '-', halfWidth: true },
    { label: 'E-Mail', value: reg.email, halfWidth: true },
    { label: 'Telefon', value: reg.telefon_mobil || '-', halfWidth: true },
    { label: 'Adresse', value: `${reg.adresse || ''}, ${reg.plz || ''} ${reg.ort || ''}` },
    { label: 'Geburtsdatum', value: dob, halfWidth: true },
    { label: 'Nationalität', value: reg.nationalitaet || '-', halfWidth: true },
    { label: 'AHV', value: reg.ahv_nummer || '-', halfWidth: true },
    { label: 'Kantonsschule', value: reg.kantonsschule || '-', halfWidth: true },
    ...(reg.lizenz ? [{ label: 'Lizenz', value: reg.lizenz }] : []),
    ...(reg.schiedsrichter_stufe ? [{ label: 'Schiedsrichter-Stufe', value: reg.schiedsrichter_stufe }] : []),
    { label: 'Referenz', value: reg.reference_number },
  ])

  const instructions = `
<div style="font-size:13px;color:#94a3b8;line-height:1.7;margin-top:12px">
  <p><strong style="color:#e2e8f0">Nächste Schritte:</strong></p>
  <ol style="padding-left:20px;margin:8px 0">
    <li>Daten im Admin-Bereich prüfen und ggf. bearbeiten</li>
    <li>Anmeldung bestätigen oder ablehnen</li>
    <li>Nach Bestätigung wird automatisch eine CSV-Datei generiert</li>
  </ol>
</div>`

  const body = summary +
    (reg.bemerkungen ? `<div style="font-size:13px;color:#94a3b8;margin-top:12px"><strong style="color:#e2e8f0">Bemerkungen:</strong><br>${reg.bemerkungen}</div>` : '') +
    instructions

  return buildEmailLayout(body, {
    title: 'Neue Anmeldung',
    subtitle: `${reg.vorname} ${reg.nachname} — ${reg.membership_type}`,
    sport,
    ctaUrl: 'https://kscw.ch/admin',
    ctaLabel: 'Im Admin prüfen',
  })
}

// ── Endpoint ────────────────────────────────────────────────────

export function registerRegistration(router, { database, logger, services, getSchema }) {
  const log = logger.child({ endpoint: 'registration' })

  // POST /kscw/registration — create new registration
  router.post('/registration', async (req, res) => {
    try {
      const body = req.body
      if (!body || !body.vorname || !body.nachname || !body.email || !body.membership_type) {
        return res.status(400).json({ error: 'vorname, nachname, email, membership_type required' })
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(body.email)) {
        return res.status(400).json({ error: 'Invalid email format' })
      }

      const validTypes = ['volleyball', 'basketball', 'passive']
      if (!validTypes.includes(body.membership_type)) {
        return res.status(400).json({ error: 'Invalid membership_type' })
      }

      if (!body.turnstile_token || !(await verifyTurnstile(body.turnstile_token))) {
        return res.status(400).json({ error: 'Captcha verification failed' })
      }

      const reference_number = generateRefNumber()

      const schema = await getSchema()
      const { ItemsService, MailService } = services
      const itemsService = new ItemsService('registrations', { schema, knex: database })

      const id = await itemsService.createOne({
        status: 'pending',
        membership_type: body.membership_type,
        anrede: body.anrede || null,
        vorname: body.vorname.trim(),
        nachname: body.nachname.trim(),
        email: body.email.trim().toLowerCase(),
        telefon_mobil: body.telefon_mobil || null,
        adresse: body.adresse || null,
        plz: body.plz || null,
        ort: body.ort || null,
        geburtsdatum: body.geburtsdatum || null,
        nationalitaet: body.nationalitaet || null,
        geschlecht: body.geschlecht || null,
        ahv_nummer: body.ahv_nummer || null,
        team: body.team || null,
        beitragskategorie: body.beitragskategorie || null,
        kantonsschule: body.kantonsschule || null,
        rolle: body.rolle || null,
        lizenz: body.lizenz || null,
        schiedsrichter_stufe: body.schiedsrichter_stufe || null,
        bemerkungen: body.bemerkungen || null,
        reference_number,
        submitted_at: new Date().toISOString(),
      })

      const reg = await itemsService.readOne(id)

      // Send confirmation email to user
      const mail = new MailService({ schema, knex: database })
      try {
        let emailHtml
        let emailSubject
        if (body.membership_type === 'volleyball') {
          emailHtml = buildVolleyballEmail(reg)
          emailSubject = 'Willkommen beim KSC Wiedikon — Volleyball'
        } else if (body.membership_type === 'basketball') {
          emailHtml = buildBasketballEmail(reg)
          emailSubject = 'Anmeldung eingegangen — KSC Wiedikon Basketball'
        } else {
          emailHtml = buildPassiveEmail(reg)
          emailSubject = 'Passivmitgliedschaft — KSC Wiedikon'
        }

        await mail.send({
          to: reg.email,
          subject: emailSubject,
          html: emailHtml,
        })

        // Notify sport-specific admin + CC owner
        const adminTo = body.membership_type === 'basketball' ? BB_ADMIN_EMAIL
          : body.membership_type === 'volleyball' ? VB_ADMIN_EMAIL
          : ADMIN_EMAIL
        await mail.send({
          to: adminTo,
          cc: OWNER_EMAIL,
          subject: `[KSCW] Neue Anmeldung: ${reg.vorname} ${reg.nachname} (${reg.membership_type})`,
          html: buildAdminNotificationEmail(reg),
        })
      } catch (emailErr) {
        log.warn({ msg: `Confirmation email failed: ${emailErr.message}`, id })
        // Don't fail the registration if email fails
      }

      log.info({ msg: 'Registration created', id, type: body.membership_type, ref: reference_number })
      res.json({ success: true, id, reference_number })
    } catch (err) {
      log.error({
        msg: `registration: ${err.message}`,
        endpoint: 'registration',
        method: req.method,
        stack: err.stack,
      })
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // POST /kscw/registration/:id/files — upload ID files
  // Frontend sends files as FormData after initial registration
  router.post('/registration/:id/files', async (req, res) => {
    try {
      const { id } = req.params
      if (!id) return res.status(400).json({ error: 'id required' })

      const schema = await getSchema()
      const { ItemsService, FilesService } = services
      const itemsService = new ItemsService('registrations', { schema, knex: database })

      // Verify registration exists, is pending, and email matches
      let reg
      try {
        reg = await itemsService.readOne(id)
      } catch {
        return res.status(404).json({ error: 'Registration not found' })
      }
      if (!reg || reg.status !== 'pending') {
        return res.status(404).json({ error: 'Registration not found' })
      }
      if (!req.body.email || req.body.email.toLowerCase() !== reg.email.toLowerCase()) {
        return res.status(403).json({ error: 'Email mismatch' })
      }

      // Files come as multipart — Directus's Express instance has multer available
      // but for custom endpoints we need to handle it manually
      // The frontend will upload files to /files API directly and then PATCH the registration
      // This endpoint is a convenience wrapper

      // For now, accept JSON with file IDs (frontend uploads to /files first)
      const { id_upload_front, id_upload_back } = req.body
      const update = {}
      if (id_upload_front) update.id_upload_front = id_upload_front
      if (id_upload_back) update.id_upload_back = id_upload_back

      if (Object.keys(update).length) {
        await itemsService.updateOne(id, update)
      }

      res.json({ success: true })
    } catch (err) {
      log.error({
        msg: `registration files: ${err.message}`,
        endpoint: 'registration/:id/files',
        stack: err.stack,
      })
      res.status(500).json({ error: 'Internal error' })
    }
  })
}
