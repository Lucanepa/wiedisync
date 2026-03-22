import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL ?? 'https://api-dev.kscw.ch'
const PB_EMAIL = process.env.PB_EMAIL ?? 'admin@kscw.ch'
const PB_PASSWORD = process.env.PB_PASSWORD ?? 'REDACTED_ROTATE_ME'

const pb = new PocketBase(PB_URL)
await pb.collection('_superusers').authWithPassword(PB_EMAIL, PB_PASSWORD)
console.log(`Authenticated to ${PB_URL}`)

// ── helpers ──────────────────────────────────────────────────────────

function text(name: string, opts: Record<string, unknown> = {}) {
  return { name, type: 'text', ...opts }
}
function number(name: string, opts: Record<string, unknown> = {}) {
  return { name, type: 'number', ...opts }
}
function bool(name: string, opts: Record<string, unknown> = {}) {
  return { name, type: 'bool', ...opts }
}
function date(name: string, opts: Record<string, unknown> = {}) {
  return { name, type: 'date', ...opts }
}
function select(name: string, values: string[], opts: Record<string, unknown> = {}) {
  return { name, type: 'select', values, maxSelect: 1, ...opts }
}
function relation(name: string, collectionId: string, opts: Record<string, unknown> = {}) {
  return { name, type: 'relation', collectionId, maxSelect: 1, ...opts }
}

async function getCollectionId(name: string): Promise<string> {
  const col = await pb.collections.getOne(name)
  return col.id
}

// ── Phase 1: Create team_invites collection ───────────────────────────

console.log('\n=== Phase 1: Create team_invites collection ===')

// Check if collection already exists
let teamInvitesExists = false
try {
  await pb.collections.getOne('team_invites')
  teamInvitesExists = true
  console.log('  ⚠ team_invites already exists — skipping creation')
} catch {
  // not found, proceed with creation
}

const teamsId = await getCollectionId('teams')
const membersId = await getCollectionId('members')

if (!teamInvitesExists) {
  const record = await pb.collections.create({
    name: 'team_invites',
    type: 'base',
    fields: [
      text('token', { required: true }),
      relation('team', teamsId, { required: true }),
      relation('invited_by', membersId, { required: true }),
      number('guest_level', { required: true, min: 0, max: 3 }),
      select('status', ['pending', 'claimed', 'expired'], { required: true }),
      relation('claimed_by', membersId),
      date('expires_at', { required: true }),
    ],
  })
  console.log(`  ✓ team_invites created (${record.id})`)
}

// ── Phase 2: Add indexes to team_invites ─────────────────────────────

console.log('\n=== Phase 2: Add indexes to team_invites ===')

const teamInvitesCol = await pb.collections.getOne('team_invites')
await pb.collections.update(teamInvitesCol.id, {
  indexes: [
    'CREATE UNIQUE INDEX idx_team_invites_token ON team_invites (token)',
    'CREATE INDEX idx_team_invites_team_status ON team_invites (team, status)',
    'CREATE INDEX idx_team_invites_status_expires ON team_invites (status, expires_at)',
  ],
})
console.log('  ✓ team_invites indexes added')

// ── Phase 3: Add shell fields to members collection ───────────────────

console.log('\n=== Phase 3: Add shell fields to members collection ===')

const membersCol = await pb.collections.getOne('members')
const existingFieldNames = membersCol.fields.map((f: { name: string }) => f.name)

const shellFields = [
  bool('shell', { default: false }),
  date('shell_expires'),
  bool('shell_reminder_sent', { default: false }),
].filter((f) => {
  if (existingFieldNames.includes(f.name)) {
    console.log(`  ⚠ members.${f.name} already exists — skipping`)
    return false
  }
  return true
})

if (shellFields.length > 0) {
  const patchedFields = [...membersCol.fields, ...shellFields]
  await pb.collections.update(membersCol.id, { fields: patchedFields })
  for (const f of shellFields) {
    console.log(`  ✓ members.${f.name} added`)
  }
} else {
  console.log('  ⚠ All shell fields already exist — skipping update')
}

// ── Phase 4: Add index on members (shell, shell_expires, wiedisync_active) ──

console.log('\n=== Phase 4: Add shell index to members collection ===')

const membersColUpdated = await pb.collections.getOne('members')
const existingIndexes: string[] = membersColUpdated.indexes ?? []
const shellIndexDef = 'CREATE INDEX idx_members_shell ON members (shell, shell_expires, wiedisync_active)'

if (existingIndexes.some((idx: string) => idx.includes('idx_members_shell'))) {
  console.log('  ⚠ idx_members_shell already exists — skipping')
} else {
  await pb.collections.update(membersColUpdated.id, {
    indexes: [...existingIndexes, shellIndexDef],
  })
  console.log('  ✓ members shell index added')
}

console.log('\n=== Setup complete! ===')
