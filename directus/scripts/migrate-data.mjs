/**
 * KSCW PocketBase → Directus Data Migration
 *
 * Reads all records from PocketBase dev API and imports them into local Directus.
 * Handles:
 *   - ID mapping (PB 15-char string → Directus auto-increment integer)
 *   - File migration (downloads from PB, uploads to Directus)
 *   - M2O relations (remapped via ID lookup)
 *   - M2M relations (junction table inserts)
 *   - JSON fields (passed through)
 *
 * Run with: node scripts/migrate-data.mjs
 * Requires: Directus running at http://localhost:8055, PB accessible
 *
 * Environment:
 *   PB_URL        — PocketBase URL (default: https://api-dev.kscw.ch)
 *   PB_EMAIL      — PB admin email
 *   PB_PASSWORD   — PB admin password
 *   DIRECTUS_URL  — Directus URL (default: http://localhost:8055)
 *   ADMIN_EMAIL   — Directus admin email
 *   ADMIN_PASSWORD — Directus admin password
 */

import { writeFile, unlink } from 'fs/promises'
import { createReadStream } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// ── Config ──────────────────────────────────────────────────────────

const PB_URL = process.env.PB_URL || 'https://api-dev.kscw.ch'
const PB_EMAIL = process.env.PB_EMAIL || 'admin@kscw.ch'
const PB_PASSWORD = process.env.PB_PASSWORD
if (!PB_PASSWORD) {
  console.error('❌ PB_PASSWORD environment variable is required')
  process.exit(1)
}

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@kscw.ch'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'REDACTED_ADMIN_PASSWORD'

// PB ID → Directus integer ID mapping, per collection
const idMap = {} // { collectionName: { pbId: directusId } }

// Track file migrations: PB filename → Directus file UUID
const fileMap = {}

// Stats
const stats = { migrated: 0, skipped: 0, errors: 0, files: 0 }

// ── PocketBase helpers ──────────────────────────────────────────────

let pbToken = null

async function pbAuth() {
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASSWORD }),
  })
  if (!res.ok) throw new Error(`PB auth failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  pbToken = data.token
  console.log('✓ PocketBase authenticated')
}

async function pbList(collection, page = 1, perPage = 500) {
  const res = await fetch(
    `${PB_URL}/api/collections/${collection}/records?page=${page}&perPage=${perPage}`,
    { headers: { Authorization: pbToken } },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PB list ${collection} p${page}: ${res.status} ${text}`)
  }
  return res.json()
}

async function pbListAll(collection) {
  const records = []
  let page = 1
  while (true) {
    const result = await pbList(collection, page, 500)
    records.push(...result.items)
    if (records.length >= result.totalItems) break
    page++
  }
  return records
}

function pbFileUrl(collection, recordId, filename) {
  return `${PB_URL}/api/files/${collection}/${recordId}/${filename}`
}

// ── Directus helpers ────────────────────────────────────────────────

let dirToken = null

async function dirAuth() {
  const res = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  if (!res.ok) throw new Error(`Directus auth failed: ${res.status} ${await res.text()}`)
  const { data } = await res.json()
  dirToken = data.access_token
  console.log('✓ Directus authenticated')
}

