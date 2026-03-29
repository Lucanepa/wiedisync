/**
 * Google Calendar Sync — ported from gcal_sync_lib.js
 * POST /kscw/admin/gcal-sync — manual trigger (admin only)
 * Also registered as cron in hooks extension
 */

const GCAL_IDS = [
  // Add Google Calendar IDs here as needed
]

function parseIcsDatetime(str) {
  if (!str) return null
  str = str.trim()
  // DATE-only: YYYYMMDD
  if (/^\d{8}$/.test(str)) {
    return { date: `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`, allDay: true }
  }
  // DATETIME: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const m = str.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/)
  if (!m) return null
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]))
  if (m[7]) {
    // UTC — convert to Zurich (approximate: +1 in winter, +2 in summer)
    const month = dt.getUTCMonth()
    const offset = (month >= 2 && month <= 9) ? 2 : 1
    dt.setUTCHours(dt.getUTCHours() + offset)
  }
  const d = dt.toISOString().slice(0, 10)
  const t = dt.toISOString().slice(11, 16)
  return { date: d, time: t, allDay: false }
}

function parseIcs(text) {
  const events = []
  const blocks = text.split('BEGIN:VEVENT')
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0]
    const ev = {}
    for (const line of block.split(/\r?\n/)) {
      const [key, ...rest] = line.split(':')
      const val = rest.join(':')
      const baseKey = key.split(';')[0]
      if (baseKey === 'SUMMARY') ev.title = val
      if (baseKey === 'DTSTART') ev.start = parseIcsDatetime(val)
      if (baseKey === 'DTEND') ev.end = parseIcsDatetime(val)
      if (baseKey === 'UID') ev.uid = val
      if (baseKey === 'LOCATION') ev.location = val
    }
    if (ev.uid && ev.start) events.push(ev)
  }
  return events
}

function resolveHall(title, location, hallLookup) {
  const text = `${title} ${location}`.toLowerCase()
  for (const [name, id] of Object.entries(hallLookup)) {
    if (text.includes(name.toLowerCase())) return id
  }
  return null
}

export function registerGCalSync(router, { database, logger }) {
  const log = logger.child({ endpoint: 'gcal-sync' })

  async function runSync(db) {
    const halls = await db('halls').select('id', 'name')
    const hallLookup = Object.fromEntries(halls.map(h => [h.name, h.id]))

    let created = 0, updated = 0, deleted = 0

    for (const calId of GCAL_IDS) {
      const url = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calId)}/public/basic.ics`
      const resp = await fetch(url)
      if (!resp.ok) { log.warn(`GCal fetch failed for ${calId}: ${resp.status}`); continue }
      const icsText = await resp.text()
      const events = parseIcs(icsText)

      // Season start (Sept 1 of current or previous year)
      const now = new Date()
      const seasonStart = new Date(now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear(), 8, 1)
        .toISOString().split('T')[0]

      const seenUids = new Set()

      for (const ev of events) {
        if (!ev.start || ev.start.date < seasonStart) continue
        if (ev.title?.startsWith('VB ')) continue // skip VB-prefixed events
        seenUids.add(ev.uid)

        const hallId = resolveHall(ev.title || '', ev.location || '', hallLookup)
        const record = {
          title: ev.title || '', date: ev.start.date,
          start_time: ev.start.time || null, end_time: ev.end?.time || null,
          all_day: ev.start.allDay, location: ev.location || '',
          source: 'gcal', uid: ev.uid,
        }
        if (hallId) record.hall = hallId

        const existing = await db('hall_events').where('uid', ev.uid).first()
        if (existing) {
          await db('hall_events').where('id', existing.id).update(record)
          updated++
        } else {
          await db('hall_events').insert(record)
          created++
        }
      }

      // Delete stale gcal events no longer in feed
      const existingGcal = await db('hall_events').where('source', 'gcal').select('id', 'uid')
      for (const row of existingGcal) {
        if (!seenUids.has(row.uid)) {
          await db('hall_events').where('id', row.id).delete()
          deleted++
        }
      }
    }

    return { created, updated, deleted }
  }

  router.post('/admin/gcal-sync', async (req, res) => {
    if (!req.accountability?.admin) return res.status(403).json({ error: 'Admin access required' })
    try {
      log.info('Manual GCal sync triggered')
      const result = await runSync(database)
      res.json({ status: 'ok', ...result })
    } catch (err) {
      log.error(`gcal-sync: ${err.message}`)
      res.status(500).json({ error: 'Internal error' })
    }
  })
}
