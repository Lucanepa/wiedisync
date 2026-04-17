/**
 * 005 — Add `announcements` collection (Vereinsnews)
 *
 * Adds a new collection for in-app member-facing announcements that show up
 * in the unified News card on the homepage alongside notifications.
 *
 * Idempotent: safe to re-run. Skips creation when collection/field/relation
 * already exists.
 *
 *   DIRECTUS_URL=https://directus-dev.kscw.ch \
 *   ADMIN_EMAIL=admin@kscw.ch \
 *   ADMIN_PASSWORD=<password> \
 *   node directus/scripts/005-add-announcements.mjs
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@kscw.ch'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const STATIC_TOKEN = process.env.DIRECTUS_TOKEN || ''
if (!ADMIN_PASSWORD && !STATIC_TOKEN) { console.error('Missing ADMIN_PASSWORD or DIRECTUS_TOKEN env var'); process.exit(1) }

let token = null

async function auth() {
  if (STATIC_TOKEN) {
    token = STATIC_TOKEN
    const res = await fetch(`${DIRECTUS_URL}/server/info`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) return
    console.log('  Static token invalid, falling back to password auth...')
  }
  const res = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: (ADMIN_PASSWORD || '').replace(/\\!/g, '!') }),
  })
  if (!res.ok) throw new Error(`Auth failed: ${res.status} ${await res.text()}`)
  const { data } = await res.json()
  token = data.access_token
}

async function api(method, path, body) {
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  if (!res.ok) {
    if (text.includes('already exists') || text.includes('RECORD_NOT_UNIQUE') || text.includes('FIELD_ALREADY_EXISTS')) {
      return null
    }
    throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 300)}`)
  }
  return text ? JSON.parse(text) : null
}

async function createCollection(collection, meta) {
  process.stdout.write(`📦 Collection ${collection}: `)
  const res = await api('POST', '/collections', { collection, schema: {}, meta: { icon: 'box', ...meta } })
  console.log(res ? '✓ created' : '⤳ exists')
}

async function createField(collection, field) {
  process.stdout.write(`  + ${field.field}: `)
  const res = await api('POST', `/fields/${collection}`, field)
  console.log(res ? '✓' : '⤳ exists')
}

async function createRelation(collection, field, relatedCollection) {
  process.stdout.write(`🔗 ${collection}.${field} → ${relatedCollection}: `)
  const res = await api('POST', '/relations', {
    collection,
    field,
    related_collection: relatedCollection,
    meta: { one_field: null, sort_field: null, one_deselect_action: 'nullify' },
    schema: { on_delete: 'SET NULL' },
  })
  console.log(res ? '✓' : '⤳ exists')
}

// ── Field builders (mirroring setup-schema.mjs conventions) ──

const string = (field, opts = {}) => ({
  field, type: 'string',
  schema: { max_length: 255, is_nullable: true, ...opts.schema },
  meta: { interface: 'input', ...opts.meta },
})

const boolean = (field, opts = {}) => ({
  field, type: 'boolean',
  schema: { default_value: opts.default ?? false, is_nullable: false, ...opts.schema },
  meta: { interface: 'boolean', ...opts.meta },
})

const datetime = (field, opts = {}) => ({
  field, type: 'timestamp',
  schema: { is_nullable: true, ...opts.schema },
  meta: { interface: 'datetime', ...opts.meta },
})

const json = (field, opts = {}) => ({
  field, type: 'json',
  schema: { is_nullable: true, ...opts.schema },
  meta: { interface: 'input-code', options: { language: 'json' }, ...opts.meta },
})

const select = (field, choices, opts = {}) => ({
  field, type: 'string',
  schema: { max_length: 255, is_nullable: true, default_value: opts.default ?? null, ...opts.schema },
  meta: {
    interface: 'select-dropdown',
    options: { choices: choices.map(c => ({ text: c, value: c })) },
    ...opts.meta,
  },
})

const file = (field, opts = {}) => ({
  field, type: 'uuid',
  schema: { is_nullable: true, ...opts.schema },
  meta: { interface: 'file-image', special: ['file'], ...opts.meta },
})

const m2oInt = (field, opts = {}) => ({
  field, type: 'integer',
  schema: { is_nullable: true, ...opts.schema },
  meta: { interface: 'select-dropdown-m2o', special: ['m2o'], ...opts.meta },
})

// ── Schema ──────────────────────────────────────────────────────

async function main() {
  console.log(`\n📰 Announcements migration → ${DIRECTUS_URL}\n`)
  await auth()

  await createCollection('announcements', {
    icon: 'campaign',
    color: '#FFC832',
    note: 'Member-facing announcements (Vereinsnews) — appear in homepage News card',
    sort_field: 'pinned',
    archive_field: null,
  })

  // Fields
  await createField('announcements', file('image', { meta: { note: 'Optional hero image (auto-shown as thumb in feed)' } }))
  await createField('announcements', string('link', { meta: { note: 'Optional CTA link (https://… or /path)' } }))
  await createField('announcements', boolean('pinned', { default: false, meta: { note: 'Sticks to top of feed' } }))
  await createField('announcements', datetime('published_at', { meta: { note: 'Set to publish; null = draft' } }))
  await createField('announcements', datetime('expires_at', { meta: { note: 'Optional auto-hide' } }))
  await createField('announcements', select('audience_type', ['all', 'sport', 'teams', 'roles'], { default: 'all' }))
  await createField('announcements', select('audience_sport', ['volleyball', 'basketball'], {
    meta: { conditions: [{ rule: { audience_type: { _eq: 'sport' } }, hidden: false }, { rule: { audience_type: { _neq: 'sport' } }, hidden: true }] },
  }))
  await createField('announcements', json('audience_teams', { meta: { note: 'team IDs (future use, hidden in v1 admin UI)', hidden: true } }))
  await createField('announcements', json('audience_roles', { meta: { note: 'role names (future use, hidden in v1 admin UI)', hidden: true } }))
  await createField('announcements', boolean('notify_push', { default: false, meta: { note: 'Also send web push on publish' } }))
  await createField('announcements', boolean('notify_email', { default: false, meta: { note: 'Also send email on publish' } }))
  await createField('announcements', json('translations', {
    schema: { default_value: '{}' },
    meta: { note: 'Per-locale title + body HTML: { de: { title, body }, en: {...}, ... }' },
  }))
  await createField('announcements', m2oInt('created_by', { meta: { note: 'Autofilled to current member', readonly: true } }))
  await createField('announcements', datetime('fanout_sent_at', { meta: { note: 'Set by hook after push/email fanout — prevents duplicate sends on edit', readonly: true, hidden: true } }))

  // Standard Directus system fields (every other KSCW collection has these;
  // admin list sorts drafts by -date_created when published_at is null).
  await createField('announcements', {
    field: 'date_created',
    type: 'timestamp',
    schema: { is_nullable: true },
    meta: {
      special: ['date-created'],
      interface: 'datetime',
      readonly: true,
      hidden: true,
      width: 'half',
      display: 'datetime',
      display_options: { relative: true },
    },
  })
  await createField('announcements', {
    field: 'date_updated',
    type: 'timestamp',
    schema: { is_nullable: true },
    meta: {
      special: ['date-updated'],
      interface: 'datetime',
      readonly: true,
      hidden: true,
      width: 'half',
      display: 'datetime',
      display_options: { relative: true },
    },
  })

  // Relations
  await createRelation('announcements', 'image', 'directus_files')
  await createRelation('announcements', 'created_by', 'members')

  console.log('\n✅ Announcements migration complete\n')
  console.log('Next steps:')
  console.log('  1. Re-run setup-permissions.mjs to grant member read + admin/sport-admin CRUD')
  console.log('  2. Deploy hooks: npm run ext:deploy:dev (or :prod)\n')
}

main().catch(err => {
  console.error('💥 Fatal error:', err.message)
  process.exit(1)
})
