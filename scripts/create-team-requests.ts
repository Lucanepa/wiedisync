/**
 * Creates the `team_requests` collection in PocketBase.
 *
 * Usage:
 *   PB_URL=https://api.kscw.ch PB_EMAIL=admin@kscw.ch PB_PASSWORD=xxx npx tsx scripts/create-team-requests.ts
 *
 * Or for dev:
 *   PB_URL=https://api-dev.kscw.ch PB_EMAIL=admin@kscw.ch PB_PASSWORD=xxx npx tsx scripts/create-team-requests.ts
 */

import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL ?? 'https://api-dev.kscw.ch'
const PB_EMAIL = process.env.PB_EMAIL ?? 'admin@kscw.ch'
const PB_PASSWORD = process.env.PB_PASSWORD

if (!PB_PASSWORD) {
  console.error('Error: PB_PASSWORD is required')
  process.exit(1)
}

const pb = new PocketBase(PB_URL)
await pb.collection('_superusers').authWithPassword(PB_EMAIL, PB_PASSWORD)
console.log(`Authenticated to ${PB_URL}`)

// Get collection IDs for relations
const members = await pb.collections.getOne('members')
const teams = await pb.collections.getOne('teams')
console.log(`members ID: ${members.id}, teams ID: ${teams.id}`)

// Check if collection already exists
try {
  await pb.collections.getOne('team_requests')
  console.log('Collection "team_requests" already exists — skipping creation.')
  process.exit(0)
} catch {
  // Collection doesn't exist, proceed with creation
}

const collection = await pb.collections.create({
  name: 'team_requests',
  type: 'base',
  fields: [
    {
      name: 'member',
      type: 'relation',
      collectionId: members.id,
      required: true,
      maxSelect: 1,
    },
    {
      name: 'team',
      type: 'relation',
      collectionId: teams.id,
      required: true,
      maxSelect: 1,
    },
    {
      name: 'status',
      type: 'select',
      values: ['pending', 'approved', 'rejected', 'cancelled'],
      required: true,
      maxSelect: 1,
    },
  ],
  indexes: [
    'CREATE INDEX idx_team_requests_member ON team_requests (member)',
    'CREATE INDEX idx_team_requests_team_status ON team_requests (team, status)',
  ],
  listRule: '@request.auth.id = member || @collection.teams.coach ?~ @request.auth.id || @collection.teams.team_responsible ?~ @request.auth.id',
  viewRule: '@request.auth.id = member || @collection.teams.coach ?~ @request.auth.id || @collection.teams.team_responsible ?~ @request.auth.id',
  createRule: '@request.auth.id = member',
  updateRule: '@request.auth.id = member || @collection.teams.coach ?~ @request.auth.id || @collection.teams.team_responsible ?~ @request.auth.id',
  deleteRule: '@request.auth.id = member',
})

console.log(`Created collection "team_requests" (id: ${collection.id})`)
console.log('Done!')
