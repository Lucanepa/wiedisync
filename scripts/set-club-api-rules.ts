/**
 * Set PocketBase API rules for club-scoped access.
 *
 * listRule / viewRule: @request.auth.club = club
 * This ensures users can only see records belonging to their club.
 * Superusers bypass all API rules automatically.
 *
 * Usage: npx tsx scripts/set-club-api-rules.ts
 */

import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL ?? 'https://kscw-api.lucanepa.com'
const PB_EMAIL = process.env.PB_EMAIL ?? 'admin@kscw.ch'
const PB_PASSWORD = process.env.PB_PASSWORD ?? 'thamykscw_1972'

const pb = new PocketBase(PB_URL)
await pb.collection('_superusers').authWithPassword(PB_EMAIL, PB_PASSWORD)
console.log(`Authenticated to ${PB_URL}`)

const CLUB_COLLECTIONS = [
  'halls',
  'teams',
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

// members (auth collection) needs special handling — users must be able to see
// their own record and other members in their club
const CLUB_RULE = '@request.auth.club = club'

console.log('\n=== Setting club-scoped API rules ===')

for (const colName of CLUB_COLLECTIONS) {
  try {
    const col = await pb.collections.getOne(colName)

    // Preserve existing rules — only add club scoping if no rule exists
    // or if the existing rule doesn't already include club filtering
    const currentListRule = (col as Record<string, unknown>).listRule as string | null
    const currentViewRule = (col as Record<string, unknown>).viewRule as string | null

    const newListRule = currentListRule
      ? (currentListRule.includes('club') ? currentListRule : `(${currentListRule}) && ${CLUB_RULE}`)
      : CLUB_RULE
    const newViewRule = currentViewRule
      ? (currentViewRule.includes('club') ? currentViewRule : `(${currentViewRule}) && ${CLUB_RULE}`)
      : CLUB_RULE

    await pb.collections.update(col.id, {
      listRule: newListRule,
      viewRule: newViewRule,
    })
    console.log(`  ✓ ${colName}: listRule/viewRule set`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err)
    console.error(`  ✗ ${colName}: ${msg}`)
  }
}

// Handle members (auth) collection separately
try {
  const membersCol = await pb.collections.getOne('members')
  const currentListRule = (membersCol as Record<string, unknown>).listRule as string | null
  const currentViewRule = (membersCol as Record<string, unknown>).viewRule as string | null

  const newListRule = currentListRule
    ? (currentListRule.includes('club') ? currentListRule : `(${currentListRule}) && ${CLUB_RULE}`)
    : CLUB_RULE
  const newViewRule = currentViewRule
    ? (currentViewRule.includes('club') ? currentViewRule : `(${currentViewRule}) && ${CLUB_RULE}`)
    : CLUB_RULE

  await pb.collections.update(membersCol.id, {
    listRule: newListRule,
    viewRule: newViewRule,
  })
  console.log(`  ✓ members: listRule/viewRule set`)
} catch (err) {
  const msg = err instanceof Error ? err.message : JSON.stringify(err)
  console.error(`  ✗ members: ${msg}`)
}

console.log('\n=== API rules set successfully ===')
console.log('Note: Superusers bypass all API rules automatically.')
