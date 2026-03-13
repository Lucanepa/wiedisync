import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL ?? 'https://kscw-api-dev.lucanepa.com'
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
function date(name: string, opts: Record<string, unknown> = {}) {
  return { name, type: 'date', ...opts }
}
function json(name: string, opts: Record<string, unknown> = {}) {
  return { name, type: 'json', ...opts }
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

interface CollectionDef {
  name: string
  type: 'base'
  fields: Record<string, unknown>[]
  indexes?: string[]
  listRule?: string
  viewRule?: string
  createRule?: string
  updateRule?: string
  deleteRule?: string
}

async function createCollection(def: CollectionDef) {
  try {
    const record = await pb.collections.create({
      name: def.name,
      type: def.type,
      fields: def.fields,
      indexes: def.indexes ?? [],
      listRule: def.listRule ?? null,
      viewRule: def.viewRule ?? null,
      createRule: def.createRule ?? null,
      updateRule: def.updateRule ?? null,
      deleteRule: def.deleteRule ?? null,
    })
    console.log(`  ✓ ${def.name} (${record.id})`)
    return record
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err)
    console.error(`  ✗ ${def.name}: ${msg}`)
    throw err
  }
}

// ── Get existing collection IDs ──────────────────────────────────────

const teamsId = await getCollectionId('teams')
const hallsId = await getCollectionId('halls')
const gamesId = await getCollectionId('games')

console.log(`  teams: ${teamsId}`)
console.log(`  halls: ${hallsId}`)
console.log(`  games: ${gamesId}`)

// ── Phase 1: game_scheduling_seasons (no FK deps on new collections) ─

console.log('\n=== Creating game_scheduling_seasons ===')
await createCollection({
  name: 'game_scheduling_seasons',
  type: 'base',
  fields: [
    text('season', { required: true }),
    select('status', ['setup', 'open', 'closed'], { required: true }),
    json('spielsamstage'),
    json('team_slot_config'),  // Per-team config: which source to use
    text('notes'),
  ],
  listRule: '',   // public read
  viewRule: '',   // public read
  createRule: "@request.auth.role = 'superuser' || @request.auth.role = 'admin'",
  updateRule: "@request.auth.role = 'superuser' || @request.auth.role = 'admin'",
  deleteRule: "@request.auth.role = 'superuser' || @request.auth.role = 'admin'",
})

const seasonsId = await getCollectionId('game_scheduling_seasons')

// ── Phase 2: game_scheduling_opponents (depends on seasons) ──────────

console.log('\n=== Creating game_scheduling_opponents ===')
await createCollection({
  name: 'game_scheduling_opponents',
  type: 'base',
  fields: [
    relation('season', seasonsId, { required: true }),
    text('club_name', { required: true }),
    text('contact_name', { required: true }),
    text('contact_email', { required: true }),
    relation('kscw_team', teamsId, { required: true }),
    text('token', { required: true }),
    relation('home_game', gamesId),
    relation('away_game', gamesId),
  ],
  indexes: [
    'CREATE UNIQUE INDEX idx_opponent_token ON game_scheduling_opponents (token)',
  ],
  listRule: null,   // access via hooks (token-gated)
  viewRule: null,
  createRule: null,  // created via hooks
  updateRule: null,
  deleteRule: null,
})

const opponentsId = await getCollectionId('game_scheduling_opponents')

// ── Phase 3: game_scheduling_bookings (depends on opponents) ─────────

console.log('\n=== Creating game_scheduling_bookings ===')
await createCollection({
  name: 'game_scheduling_bookings',
  type: 'base',
  fields: [
    relation('season', seasonsId, { required: true }),
    relation('opponent', opponentsId, { required: true }),
    select('type', ['home_slot_pick', 'away_proposal'], { required: true }),
    relation('game', gamesId),
    // slot relation added after game_scheduling_slots is created
    text('proposed_datetime_1'),
    text('proposed_place_1'),
    text('proposed_datetime_2'),
    text('proposed_place_2'),
    text('proposed_datetime_3'),
    text('proposed_place_3'),
    number('confirmed_proposal'),
    select('status', ['pending', 'confirmed', 'rejected'], { required: true }),
    text('admin_notes'),
  ],
  listRule: null,
  viewRule: null,
  createRule: null,
  updateRule: null,
  deleteRule: null,
})

const bookingsId = await getCollectionId('game_scheduling_bookings')

// ── Phase 4: game_scheduling_slots (depends on bookings) ─────────────

console.log('\n=== Creating game_scheduling_slots ===')
await createCollection({
  name: 'game_scheduling_slots',
  type: 'base',
  fields: [
    relation('season', seasonsId, { required: true }),
    relation('kscw_team', teamsId),
    date('date', { required: true }),
    text('start_time', { required: true }),
    text('end_time', { required: true }),
    relation('hall', hallsId, { required: true }),
    select('source', ['hall_slot', 'spielsamstag', 'spielhalle', 'manual'], { required: true }),
    select('status', ['available', 'booked', 'blocked'], { required: true }),
    relation('booking', bookingsId),
    relation('game', gamesId),
  ],
  listRule: '',   // public read (opponents browse available slots)
  viewRule: '',
  createRule: null,
  updateRule: null,
  deleteRule: null,
})

const slotsId = await getCollectionId('game_scheduling_slots')

// ── Phase 5: Patch bookings to add slot relation ─────────────────────

console.log('\n=== Patching game_scheduling_bookings: adding slot relation ===')
const bookingsCol = await pb.collections.getOne('game_scheduling_bookings')
const patchedFields = [
  ...bookingsCol.fields,
  relation('slot', slotsId),
]
await pb.collections.update(bookingsCol.id, { fields: patchedFields })
console.log('  ✓ slot relation added to bookings')

console.log('\n=== All game scheduling collections created! ===')
console.log(`  game_scheduling_seasons:  ${seasonsId}`)
console.log(`  game_scheduling_opponents: ${opponentsId}`)
console.log(`  game_scheduling_bookings:  ${bookingsId}`)
console.log(`  game_scheduling_slots:     ${slotsId}`)