async function dirCreate(collection, data) {
  const res = await fetch(`${DIRECTUS_URL}/items/${collection}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${dirToken}`,
    },
    body: JSON.stringify(data),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Directus create ${collection}: ${res.status} ${text}`)
  return JSON.parse(text).data
}

async function dirUploadFile(url, filename) {
  // Check cache
  if (fileMap[url]) return fileMap[url]

  try {
    // Download from PB
    const dlRes = await fetch(url, { headers: { Authorization: pbToken } })
    if (!dlRes.ok) {
      console.warn(`    ⚠ File download failed: ${url} (${dlRes.status})`)
      return null
    }

    const buffer = Buffer.from(await dlRes.arrayBuffer())
    const tmpPath = join(tmpdir(), `kscw-migrate-${Date.now()}-${filename}`)
    await writeFile(tmpPath, buffer)

    // Upload to Directus
    const formData = new FormData()
    const blob = new Blob([buffer], { type: guessContentType(filename) })
    formData.append('file', blob, filename)

    const upRes = await fetch(`${DIRECTUS_URL}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${dirToken}` },
      body: formData,
    })

    await unlink(tmpPath).catch(() => {})

    if (!upRes.ok) {
      console.warn(`    ⚠ File upload failed: ${filename} (${upRes.status})`)
      return null
    }

    const { data } = await upRes.json()
    fileMap[url] = data.id
    stats.files++
    return data.id
  } catch (err) {
    console.warn(`    ⚠ File error: ${filename}: ${err.message}`)
    return null
  }
}

function guessContentType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase()
  const types = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    pdf: 'application/pdf',
  }
  return types[ext] || 'application/octet-stream'
}

// ── ID mapping ──────────────────────────────────────────────────────

function setId(collection, pbId, dirId) {
  if (!idMap[collection]) idMap[collection] = {}
  idMap[collection][pbId] = dirId
}

function getId(collection, pbId) {
  if (!pbId) return null
  return idMap[collection]?.[pbId] ?? null
}

// ── Migration logic ─────────────────────────────────────────────────

/**
 * Migrate a single collection.
 *
 * @param {string} pbCollection - PocketBase collection name
 * @param {string} dirCollection - Directus collection name (usually same)
 * @param {object} opts
 * @param {string[]} opts.scalarFields - fields to copy as-is
 * @param {object} opts.m2oFields - { fieldName: relatedCollection }
 * @param {object} opts.fileFields - { fieldName: true } - single file fields
 * @param {object} opts.jsonFields - { fieldName: true } - JSON fields (pass through)
 * @param {Function} opts.transform - optional (record) => patchObject
 */
async function migrateCollection(pbCollection, dirCollection, opts = {}) {
  const {
    scalarFields = [],
    m2oFields = {},
    fileFields = {},
    jsonFields = {},
    transform,
  } = opts

  console.log(`\n📦 Migrating: ${pbCollection}`)
  let records
  try {
    records = await pbListAll(pbCollection)
  } catch (e) {
    console.warn(`   ⚠ Skipped (PB error): ${e.message.slice(0, 100)}`)
    stats.skipped++
    return
  }
  console.log(`   ${records.length} records found`)

  let ok = 0, err = 0

  for (const rec of records) {
    try {
      const data = {}

      // Scalar fields
      for (const f of scalarFields) {
        if (rec[f] !== undefined && rec[f] !== '') {
          data[f] = rec[f]
        }
      }

      // JSON fields (arrays, objects)
      for (const f of Object.keys(jsonFields)) {
        if (rec[f] !== undefined && rec[f] !== null && rec[f] !== '') {
          data[f] = rec[f]
        }
      }

      // M2O relations (remap PB ID → Directus ID)
      for (const [field, relatedCollection] of Object.entries(m2oFields)) {
        if (rec[field]) {
          const dirId = getId(relatedCollection, rec[field])
          if (dirId) {
            data[field] = dirId
          }
          // If not found, skip the field (relation target not migrated yet)
        }
      }

      // File fields
      for (const f of Object.keys(fileFields)) {
        if (rec[f]) {
          const url = pbFileUrl(pbCollection, rec.id, rec[f])
          const fileId = await dirUploadFile(url, rec[f])
          if (fileId) data[f] = fileId
        }
      }

      // Custom transform
      if (transform) {
        const patch = transform(rec)
        if (patch) Object.assign(data, patch)
      }

      const created = await dirCreate(dirCollection, data)
      setId(pbCollection, rec.id, created.id)
      ok++
    } catch (e) {
      console.error(`   ✗ ${rec.id}: ${e.message.slice(0, 120)}`)
      err++
    }
  }

  console.log(`   ✓ ${ok} migrated, ${err} errors`)
  stats.migrated += ok
  stats.errors += err
}

/**
 * Migrate M2M relations via junction table inserts.
 * PB stores M2M as arrays of IDs on the record itself.
 */
async function migrateM2M(pbCollection, dirCollection, field, relatedCollection, junction) {
  console.log(`\n🔗 M2M: ${dirCollection}.${field} → ${relatedCollection} via ${junction}`)
  let records
  try {
    records = await pbListAll(pbCollection)
  } catch (e) {
    console.warn(`   ⚠ Skipped M2M (PB error): ${e.message.slice(0, 100)}`)
    return
  }

  let ok = 0, err = 0

  for (const rec of records) {
    const ids = rec[field]
    if (!Array.isArray(ids) || ids.length === 0) continue

    const parentId = getId(pbCollection, rec.id)
    if (!parentId) continue

    for (const relId of ids) {
      const childId = getId(relatedCollection, relId)
      if (!childId) continue

      try {
        await dirCreate(junction, {
          [`${dirCollection}_id`]: parentId,
          [`${relatedCollection}_id`]: childId,
        })
        ok++
      } catch (e) {
        // Ignore duplicates
        if (!e.message.includes('unique') && !e.message.includes('duplicate')) {
          console.error(`   ✗ junction ${parentId}↔${childId}: ${e.message.slice(0, 80)}`)
          err++
        }
      }
    }
  }

  console.log(`   ✓ ${ok} links, ${err} errors`)
}

// ── Collection definitions ──────────────────────────────────────────
// Order matters: parent collections first, then children that reference them.

async function main() {
  console.log('🚀 KSCW PocketBase → Directus Migration\n')
  console.log(`   PB:  ${PB_URL}`)
  console.log(`   Dir: ${DIRECTUS_URL}\n`)

  await pbAuth()
  await dirAuth()

  // ── Phase 1: Independent collections (no FK dependencies) ────────

  await migrateCollection('halls', 'halls', {
    scalarFields: ['name', 'address', 'city', 'courts', 'notes', 'maps_url', 'sv_hall_id'],
    jsonFields: {},
    m2oFields: {},
    fileFields: {},
    transform: (r) => ({ homologation: !!r.homologation }),
  })

  await migrateCollection('sponsors', 'sponsors', {
    scalarFields: ['name', 'website_url', 'sort_order', 'active', 'team_page_only'],
    fileFields: { logo: true },
  })

  await migrateCollection('teams', 'teams', {
    scalarFields: [
      'name', 'full_name', 'team_id', 'sport', 'league', 'season',
      'color', 'active', 'team_picture_pos', 'social_url', 'bb_source_id',
    ],
    fileFields: { team_picture: true },
    jsonFields: { features_enabled: true },
  })

  await migrateCollection('members', 'members', {
    scalarFields: [
      'email', 'first_name', 'last_name', 'phone', 'license_nr', 'number',
      'kscw_membership_active', 'birthdate', 'yob', 'coach_approved_team',
      'language', 'hide_phone', 'birthdate_visibility', 'website_visible',
      'wiedisync_active', 'shell', 'shell_expires', 'shell_reminder_sent',
    ],
    fileFields: { photo: true },
    jsonFields: { position: true, role: true, licences: true },
  })

  // ── Phase 2: Collections with FK to Phase 1 ─────────────────────

  await migrateCollection('member_teams', 'member_teams', {
    scalarFields: ['season', 'guest_level'],
    m2oFields: { member: 'members', team: 'teams' },
  })

  await migrateCollection('team_invites', 'team_invites', {
    scalarFields: ['token', 'guest_level', 'status', 'expires_at'],
    m2oFields: { team: 'teams', invited_by: 'members', claimed_by: 'members' },
  })

  await migrateCollection('hall_slots', 'hall_slots', {
    scalarFields: [
      'day_of_week', 'start_time', 'end_time', 'slot_type', 'recurring',
      'valid_from', 'valid_until', 'indefinite', 'label', 'notes', 'sport',
    ],
    m2oFields: { hall: 'halls' },
    // team is M2M in PB (multi-relation) but M2O in Directus schema — handle first element
    transform: (r) => {
      // hall_slots.team is multi-relation in PB (array), take first for M2O
      if (Array.isArray(r.team) && r.team.length > 0) {
        const dirId = getId('teams', r.team[0])
        if (dirId) return { team: dirId }
      }
      return {}
    },
  })

  await migrateCollection('hall_closures', 'hall_closures', {
    scalarFields: ['start_date', 'end_date', 'reason', 'source'],
    m2oFields: { hall: 'halls' },
  })

  await migrateCollection('games', 'games', {
    scalarFields: [
      'game_id', 'home_team', 'away_team', 'date', 'time', 'league', 'round',
      'season', 'type', 'status', 'home_score', 'away_score',
      'scorer_team', 'scorer_person', 'scoreboard_team', 'scoreboard_person',
      'duty_confirmed', 'source', 'respond_by', 'min_participants',
    ],
    m2oFields: {
      kscw_team: 'teams',
      hall: 'halls',
      scorer_member: 'members',
      scoreboard_member: 'members',
      scorer_scoreboard_member: 'members',
      scorer_duty_team: 'teams',
      scoreboard_duty_team: 'teams',
      scorer_scoreboard_duty_team: 'teams',
      bb_scorer_member: 'members',
      bb_timekeeper_member: 'members',
      bb_24s_official: 'members',
      bb_duty_team: 'teams',
      bb_scorer_duty_team: 'teams',
      bb_timekeeper_duty_team: 'teams',
      bb_24s_duty_team: 'teams',
    },
    jsonFields: { away_hall_json: true, sets_json: true, referees_json: true },
  })

  await migrateCollection('trainings', 'trainings', {
    scalarFields: [
      'date', 'start_time', 'end_time', 'hall_name', 'notes', 'cancelled',
      'cancel_reason', 'respond_by', 'min_participants', 'max_participants',
      'require_note_if_absent', 'auto_cancel_on_min',
    ],
    m2oFields: {
      team: 'teams',
      hall_slot: 'hall_slots',
      hall: 'halls',
      coach: 'members',
    },
  })

  await migrateCollection('events', 'events', {
    scalarFields: [
      'title', 'description', 'event_type', 'start_date', 'end_date', 'all_day',
      'location', 'respond_by', 'max_players', 'min_participants',
      'participation_mode', 'require_note_if_absent',
    ],
    m2oFields: { hall: 'halls', created_by: 'members' },
    jsonFields: { features_enabled: true },
    // teams is M2M — handled separately
  })

  await migrateCollection('rankings', 'rankings', {
    scalarFields: [
      'team_id', 'team_name', 'league', 'rank', 'played', 'won', 'lost',
      'wins_clear', 'wins_narrow', 'defeats_clear', 'defeats_narrow',
      'sets_won', 'sets_lost', 'points_won', 'points_lost', 'points',
      'season', 'updated_at',
    ],
    m2oFields: { team: 'teams' },
  })

  await migrateCollection('participations', 'participations', {
    scalarFields: [
      'activity_type', 'activity_id', 'status', 'note', 'session_id',
      'guest_count', 'is_staff', 'waitlisted_at',
    ],
    m2oFields: { member: 'members' },
  })

  await migrateCollection('absences', 'absences', {
    scalarFields: [
      'start_date', 'end_date', 'reason', 'reason_detail', 'type', 'indefinite',
    ],
    m2oFields: { member: 'members' },
    jsonFields: { affects: true, days_of_week: true },
  })

  await migrateCollection('slot_claims', 'slot_claims', {
    scalarFields: [
      'date', 'start_time', 'end_time', 'freed_reason', 'freed_source_id',
      'notes', 'status',
    ],
    m2oFields: {
      hall_slot: 'hall_slots',
      hall: 'halls',
      claimed_by_team: 'teams',
      claimed_by_member: 'members',
    },
  })

  await migrateCollection('hall_events', 'hall_events', {
    scalarFields: ['uid', 'title', 'date', 'start_time', 'end_time', 'location', 'all_day', 'source'],
    // hall is multi-relation in PB but not handled as M2M in Directus schema — skip for now
  })

  await migrateCollection('scorer_delegations', 'scorer_delegations', {
    scalarFields: ['role', 'same_team', 'status'],
    m2oFields: {
      game: 'games',
      from_member: 'members',
      to_member: 'members',
      from_team: 'teams',
      to_team: 'teams',
    },
  })

  await migrateCollection('referee_expenses', 'referee_expenses', {
    scalarFields: ['paid_by_other', 'amount', 'notes'],
    m2oFields: {
      game: 'games',
      team: 'teams',
      paid_by_member: 'members',
      recorded_by: 'members',
    },
  })

  // ── Phase 3: Notifications & logging ────────────────────────────

  await migrateCollection('notifications', 'notifications', {
    scalarFields: ['type', 'title', 'body', 'activity_type', 'activity_id', 'read'],
    m2oFields: { member: 'members', team: 'teams' },
  })

  await migrateCollection('user_logs', 'user_logs', {
    scalarFields: ['action', 'collection_name', 'record_id'],
    m2oFields: { user: 'members' },
    jsonFields: { data: true },
  })

  await migrateCollection('push_subscriptions', 'push_subscriptions', {
    scalarFields: ['endpoint', 'keys_p256dh', 'keys_auth'],
    m2oFields: { member: 'members' },
  })

  await migrateCollection('email_verifications', 'email_verifications', {
    scalarFields: ['email', 'token', 'expires_at', 'used_at'],
  })

  await migrateCollection('app_settings', 'app_settings', {
    scalarFields: ['key', 'enabled'],
  })

  // ── Phase 4: Game scheduling ───────────────────────────────────

  await migrateCollection('game_scheduling_seasons', 'game_scheduling_seasons', {
    scalarFields: ['season', 'status', 'notes'],
    jsonFields: { spielsamstage: true, team_slot_config: true },
  })

  await migrateCollection('game_scheduling_opponents', 'game_scheduling_opponents', {
    scalarFields: ['season', 'club_name', 'contact_name', 'contact_email', 'token'],
    m2oFields: {
      kscw_team: 'teams',
      home_game: 'games',
      away_game: 'games',
    },
  })

  await migrateCollection('game_scheduling_slots', 'game_scheduling_slots', {
    scalarFields: ['season', 'date', 'start_time', 'end_time', 'source', 'status'],
    m2oFields: {
      kscw_team: 'teams',
      hall: 'halls',
      booking: 'game_scheduling_bookings', // might not exist yet — will be null
      game: 'games',
    },
  })

  await migrateCollection('game_scheduling_bookings', 'game_scheduling_bookings', {
    scalarFields: [
      'season', 'type', 'proposed_datetime_1', 'proposed_place_1',
      'proposed_datetime_2', 'proposed_place_2', 'proposed_datetime_3',
      'proposed_place_3', 'confirmed_proposal', 'status', 'admin_notes',
    ],
    m2oFields: {
      opponent: 'game_scheduling_opponents',
      game: 'games',
      slot: 'game_scheduling_slots',
    },
  })

  // ── Phase 5: Future feature collections ─────────────────────────

  await migrateCollection('event_sessions', 'event_sessions', {
    scalarFields: ['date', 'start_time', 'end_time', 'label', 'sort_order'],
    m2oFields: { event: 'events' },
  })

  await migrateCollection('tasks', 'tasks', {
    scalarFields: ['activity_type', 'activity_id', 'label', 'category', 'completed', 'completed_at', 'sort_order'],
    m2oFields: { assigned_to: 'members', claimed_by: 'members', created_by: 'members' },
  })

  await migrateCollection('task_templates', 'task_templates', {
    scalarFields: ['name'],
    m2oFields: { team: 'teams', created_by: 'members' },
    jsonFields: { tasks_json: true },
  })

  await migrateCollection('carpools', 'carpools', {
    scalarFields: ['seats_available', 'departure_time', 'departure_location', 'notes', 'status'],
    m2oFields: { game: 'games', driver: 'members' },
  })

  await migrateCollection('carpool_passengers', 'carpool_passengers', {
    scalarFields: ['status'],
    m2oFields: { carpool: 'carpools', passenger: 'members' },
  })

  await migrateCollection('polls', 'polls', {
    scalarFields: ['question', 'mode', 'deadline', 'status', 'anonymous'],
    m2oFields: { team: 'teams', created_by: 'members' },
    jsonFields: { options: true },
  })

  await migrateCollection('poll_votes', 'poll_votes', {
    m2oFields: { poll: 'polls', member: 'members' },
    jsonFields: { selected_options: true },
  })

  // ── Phase 6: M2M junction tables ───────────────────────────────

  console.log('\n\n═══ M2M Relations ═══')

  await migrateM2M('teams', 'teams', 'coach', 'members', 'teams_coach')
  await migrateM2M('teams', 'teams', 'captain', 'members', 'teams_captain')
  await migrateM2M('teams', 'teams', 'team_responsible', 'members', 'teams_team_responsible')
  await migrateM2M('teams', 'teams', 'sponsors', 'sponsors', 'teams_sponsors')
  await migrateM2M('events', 'events', 'teams', 'teams', 'events_teams')

  // ── Summary ────────────────────────────────────────────────────

  console.log('\n\n═══════════════════════════════════════')
  console.log('✅ Migration complete!')
  console.log(`   Records migrated: ${stats.migrated}`)
  console.log(`   Files uploaded:   ${stats.files}`)
  console.log(`   Errors:           ${stats.errors}`)
  console.log(`   ID mappings:      ${Object.values(idMap).reduce((s, m) => s + Object.keys(m).length, 0)}`)
  console.log('═══════════════════════════════════════\n')

  // Write ID map for debugging/reference
  await writeFile(
    join(import.meta.dirname || '.', 'id-map.json'),
    JSON.stringify(idMap, null, 2),
  )
  console.log('📄 ID map saved to scripts/id-map.json')
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err)
  process.exit(1)
})
