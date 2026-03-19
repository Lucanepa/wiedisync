/**
 * Migrate the `licences` field on `members` from JSON → Select (multi).
 *
 * - Backs up all members' licence data before touching the schema
 * - Replaces the JSON field with a select field (preserving values)
 * - Verifies data integrity after migration
 *
 * Usage:
 *   PB_URL=https://api.kscw.ch PB_EMAIL=x PB_PASSWORD=y npx tsx scripts/migrate-licences-to-select.ts
 */

import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL ?? 'https://api-dev.kscw.ch'
const PB_EMAIL = process.env.PB_EMAIL ?? ''
const PB_PASSWORD = process.env.PB_PASSWORD ?? ''

if (!PB_EMAIL || !PB_PASSWORD) {
  console.error('Set PB_EMAIL and PB_PASSWORD env vars')
  process.exit(1)
}

const VALID_LICENCES = ['scorer_vb', 'referee_vb', 'otr1_bb', 'otr2_bb', 'otn_bb', 'referee_bb'] as const

const pb = new PocketBase(PB_URL)
await pb.collection('_superusers').authWithPassword(PB_EMAIL, PB_PASSWORD)
console.log(`Authenticated to ${PB_URL}`)

// ── Step 1: Back up current licence data ────────────────────────────
console.log('\n=== Step 1: Back up licence data ===')
const allMembers = await pb.collection('members').getFullList({ fields: 'id,first_name,last_name,licences' })
const backup = new Map<string, string[]>()
let membersWithLicences = 0

for (const m of allMembers) {
  const licences: string[] = Array.isArray(m.licences) ? m.licences : []
  if (licences.length > 0) {
    backup.set(m.id, licences)
    membersWithLicences++
    console.log(`  ${m.first_name} ${m.last_name}: [${licences.join(', ')}]`)
  }
}
console.log(`  Backed up ${membersWithLicences}/${allMembers.length} members with licences`)

// ── Step 2: Get current collection schema ───────────────────────────
console.log('\n=== Step 2: Fetch members collection schema ===')
const collection = await pb.collections.getOne('members')
const fields = collection.fields as Array<Record<string, unknown>>

const licenceField = fields.find((f) => f.name === 'licences')
if (!licenceField) {
  console.error('No `licences` field found on members collection!')
  process.exit(1)
}
console.log(`  Current licences field type: ${licenceField.type}`)

if (licenceField.type === 'select') {
  console.log('  Already a select field — nothing to migrate!')
  process.exit(0)
}

// ── Step 3: Replace JSON field with Select (multi) ──────────────────
console.log('\n=== Step 3: Update field type to select (multi) ===')
const newFields = fields.map((f) => {
  if (f.name !== 'licences') return f
  return {
    name: 'licences',
    type: 'select',
    values: [...VALID_LICENCES],
    maxSelect: VALID_LICENCES.length,
  }
})

await pb.collections.update(collection.id, { fields: newFields })
console.log('  ✓ Schema updated')

// ── Step 4: Restore data if PB wiped it during conversion ───────────
console.log('\n=== Step 4: Verify & restore data ===')
const afterMembers = await pb.collection('members').getFullList({ fields: 'id,first_name,last_name,licences' })
let restored = 0
let intact = 0

for (const m of afterMembers) {
  const expected = backup.get(m.id)
  if (!expected) continue

  const current: string[] = Array.isArray(m.licences) ? m.licences : []
  const same = expected.length === current.length && expected.every((v) => current.includes(v))

  if (!same) {
    console.log(`  Restoring ${m.first_name} ${m.last_name}: [${expected.join(', ')}]`)
    await pb.collection('members').update(m.id, { licences: expected })
    restored++
  } else {
    intact++
  }
}

console.log(`  ${intact} intact, ${restored} restored`)

// ── Step 5: Final verification ──────────────────────────────────────
console.log('\n=== Step 5: Final verification ===')
const verifyCollection = await pb.collections.getOne('members')
const verifyField = (verifyCollection.fields as Array<Record<string, unknown>>).find((f) => f.name === 'licences')
console.log(`  Field type: ${verifyField?.type}`)
console.log(`  Values: ${JSON.stringify((verifyField as Record<string, unknown>)?.values)}`)

const sample = await pb.collection('members').getFullList({ fields: 'id,first_name,last_name,licences' })
const withLicences = sample.filter((m) => Array.isArray(m.licences) && m.licences.length > 0)
console.log(`  Members with licences: ${withLicences.length} (expected: ${membersWithLicences})`)

if (withLicences.length === membersWithLicences) {
  console.log('\n✓ Migration complete — all data preserved!')
} else {
  console.error('\n✗ Data mismatch — check manually!')
  process.exit(1)
}
