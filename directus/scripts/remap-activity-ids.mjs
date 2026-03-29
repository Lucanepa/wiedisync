/**
 * Remap stale PocketBase alphanumeric IDs → Directus integer IDs
 * in polymorphic reference fields.
 *
 * Affected fields:
 *   1. participations.activity_id  → games/trainings/events
 *   2. notifications.activity_id   → games/trainings/events/polls/tasks/carpool
 *   3. tasks.activity_id           → games/trainings/events
 *   4. user_logs.record_id         → any collection
 *   5. slot_claims.freed_source_id → games/trainings/events
 *
 * Strategy: For each source collection (games, trainings, events, etc.),
 * fetch all records that have a `game_id` or similar PB-origin identifier,
 * build a pbId → directusId map, then bulk-update the affected records.
 *
 * Run: DIRECTUS_URL=https://directus-dev.kscw.ch ADMIN_PASSWORD=Admin1234! node directus/scripts/remap-activity-ids.mjs
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus-dev.kscw.ch'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@kscw.ch'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
if (!ADMIN_PASSWORD) { console.error('❌ ADMIN_PASSWORD required'); process.exit(1) }

const UA = 'wiedisync-migration'
let TOKEN = ''

async function login() {
  const res = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  const data = await res.json()
  TOKEN = data.data.access_token
  console.log('✅ Logged in to Directus')
}

async function fetchAll(collection, fields = ['id'], filter = {}) {
  const params = new URLSearchParams()
  params.set('fields', fields.join(','))
  params.set('limit', '-1')
  if (Object.keys(filter).length > 0) params.set('filter', JSON.stringify(filter))
  const res = await fetch(`${DIRECTUS_URL}/items/${collection}?${params}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'User-Agent': UA },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Fetch ${collection} failed: ${res.status} ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.data
}

async function updateRecord(collection, id, data) {
  const res = await fetch(`${DIRECTUS_URL}/items/${collection}/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const text = await res.text()
    console.warn(`  ⚠️ Update ${collection}/${id} failed: ${res.status} ${text.slice(0, 100)}`)
    return false
  }
  return true
}

// ── Build PB ID → Directus ID maps ──────────────────────────────────

async function buildIdMaps() {
  console.log('\n📋 Building ID maps from Directus data...')
  const maps = {}

  // Collections that have polymorphic activity_id references
  // We need to match old PB IDs. During migration, PB records were imported
  // with their data but got new integer IDs. We can identify old PB IDs
  // by checking the original PB-originated identifier fields.

  // Games: game_id contains the original PB-formatted ID (e.g. "vb_123" or the PB record ID)
  // Actually, game_id is the Swiss Volley / Basketplan external ID, not the PB record ID.
  // The PB record ID was the `id` field in PB. During migration, records were inserted
  // in order, so we can't recover the mapping without the original PB data.

  // ALTERNATIVE APPROACH: Since we have PB still accessible via the migration script's
  // original data, and the records were migrated in order, we can:
  // 1. Fetch all PB records (they still have their original IDs)
  // 2. Match by unique fields (e.g. game: game_id+date, training: team+date+start_time)
  // 3. Build the map

  // But PB dev is stopped. Let's try a simpler approach:
  // The migrate-data.mjs imported records in PB sort order.
  // PB records have 15-char alphanumeric IDs. Directus has sequential integers.
  // If we can sort both the same way, we can reconstruct the mapping.

  // SIMPLEST APPROACH: Check if activity_ids in participations look like PB IDs
  // (15 chars, alphanumeric) and if so, we need the mapping.
  // Since PB dev is stopped, let's query the PB prod API to get the mapping.

  // Actually, let's check: does the migrate script save a mapping anywhere in Directus?
  // No. Let's try a different approach entirely.

  // APPROACH: Use the Directus data itself. For each collection, records have unique
  // business keys. We need to read the old PB data to get old IDs.
  // Let's check if PB dev or prod is accessible.

  return maps
}

// ── PRAGMATIC APPROACH ───────────────────────────────────────────────
// Since PB IDs can't be recovered from Directus alone, we'll:
// 1. Read ALL PB records via the prod API (still running)
// 2. Match to Directus records by unique business keys
// 3. Build pbId → directusId map
// 4. Update the polymorphic fields

const PB_URL = process.env.PB_URL || 'https://api.kscw.ch'
let PB_TOKEN = ''

async function pbLogin() {
  const email = process.env.PB_EMAIL || 'admin@kscw.ch'
  const password = process.env.PB_PASSWORD
  if (!password) {
    console.log('⚠️ PB_PASSWORD not set — trying without PB (will use fallback matching)')
    return false
  }
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  })
  if (!res.ok) { console.warn('⚠️ PB login failed'); return false }
  const data = await res.json()
  PB_TOKEN = data.token
  console.log('✅ Logged in to PocketBase')
  return true
}

async function pbFetchAll(collection) {
  const items = []
  let page = 1
  while (true) {
    const res = await fetch(`${PB_URL}/api/collections/${collection}/records?page=${page}&perPage=500`, {
      headers: { Authorization: PB_TOKEN },
    })
    if (!res.ok) break
    const data = await res.json()
    items.push(...data.items)
    if (page >= data.totalPages) break
    page++
  }
  return items
}

async function buildMapsFromPB() {
  console.log('\n📋 Building ID maps from PocketBase prod...')
  const maps = {}

  const collections = ['games', 'trainings', 'events', 'polls', 'tasks', 'carpool', 'hall_slots']

  for (const coll of collections) {
    try {
      const pbItems = await pbFetchAll(coll)
      if (pbItems.length === 0) { console.log(`  ${coll}: 0 PB records`); continue }

      // Fetch Directus items with matching business keys
      let dirItems
      try {
        dirItems = await fetchAll(coll, ['id', 'game_id', 'date', 'start_time', 'team', 'title', 'start_date', 'hall', 'day_of_week'], {})
      } catch {
        // Some fields may not exist on all collections
        dirItems = await fetchAll(coll, ['id'], {})
      }

      // Build map by matching records
      const pbToDir = {}
      let matched = 0

      if (coll === 'games') {
        // Match by game_id (external ID from Swiss Volley / Basketplan)
        const dirByGameId = new Map(dirItems.map(d => [d.game_id, String(d.id)]))
        for (const pb of pbItems) {
          const dirId = dirByGameId.get(pb.game_id)
          if (dirId) { pbToDir[pb.id] = dirId; matched++ }
        }
      } else if (coll === 'trainings') {
        // Match by team + date + start_time
        const dirKey = (d) => `${d.team}|${(d.date || '').split('T')[0]}|${d.start_time}`
        // Need team as Directus ID — but PB team is a PB ID too. Use date+time as key.
        const dirByKey = new Map()
        for (const d of dirItems) dirByKey.set(`${(d.date || '').split('T')[0]}|${d.start_time}`, String(d.id))
        for (const pb of pbItems) {
          const key = `${pb.date}|${pb.start_time}`
          const dirId = dirByKey.get(key)
          if (dirId) { pbToDir[pb.id] = dirId; matched++ }
        }
      } else if (coll === 'events') {
        // Match by title + start_date
        const dirByKey = new Map(dirItems.map(d => [`${d.title}|${(d.start_date || '').split('T')[0]}`, String(d.id)]))
        for (const pb of pbItems) {
          const key = `${pb.title}|${pb.start_date}`
          const dirId = dirByKey.get(key)
          if (dirId) { pbToDir[pb.id] = dirId; matched++ }
        }
      } else if (coll === 'hall_slots') {
        // Match by hall + day_of_week + start_time
        const dirByKey = new Map(dirItems.map(d => [`${d.hall}|${d.day_of_week}|${d.start_time}`, String(d.id)]))
        // PB hall is a PB ID — skip complex matching for now
        // Use positional matching (same order) as fallback
        if (pbItems.length === dirItems.length) {
          const pbSorted = [...pbItems].sort((a, b) => a.created > b.created ? 1 : -1)
          const dirSorted = [...dirItems].sort((a, b) => a.id - b.id)
          for (let i = 0; i < pbSorted.length; i++) {
            pbToDir[pbSorted[i].id] = String(dirSorted[i].id)
            matched++
          }
        }
      } else {
        // Fallback: positional matching (records migrated in order)
        if (pbItems.length === dirItems.length) {
          const pbSorted = [...pbItems].sort((a, b) => a.created > b.created ? 1 : -1)
          const dirSorted = [...dirItems].sort((a, b) => a.id - b.id)
          for (let i = 0; i < pbSorted.length; i++) {
            pbToDir[pbSorted[i].id] = String(dirSorted[i].id)
            matched++
          }
        }
      }

      maps[coll] = pbToDir
      console.log(`  ${coll}: ${matched}/${pbItems.length} matched (${dirItems.length} in Directus)`)
    } catch (e) {
      console.warn(`  ${coll}: error — ${e.message}`)
    }
  }

  return maps
}

// ── Remap polymorphic fields ─────────────────────────────────────────

async function remapField(collection, field, activityTypeField, maps) {
  console.log(`\n🔄 Remapping ${collection}.${field}...`)

  // Fetch all records where the field looks like a PB ID (15 chars, alphanumeric)
  const records = await fetchAll(collection, ['id', field, activityTypeField].filter(Boolean), {})
  const pbIdPattern = /^[a-z0-9]{15}$/

  let updated = 0, skipped = 0, notFound = 0

  for (const rec of records) {
    const oldId = rec[field]
    if (!oldId || !pbIdPattern.test(oldId)) { skipped++; continue }

    // Determine target collection from activity_type
    const type = activityTypeField ? rec[activityTypeField] : null
    let targetColl = null
    if (type === 'game') targetColl = 'games'
    else if (type === 'training') targetColl = 'trainings'
    else if (type === 'event') targetColl = 'events'
    else if (type === 'poll') targetColl = 'polls'
    else if (type === 'task') targetColl = 'tasks'
    else if (type === 'carpool') targetColl = 'carpool'

    // For user_logs.record_id and slot_claims.freed_source_id, try all maps
    let newId = null
    if (targetColl && maps[targetColl]) {
      newId = maps[targetColl][oldId]
    } else {
      // Try all maps
      for (const [, map] of Object.entries(maps)) {
        if (map[oldId]) { newId = map[oldId]; break }
      }
    }

    if (newId) {
      const ok = await updateRecord(collection, rec.id, { [field]: newId })
      if (ok) updated++
    } else {
      notFound++
    }
  }

  console.log(`  ✅ ${updated} updated, ${skipped} already OK, ${notFound} not mapped`)
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  await login()

  const hasPB = await pbLogin()
  if (!hasPB) {
    console.error('❌ Need PB access to build ID maps. Set PB_PASSWORD.')
    process.exit(1)
  }

  const maps = await buildMapsFromPB()

  // Save maps for reference
  const { writeFile } = await import('fs/promises')
  await writeFile(
    new URL('./id-map.json', import.meta.url),
    JSON.stringify(maps, null, 2),
  )
  console.log('\n📄 ID map saved to directus/scripts/id-map.json')

  // Remap each affected field
  await remapField('participations', 'activity_id', 'activity_type', maps)
  await remapField('notifications', 'activity_id', 'activity_type', maps)
  await remapField('tasks', 'activity_id', 'activity_type', maps)
  await remapField('user_logs', 'record_id', 'collection_name', maps)
  await remapField('slot_claims', 'freed_source_id', null, maps)

  console.log('\n✅ Done!')
}

main().catch(e => { console.error('❌', e); process.exit(1) })
