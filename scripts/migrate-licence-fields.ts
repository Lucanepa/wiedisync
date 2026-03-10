/**
 * Migrate licences field values: "scorer" → "scorer_vb"
 * Also handles scorer_licence (boolean) → licences (select multi) if needed.
 *
 * The PB `licences` select field should already exist with values:
 *   scorer_vb, referee_vb, otr1_bb, otr2_bb, referee_bb
 *
 * This script:
 * 1. Finds members with licences containing "scorer" (old value)
 * 2. Replaces "scorer" with "scorer_vb"
 * 3. Also finds members with scorer_licence=true but no licences set
 *
 * Usage:
 *   DRY_RUN=1 npx tsx scripts/migrate-licence-fields.ts   # preview
 *   npx tsx scripts/migrate-licence-fields.ts              # write
 */

import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL || 'https://kscw-api.lucanepa.com'
const PB_EMAIL = process.env.PB_EMAIL || ''
const PB_PASSWORD = process.env.PB_PASSWORD || ''
const DRY_RUN = !!process.env.DRY_RUN

async function main() {
  const pb = new PocketBase(PB_URL)
  await pb.admins.authWithPassword(PB_EMAIL, PB_PASSWORD)
  console.log(`Authenticated as admin. DRY_RUN=${DRY_RUN}`)

  // Fetch all members
  const members = await pb.collection('members').getFullList({
    fields: 'id,first_name,last_name,licences',
  })

  console.log(`Total members: ${members.length}`)

  let updated = 0
  for (const m of members) {
    const currentLicences: string[] = m.licences ?? []
    if (currentLicences.length === 0) continue

    // Replace "scorer" → "scorer_vb"
    const hasOldScorer = currentLicences.includes('scorer')
    if (!hasOldScorer) continue

    const nextLicences = currentLicences
      .map((l) => l === 'scorer' ? 'scorer_vb' : l)
      .filter((l, i, arr) => arr.indexOf(l) === i) // dedupe

    console.log(`  ${DRY_RUN ? 'WOULD UPDATE' : 'UPDATE'} ${m.first_name} ${m.last_name} (${m.id}): [${currentLicences.join(',')}] → [${nextLicences.join(',')}]`)

    if (!DRY_RUN) {
      await pb.collection('members').update(m.id, { licences: nextLicences })
    }
    updated++
  }

  console.log(`\nDone. ${DRY_RUN ? 'Would update' : 'Updated'} ${updated} members.`)
  console.log('\nReminder: Update the PB licences select field values to: scorer_vb, referee_vb, otr1_bb, otr2_bb, referee_bb')
  console.log('Reminder: Delete the scorer_licence boolean field after verifying.')
}

main().catch(console.error)
