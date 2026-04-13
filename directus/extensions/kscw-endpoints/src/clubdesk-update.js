/**
 * ClubDesk Data Update — sends CSV email to admin when member updates ClubDesk-relevant fields
 * POST /kscw/clubdesk-update — authenticated
 */

import { buildEmailLayout, buildInfoCard } from './email-template.js'

const OWNER_EMAIL = 'luca.canepa@gmail.com'
const ADMIN_EMAIL = 'kontakt@kscw.ch'

/** German display labels for DB field names */
const FIELD_LABELS = {
  first_name: 'Vorname',
  last_name: 'Nachname',
  email: 'E-Mail',
  phone: 'Telefon',
  birthdate: 'Geburtsdatum',
  anrede: 'Anrede',
  adresse: 'Adresse',
  plz: 'PLZ',
  ort: 'Ort',
  nationalitaet: 'Nationalität',
  sex: 'Geschlecht',
  ahv_nummer: 'AHV-Nummer',
}

const CSV_HEADERS = [
  'Anrede', 'Vorname', 'Nachname', 'E-Mail', 'Telefon',
  'Adresse', 'PLZ', 'Ort', 'Geburtsdatum', 'Nationalität',
  'Geschlecht', 'AHV', 'Team', 'Beitragskategorie',
]

function escCsv(val) {
  const s = String(val ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s
}

function buildCsv(data, teamNames) {
  const row = [
    data.anrede, data.first_name, data.last_name, data.email, data.phone,
    data.adresse, data.plz, data.ort, data.birthdate, data.nationalitaet,
    data.sex, data.ahv_nummer, teamNames, data.beitragskategorie,
  ]
  return CSV_HEADERS.join(',') + '\n' + row.map(escCsv).join(',')
}

function buildChangesTable(changes) {
  const rows = changes.map(c => {
    const label = FIELD_LABELS[c.field] || c.field
    return `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #334155;color:#e2e8f0;font-size:13px">${label}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #334155;color:#ef4444;font-size:13px;text-decoration:line-through">${c.old_value || '—'}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #334155;color:#22c55e;font-size:13px">${c.new_value || '—'}</td>
    </tr>`
  }).join('')

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #334155;border-radius:8px;overflow:hidden;margin:12px 0">
  <tr>
    <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #334155">Feld</th>
    <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #334155">Alt</th>
    <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #334155">Neu</th>
  </tr>
  ${rows}
</table>`
}

export function registerClubdeskUpdate(router, { database, logger, services, getSchema }) {
  const log = logger.child({ endpoint: 'clubdesk-update' })

  router.post('/clubdesk-update', async (req, res) => {
    try {
      // Auth check
      const userId = req.accountability?.user
      if (!userId) return res.status(401).json({ error: 'Authentication required' })

      const { member_id, changes, current_data } = req.body
      if (!member_id || !changes?.length || !current_data) {
        return res.status(400).json({ error: 'member_id, changes, current_data required' })
      }

      // Verify ownership: accountability.user is Directus user ID, member_id is members collection ID
      const member = await database('members').where('user', userId).select('id').first()
      if (!member || String(member.id) !== String(member_id)) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      // Get team names for CSV
      const schema = await getSchema()
      const { ItemsService, MailService } = services
      const mtService = new ItemsService('member_teams', { schema, knex: database })
      const memberTeams = await mtService.readByQuery({
        filter: { member: { _eq: member_id } },
        fields: ['team.name', 'team.sport'],
      })
      const teamNames = memberTeams
        .map(mt => mt.team?.name)
        .filter(Boolean)
        .join(', ')

      // Determine sport for email accent
      const teamSports = memberTeams.map(mt => mt.team?.sport).filter(Boolean)
      const sport = teamSports.includes('volleyball') ? 'volleyball'
        : teamSports.includes('basketball') ? 'basketball' : null

      // Build email
      const name = `${current_data.first_name} ${current_data.last_name}`
      const changesHtml = buildChangesTable(changes)

      const summaryCard = buildInfoCard([
        { label: 'Name', value: name, halfWidth: true },
        { label: 'E-Mail', value: current_data.email, halfWidth: true },
        { label: 'Telefon', value: current_data.phone || '—', halfWidth: true },
        { label: 'Team', value: teamNames || '—', halfWidth: true },
      ])

      const body = `
<div style="font-size:13px;color:#94a3b8;margin-bottom:12px">
  Folgende Daten wurden vom Mitglied aktualisiert und müssen in ClubDesk übernommen werden:
</div>
${changesHtml}
<div style="margin-top:16px">
  <div style="font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;margin-bottom:8px;font-weight:700">Aktuelle Daten</div>
  ${summaryCard}
</div>`

      const emailHtml = buildEmailLayout(body, {
        title: 'ClubDesk Datenanpassung',
        subtitle: name,
        sport,
      })

      // Build CSV
      const csvString = buildCsv(current_data, teamNames)
      const dateStr = new Date().toISOString().slice(0, 10)
      const filename = `clubdesk-update-${current_data.last_name}-${current_data.first_name}-${dateStr}.csv`

      // Send email with CSV attachment
      const mail = new MailService({ schema, knex: database })
      await mail.send({
        to: OWNER_EMAIL,
        cc: ADMIN_EMAIL,
        subject: `[KSCW] Datenanpassung: ${name}`,
        html: emailHtml,
        attachments: [{
          filename,
          content: csvString,
          contentType: 'text/csv',
        }],
      })

      log.info({ msg: 'ClubDesk update email sent', member_id, changes: changes.length })
      res.json({ success: true })
    } catch (err) {
      log.error({
        msg: `clubdesk-update: ${err.message}`,
        endpoint: 'clubdesk-update',
        stack: err.stack,
      })
      res.status(500).json({ error: 'Internal error' })
    }
  })
}
