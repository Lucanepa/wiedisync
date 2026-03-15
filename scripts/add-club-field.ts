/**
 * Migration script: Add multi-club support
 *
 * 1. Creates `clubs` collection
 * 2. Seeds KSC Wiedikon record
 * 3. Adds `club` relation field to all domain collections
 * 4. Backfills existing records with KSCW club ID
 *
 * Usage: npx tsx scripts/add-club-field.ts
 */

import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL ?? 'https://kscw-api.lucanepa.com'
const PB_EMAIL = process.env.PB_EMAIL ?? 'admin@kscw.ch'
const PB_PASSWORD = process.env.PB_PASSWORD ?? 'thamykscw_1972'

const pb = new PocketBase(PB_URL)
await pb.collection('_superusers').authWithPassword(PB_EMAIL, PB_PASSWORD)
console.log(`Authenticated to ${PB_URL}`)

// Collections that should have a `club` field
const CLUB_COLLECTIONS = [
  'halls',
  'teams',
  'members',
  'member_teams',
  'hall_slots',
  'hall_closures',
  'games',
  'rankings',
  'trainings',
  'absences',
  'events',
  'event_sessions',
  'participations',
  'slot_claims',
  'scorer_delegations',
  'game_scheduling_seasons',
  'game_scheduling_slots',
  'game_scheduling_opponents',
  'game_scheduling_bookings',
]

// ── Step 1: Create `clubs` collection ────────────────────────────────

console.log('\n=== Step 1: Create clubs collection ===')

let clubsCol: { id: string }
try {
  clubsCol = await pb.collections.getOne('clubs')
  console.log(`  ✓ clubs collection already exists (${clubsCol.id})`)
} catch {
  clubsCol = await pb.collections.create({
    name: 'clubs',
    type: 'base',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'slug', type: 'text', required: true },
      { name: 'logo', type: 'file', maxSelect: 1, maxSize: 5242880, mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'] },
      { name: 'color_primary', type: 'text' },
      { name: 'color_secondary', type: 'text' },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_clubs_slug ON clubs (slug)',
    ],
  })
  console.log(`  ✓ clubs collection created (${clubsCol.id})`)
}

const clubsId = clubsCol.id

// ── Step 2: Seed KSC Wiedikon record ─────────────────────────────────

console.log('\n=== Step 2: Seed KSC Wiedikon record ===')

let kscwRecord: { id: string }
try {
  const existing = await pb.collection('clubs').getFullList({ filter: 'slug="kscw"' })
  if (existing.length > 0) {
    kscwRecord = existing[0]
    console.log(`  ✓ KSC Wiedikon record already exists (${kscwRecord.id})`)
  } else {
    kscwRecord = await pb.collection('clubs').create({
      name: 'KSC Wiedikon',
      slug: 'kscw',
      color_primary: '#4A55A2',
      color_secondary: '#FFC832',
    })
    console.log(`  ✓ KSC Wiedikon record created (${kscwRecord.id})`)
  }
} catch (err) {
  console.error('  ✗ Failed to seed KSC Wiedikon:', err)
  process.exit(1)
}

const KSCW_CLUB_ID = kscwRecord.id
console.log(`  KSCW Club ID: ${KSCW_CLUB_ID}`)

// ── Step 3: Add `club` relation field to domain collections ──────────

console.log('\n=== Step 3: Add club field to domain collections ===')

for (const colName of CLUB_COLLECTIONS) {
  try {
    const col = await pb.collections.getOne(colName)
    const fields = col.fields as Array<{ name: string }>

    // Check if club field already exists
    if (fields.some((f) => f.name === 'club')) {
      console.log(`  ✓ ${colName}: club field already exists`)
      continue
    }

    // Add club relation field
    const updatedFields = [
      ...fields,
      {
        name: 'club',
        type: 'relation',
        collectionId: clubsId,
        maxSelect: 1,
        required: false,
      },
    ]

    await pb.collections.update(col.id, { fields: updatedFields })
    console.log(`  ✓ ${colName}: club field added`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err)
    console.error(`  ✗ ${colName}: ${msg}`)
  }
}

// ── Step 4: Backfill existing records ────────────────────────────────

console.log('\n=== Step 4: Backfill existing records with KSCW club ID ===')

for (const colName of CLUB_COLLECTIONS) {
  try {
    // Get records without a club set
    const records = await pb.collection(colName).getFullList({
      filter: 'club=""',
      fields: 'id',
    })

    if (records.length === 0) {
      console.log(`  ✓ ${colName}: no records to backfill`)
      continue
    }

    // Batch update
    let updated = 0
    for (const record of records) {
      await pb.collection(colName).update(record.id, { club: KSCW_CLUB_ID })
      updated++
    }
    console.log(`  ✓ ${colName}: ${updated} records backfilled`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err)
    console.error(`  ✗ ${colName}: ${msg}`)
  }
}

console.log('\n=== Migration complete! ===')
console.log(`Club ID for KSCW: ${KSCW_CLUB_ID}`)
console.log('Use this ID in club_defaults.pb.js and sync hooks.')
