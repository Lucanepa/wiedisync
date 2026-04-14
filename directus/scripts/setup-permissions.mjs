/**
 * KSCW Directus 11 Hybrid Permission Setup
 *
 * Directus 11 model: Roles → Policies → Permissions
 *   1. Ensure roles exist (rename old names if needed)
 *   2. Create/find access policies (one per role tier)
 *   3. Attach policies to roles
 *   4. Create permissions on each policy
 *
 * Roles: Administrator, Superuser (admin_access), Sport Admin, Vorstand, Team Responsible, Member, Public
 *
 * Usage:
 *   DIRECTUS_URL=https://directus-dev.kscw.ch ADMIN_EMAIL=admin@kscw.ch ADMIN_PASSWORD=<password> node directus/scripts/setup-permissions.mjs
 *   # Or with static token:
 *   DIRECTUS_URL=https://directus-dev.kscw.ch DIRECTUS_TOKEN=<token> node directus/scripts/setup-permissions.mjs
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@kscw.ch'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
if (!ADMIN_PASSWORD) { console.error('Missing ADMIN_PASSWORD env var'); process.exit(1) }
const ADMIN_PASSWORD_CLEAN = ADMIN_PASSWORD.replace(/\\!/g, '!')
const STATIC_TOKEN = process.env.DIRECTUS_TOKEN || ''

let token = null
let stats = { ok: 0, err: 0 }

async function auth() {
  if (STATIC_TOKEN) {
    token = STATIC_TOKEN
    // Verify token works
    const res = await fetch(`${DIRECTUS_URL}/server/info`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return
    console.log('  Static token invalid, falling back to password auth...')
  }
  const res = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD_CLEAN }),
  })
  if (!res.ok) {
    throw new Error(`Auth failed: ${res.status} — check ADMIN_EMAIL and ADMIN_PASSWORD`)
  }
  const { data } = await res.json()
  token = data.access_token
}

async function api(method, path, body) {
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  if (!res.ok) {
    if (text.includes('already exists') || text.includes('RECORD_NOT_UNIQUE')) return null
    throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 300)}`)
  }
  return text ? JSON.parse(text).data : null
}

// ── Role Definitions ───��─────────────────────────────────────────

const ROLE_DEFS = [
  { name: 'Administrator', icon: 'shield', description: 'Built-in Directus admin' },
  { name: 'Superuser', icon: 'security', description: 'Full system access (superuser + admin members)' },
  { name: 'Sport Admin', icon: 'sports', description: 'Sport-scoped admin (vb_admin / bb_admin)' },
  { name: 'Vorstand', icon: 'groups', description: 'Board member — read-all access' },
  { name: 'Team Responsible', icon: 'supervisor_account', description: 'Coach or team responsible' },
  { name: 'Member', icon: 'person', description: 'Default authenticated member' },
]

// Old role names → new names
const RENAME_MAP = { Coach: 'Team Responsible', 'Team Responsible': 'Team Responsible', Admin: 'Sport Admin' }

async function ensureRoles() {
  const existing = await api('GET', '/roles?limit=-1')

  for (const def of ROLE_DEFS) {
    const match = existing.find(r => r.name === def.name)
    if (match) {
      await api('PATCH', `/roles/${match.id}`, { icon: def.icon, description: def.description })
      console.log(`  ✓ "${def.name}" exists (${match.id})`)
    } else {
      const oldName = Object.entries(RENAME_MAP).find(([, v]) => v === def.name)?.[0]
      const oldMatch = oldName ? existing.find(r => r.name === oldName) : null
      if (oldMatch) {
        await api('PATCH', `/roles/${oldMatch.id}`, def)
        console.log(`  ✓ "${oldName}" → "${def.name}" (${oldMatch.id})`)
      } else {
        const created = await api('POST', '/roles', def)
        console.log(`  ��� "${def.name}" created (${created.id})`)
      }
    }
  }

  // Return fresh role map
  const roles = await api('GET', '/roles?limit=-1')
  return Object.fromEntries(roles.map(r => [r.name, r.id]))
}

// ── Policy Helpers ──────────���────────────────────────────────────

async function findOrCreatePolicy(name, opts = {}) {
  const existing = await api('GET', '/policies?limit=-1')
  const found = existing.find(p => p.name === name)
  if (found) return found.id

  const policy = await api('POST', '/policies', {
    name,
    icon: opts.icon || 'shield',
    admin_access: opts.admin_access || false,
    app_access: opts.app_access !== false,
  })
  return policy.id
}

async function attachPolicyToRole(roleId, policyId) {
  try {
    await api('POST', '/access', { role: roleId, policy: policyId })
  } catch (e) {
    if (!e.message.includes('RECORD_NOT_UNIQUE')) {
      console.warn(`  ⚠ attach policy: ${e.message.slice(0, 80)}`)
    }
  }
}

// ── Permission Helpers ────────────��──────────────────────────────

async function setPerm(policyId, collection, action, filter = null, fields = null) {
  const body = {
    policy: policyId,
    collection,
    action,
    fields: fields || ['*'],
  }
  if (filter) body.permissions = filter

  try {
    await api('POST', '/permissions', body)
    stats.ok++
  } catch (e) {
    if (e.message.includes('RECORD_NOT_UNIQUE')) {
      stats.ok++
    } else {
      console.error(`    ✗ ${collection}.${action}: ${e.message.slice(0, 120)}`)
      stats.err++
    }
  }
}

async function setPermRead(policyId, collection, filter = null, fields = null) {
  return setPerm(policyId, collection, 'read', filter, fields)
}

async function setPermCRUD(policyId, collection, filter = null) {
  await setPerm(policyId, collection, 'create', filter)
  await setPerm(policyId, collection, 'read', filter)
  await setPerm(policyId, collection, 'update', filter)
  await setPerm(policyId, collection, 'delete', filter)
}

/**
 * Delete all existing permissions for a policy (for idempotent re-runs)
 */
async function clearPolicyPermissions(policyId, policyName) {
  const perms = await api('GET', `/permissions?filter[policy][_eq]=${policyId}&limit=-1`)
  if (!perms || perms.length === 0) return
  for (const p of perms) {
    await api('DELETE', `/permissions/${p.id}`)
  }
  console.log(`  Cleared ${perms.length} old permissions from "${policyName}"`)
}

// ── Filter Shorthands ──────��─────────────────────────────────────

/** member.user = $CURRENT_USER */
const OWN_MEMBER = { member: { user: { _eq: '$CURRENT_USER' } } }

/** user = $CURRENT_USER (members table) */
const OWN_USER = { user: { _eq: '$CURRENT_USER' } }

/** user = $CURRENT_USER (directus_users FK on user_logs) */
const OWN_DU = { user: { _eq: '$CURRENT_USER' } }

/** from_member or to_member is current user */
const OWN_DELEGATION = {
  _or: [
    { from_member: { user: { _eq: '$CURRENT_USER' } } },
    { to_member: { user: { _eq: '$CURRENT_USER' } } },
  ],
}

/** driver = current user */
const OWN_DRIVER = { driver: { user: { _eq: '$CURRENT_USER' } } }

/** passenger = current user */
const OWN_PASSENGER = { passenger: { user: { _eq: '$CURRENT_USER' } } }

/** Fields visible to regular members when reading other members */
const MEMBER_VISIBLE_FIELDS = [
  'id', 'first_name', 'last_name', 'photo', 'number',
  'position', 'licences', 'user',
  'coach_approved_team', 'role', 'language', 'email',
  'requested_team', 'birthdate_visibility', 'hide_phone', 'phone',
  'license_nr', 'sex', 'licence_category', 'licence_activated', 'licence_validated',
]

/** Fields a member can update on their own profile */
const MEMBER_EDITABLE_FIELDS = [
  'first_name', 'last_name', 'phone', 'birthdate', 'email',
  'birthdate_visibility', 'hide_phone', 'photo', 'language',
  'position', 'number', 'licences', 'website_visible',
  'requested_team',
]

/** Public fields for teams */
const PUBLIC_TEAM_FIELDS = [
  'id', 'name', 'full_name', 'sport', 'league', 'season', 'team_picture',
  'team_picture_pos', 'active', 'social_url', 'color', 'coach', 'captain',
  'team_responsible', 'sponsors',
]

/** Public fields for games */
const PUBLIC_GAME_FIELDS = [
  'id', 'date', 'time', 'home_team', 'away_team', 'home_score', 'away_score',
  'sets_json', 'league', 'round', 'season', 'kscw_team', 'status', 'source',
  'game_id', 'hall', 'type',
]

// ── Main ──────────────────────────────────��──────────────────────

async function main() {
  console.log(`\n🔐 KSCW Directus 11 Hybrid Permission Setup → ${DIRECTUS_URL}\n`)
  await auth()

  // ── 1. Ensure roles ────────────────────────────────────────────

  console.log('1. Ensuring roles...')
  const roleMap = await ensureRoles()
  console.log('   Roles:', JSON.stringify(roleMap, null, 2))

  // ── 2. Create policies ───────���─────────────────────────────────

  console.log('\n2. Creating policies...')

  // Find built-in public policy
  const allPolicies = await api('GET', '/policies?limit=-1')
  const publicPolicy = allPolicies.find(p => p.name === '$t:public_label')
  const PUBLIC_POLICY = publicPolicy?.id
  console.log(`  Public policy: ${PUBLIC_POLICY || 'NOT FOUND — will create'}`)

  const MEMBER_POLICY = await findOrCreatePolicy('KSCW Member', { icon: 'person', app_access: true })
  const LEADER_POLICY = await findOrCreatePolicy('KSCW Team Responsible', { icon: 'supervisor_account', app_access: true })
  const VORSTAND_POLICY = await findOrCreatePolicy('KSCW Vorstand', { icon: 'groups', app_access: true })
  const SPORT_ADMIN_POLICY = await findOrCreatePolicy('KSCW Sport Admin', { icon: 'sports', app_access: true })
  const ADMIN_POLICY = await findOrCreatePolicy('KSCW Admin', { icon: 'admin_panel_settings', admin_access: true, app_access: true })

  console.log(`  Member policy: ${MEMBER_POLICY}`)
  console.log(`  Team Responsible policy: ${LEADER_POLICY}`)
  console.log(`  Vorstand policy: ${VORSTAND_POLICY}`)
  console.log(`  Sport Admin policy: ${SPORT_ADMIN_POLICY}`)
  console.log(`  Admin policy: ${ADMIN_POLICY}`)

  // ���─ 3. Attach policies to roles ──────���─────────────────────────

  console.log('\n3. Attaching policies to roles...')

  // Member role → member policy
  await attachPolicyToRole(roleMap['Member'], MEMBER_POLICY)

  // Team Responsible → leader + member (inherits member permissions)
  await attachPolicyToRole(roleMap['Team Responsible'], LEADER_POLICY)
  await attachPolicyToRole(roleMap['Team Responsible'], MEMBER_POLICY)

  // Vorstand → vorstand + member
  await attachPolicyToRole(roleMap['Vorstand'], VORSTAND_POLICY)
  await attachPolicyToRole(roleMap['Vorstand'], MEMBER_POLICY)

  // Sport Admin → sport admin + leader + member (full chain)
  await attachPolicyToRole(roleMap['Sport Admin'], SPORT_ADMIN_POLICY)
  await attachPolicyToRole(roleMap['Sport Admin'], LEADER_POLICY)
  await attachPolicyToRole(roleMap['Sport Admin'], MEMBER_POLICY)

  // Superuser → admin policy (admin_access=true bypasses everything, but attach for consistency)
  await attachPolicyToRole(roleMap['Superuser'], ADMIN_POLICY)

  // Administrator → already has admin_access=true built-in
  console.log('  ✓ Done')

  // ── 4. Clear old permissions for idempotent re-run ─────────────

  console.log('\n4. Clearing old permissions...')
  if (PUBLIC_POLICY) await clearPolicyPermissions(PUBLIC_POLICY, 'Public')
  await clearPolicyPermissions(MEMBER_POLICY, 'Member')
  await clearPolicyPermissions(LEADER_POLICY, 'Team Responsible')
  await clearPolicyPermissions(VORSTAND_POLICY, 'Vorstand')
  await clearPolicyPermissions(SPORT_ADMIN_POLICY, 'Sport Admin')
  await clearPolicyPermissions(ADMIN_POLICY, 'Admin')

  // ── 5. Public permissions ──────────────────────────────────────

  if (PUBLIC_POLICY) {
    console.log('\n5. Public (unauthenticated) permissions...')

    await setPermRead(PUBLIC_POLICY, 'teams', { active: { _eq: true } }, PUBLIC_TEAM_FIELDS)
    await setPermRead(PUBLIC_POLICY, 'games', null, PUBLIC_GAME_FIELDS)
    await setPermRead(PUBLIC_POLICY, 'rankings')
    await setPermRead(PUBLIC_POLICY, 'sponsors', { active: { _eq: true } })

    // Junction tables for deep queries (website needs coach names, sponsor logos)
    await setPermRead(PUBLIC_POLICY, 'teams_sponsors')
    await setPermRead(PUBLIC_POLICY, 'teams_coaches')  // coach junction
    await setPermRead(PUBLIC_POLICY, 'members', null, ['id', 'first_name', 'last_name', 'photo'])

    // Calendar: hall slots, closures, hall events, halls
    await setPermRead(PUBLIC_POLICY, 'hall_slots')
    await setPermRead(PUBLIC_POLICY, 'hall_slots_teams')  // M2M junction
    await setPermRead(PUBLIC_POLICY, 'hall_closures')
    await setPermRead(PUBLIC_POLICY, 'hall_events')
    await setPermRead(PUBLIC_POLICY, 'hall_events_halls')  // M2M junction
    await setPermRead(PUBLIC_POLICY, 'halls')

    // Trainings (calendar view)
    await setPermRead(PUBLIC_POLICY, 'trainings')
    await setPermRead(PUBLIC_POLICY, 'slot_claims')  // hall slot claims (read-only)

    // Events (club-wide public events on home/calendar)
    await setPermRead(PUBLIC_POLICY, 'events')
    await setPermRead(PUBLIC_POLICY, 'events_teams')  // M2M junction

    // Participations (game/training RSVP counts visible publicly)
    await setPermRead(PUBLIC_POLICY, 'participations')

    // Feedback — public create (kscw-website form, validated by Turnstile hook)
    await setPerm(PUBLIC_POLICY, 'feedback', 'create', null,
      ['type', 'title', 'description', 'source', 'source_url', 'status', 'name', 'email', 'screenshot'])

    // Files (team photos, logos, feedback screenshots)
    await setPermRead(PUBLIC_POLICY, 'directus_files')
    await setPerm(PUBLIC_POLICY, 'directus_files', 'create')

    console.log(`  ✓ Public permissions set`)
  } else {
    console.log('\n5. ⚠ No public policy found — skipping public permissions')
  }

  // ── 6. Member permissions ──────────────────────────────────────

  console.log('\n6. Member permissions...')

  // Read: teams, games, rankings, sponsors (no filter needed — public-level + more)
  const MEMBER_READ_ALL = [
    'teams', 'games', 'rankings', 'sponsors',
    'trainings', 'events', 'event_sessions', 'events_teams',
    'hall_slots', 'hall_closures', 'hall_events', 'hall_events_halls', 'halls', 'hall_slots_teams',
    'slot_claims', 'news', 'app_settings',
    'referee_expenses', 'carpools', 'carpool_passengers', 'polls',
    // Junctions
    'teams_coaches', 'teams_responsibles', 'teams_sponsors', 'events_teams', 'events_members', 'hall_events_halls',
    // Files
    'directus_files',
  ]
  for (const col of MEMBER_READ_ALL) {
    await setPermRead(MEMBER_POLICY, col)
  }

  // sv_vm_check — own record only, restricted fields (no PII: email, birthday, name, phone)
  const VM_CHECK_FIELDS = [
    'id', 'association_id', 'licence_category', 'licence_activated', 'licence_validated',
    'is_locally_educated', 'is_foreigner', 'federation', 'nationality_code',
    'licence_activation_date', 'licence_validation_date',
  ]
  await setPermRead(MEMBER_POLICY, 'sv_vm_check', null, VM_CHECK_FIELDS)

  // Members — limited fields for other members
  await setPermRead(MEMBER_POLICY, 'members', null, MEMBER_VISIBLE_FIELDS)

  // Members — update own profile (limited fields)
  await setPerm(MEMBER_POLICY, 'members', 'update', OWN_USER, MEMBER_EDITABLE_FIELDS)

  // Participations — read all (needed for roster/warnings), create, update own
  await setPermRead(MEMBER_POLICY, 'participations')
  await setPerm(MEMBER_POLICY, 'participations', 'create')
  await setPerm(MEMBER_POLICY, 'participations', 'update', OWN_MEMBER)

  // Absences — read all (team-wide view), CUD own
  await setPermRead(MEMBER_POLICY, 'absences')
  await setPerm(MEMBER_POLICY, 'absences', 'create')
  await setPerm(MEMBER_POLICY, 'absences', 'update', OWN_MEMBER)
  await setPerm(MEMBER_POLICY, 'absences', 'delete', OWN_MEMBER)

  // Notifications — read/update/delete own
  await setPermRead(MEMBER_POLICY, 'notifications', OWN_MEMBER)
  await setPerm(MEMBER_POLICY, 'notifications', 'update', OWN_MEMBER)
  await setPerm(MEMBER_POLICY, 'notifications', 'delete', OWN_MEMBER)

  // Push subscriptions — CRUD own
  await setPermRead(MEMBER_POLICY, 'push_subscriptions', OWN_MEMBER)
  await setPerm(MEMBER_POLICY, 'push_subscriptions', 'create')
  await setPerm(MEMBER_POLICY, 'push_subscriptions', 'update', OWN_MEMBER)
  await setPerm(MEMBER_POLICY, 'push_subscriptions', 'delete', OWN_MEMBER)

  // Member teams — read own
  await setPermRead(MEMBER_POLICY, 'member_teams')

  // Scorer delegations — read/create/update own
  await setPermRead(MEMBER_POLICY, 'scorer_delegations', OWN_DELEGATION)
  await setPerm(MEMBER_POLICY, 'scorer_delegations', 'create')
  await setPerm(MEMBER_POLICY, 'scorer_delegations', 'update', OWN_DELEGATION)

  // Team invites — read own
  await setPermRead(MEMBER_POLICY, 'team_invites', { member: { user: { _eq: '$CURRENT_USER' } } })

  // User logs — create + read own
  await setPerm(MEMBER_POLICY, 'user_logs', 'create')
  await setPermRead(MEMBER_POLICY, 'user_logs', OWN_DU)

  // Feedback — create + read own
  await setPerm(MEMBER_POLICY, 'feedback', 'create')
  await setPermRead(MEMBER_POLICY, 'feedback')

  // Tasks — read, update assigned
  await setPermRead(MEMBER_POLICY, 'tasks')
  await setPerm(MEMBER_POLICY, 'tasks', 'update', {
    _or: [
      { assigned_to: { user: { _eq: '$CURRENT_USER' } } },
      { claimed_by: { user: { _eq: '$CURRENT_USER' } } },
    ],
  })

  // Carpools — create, update own
  await setPerm(MEMBER_POLICY, 'carpools', 'create')
  await setPerm(MEMBER_POLICY, 'carpools', 'update', OWN_DRIVER)
  await setPerm(MEMBER_POLICY, 'carpool_passengers', 'create')
  await setPerm(MEMBER_POLICY, 'carpool_passengers', 'update', OWN_PASSENGER)

  // Polls — vote
  await setPermRead(MEMBER_POLICY, 'poll_votes', OWN_MEMBER)
  await setPerm(MEMBER_POLICY, 'poll_votes', 'create')
  await setPerm(MEMBER_POLICY, 'poll_votes', 'update', OWN_MEMBER)

  // Team requests — create, read own
  await setPerm(MEMBER_POLICY, 'team_requests', 'create')
  await setPermRead(MEMBER_POLICY, 'team_requests', { member: { user: { _eq: '$CURRENT_USER' } } })

  // Files — create (upload profile pics)
  await setPerm(MEMBER_POLICY, 'directus_files', 'create')

  console.log(`  ✓ Member permissions set`)

  // ── 7. Team Responsible permissions (additive to Member) ────────────

  console.log('\n7. Team Responsible permissions...')

  // Members — read all fields (coaches need email, phone for their team)
  await setPermRead(LEADER_POLICY, 'members')
  // Members — update position + number (coaches assign these in RosterEditor)
  await setPerm(LEADER_POLICY, 'members', 'update', null, ['position', 'number'])

  // Teams — update (own coached/TR teams — filter enforced at API, frontend does team-scope)
  await setPerm(LEADER_POLICY, 'teams', 'update')

  // Games — update (duty assignments, scores)
  await setPerm(LEADER_POLICY, 'games', 'update')

  // Trainings — CRU
  await setPerm(LEADER_POLICY, 'trainings', 'create')
  await setPerm(LEADER_POLICY, 'trainings', 'update')

  // Events — CRU
  await setPerm(LEADER_POLICY, 'events', 'create')
  await setPerm(LEADER_POLICY, 'events', 'update')
  await setPerm(LEADER_POLICY, 'event_sessions', 'create')
  await setPerm(LEADER_POLICY, 'event_sessions', 'update')
  await setPerm(LEADER_POLICY, 'events_teams', 'create')
  await setPerm(LEADER_POLICY, 'events_teams', 'update')
  await setPerm(LEADER_POLICY, 'events_teams', 'delete')

  // Participations — full read + CRU (coach manages team roster)
  await setPermRead(LEADER_POLICY, 'participations')
  await setPerm(LEADER_POLICY, 'participations', 'update') // Override member's own-only

  // Member teams — read all + CRUD
  await setPermRead(LEADER_POLICY, 'member_teams')
  await setPerm(LEADER_POLICY, 'member_teams', 'create')
  await setPerm(LEADER_POLICY, 'member_teams', 'update')
  await setPerm(LEADER_POLICY, 'member_teams', 'delete')

  // Hall slots — CU
  await setPerm(LEADER_POLICY, 'hall_slots', 'create')
  await setPerm(LEADER_POLICY, 'hall_slots', 'update')
  await setPerm(LEADER_POLICY, 'slot_claims', 'update')

  // Team invites — read all + CRUD
  await setPermRead(LEADER_POLICY, 'team_invites')
  await setPerm(LEADER_POLICY, 'team_invites', 'create')
  await setPerm(LEADER_POLICY, 'team_invites', 'update')
  await setPerm(LEADER_POLICY, 'team_invites', 'delete')

  // Scorer delegations — read all
  await setPermRead(LEADER_POLICY, 'scorer_delegations')

  // Referee expenses — CRU
  await setPerm(LEADER_POLICY, 'referee_expenses', 'create')
  await setPerm(LEADER_POLICY, 'referee_expenses', 'update')

  // Tasks — CRUD
  await setPerm(LEADER_POLICY, 'tasks', 'create')
  await setPerm(LEADER_POLICY, 'tasks', 'update')
  await setPerm(LEADER_POLICY, 'tasks', 'delete')

  // Task templates — CRU
  await setPermRead(LEADER_POLICY, 'task_templates')
  await setPerm(LEADER_POLICY, 'task_templates', 'create')
  await setPerm(LEADER_POLICY, 'task_templates', 'update')

  // Polls — CRUD
  await setPerm(LEADER_POLICY, 'polls', 'create')
  await setPerm(LEADER_POLICY, 'polls', 'update')
  await setPerm(LEADER_POLICY, 'polls', 'delete')

  // Team requests — read + update
  await setPermRead(LEADER_POLICY, 'team_requests')
  await setPerm(LEADER_POLICY, 'team_requests', 'update')

  // Absences — read all (team-wide view)
  await setPermRead(LEADER_POLICY, 'absences')

  // Notifications — create (coaches send notifications)
  await setPerm(LEADER_POLICY, 'notifications', 'create')

  // User logs — read all
  await setPermRead(LEADER_POLICY, 'user_logs')

  // Game scheduling — read
  await setPermRead(LEADER_POLICY, 'game_scheduling_seasons')
  await setPermRead(LEADER_POLICY, 'game_scheduling_slots')
  await setPermRead(LEADER_POLICY, 'game_scheduling_opponents')
  await setPermRead(LEADER_POLICY, 'game_scheduling_bookings')

  // Files — create (upload team photos)
  await setPerm(LEADER_POLICY, 'directus_files', 'create')

  console.log(`  ✓ Team Responsible permissions set`)

  // ��─ 8. Vorstand permissions (read-all + member write) ──────────

  console.log('\n8. Vorstand permissions...')

  // Vorstand gets read-all on everything (overrides member's filtered reads)
  const VORSTAND_READ_ALL = [
    'members', 'member_teams', 'participations', 'absences',
    'notifications', 'scorer_delegations', 'team_invites',
    'user_logs', 'feedback', 'tasks', 'task_templates',
    'poll_votes', 'team_requests', 'push_subscriptions',
    'game_scheduling_seasons', 'game_scheduling_slots',
    'game_scheduling_opponents', 'game_scheduling_bookings',
  ]
  for (const col of VORSTAND_READ_ALL) {
    await setPermRead(VORSTAND_POLICY, col)
  }

  console.log(`  ✓ Vorstand permissions set`)

  // ���─ 9. Sport Admin permissions ───��─────────────────────────────

  console.log('\n9. Sport Admin permissions...')

  const ALL_COLLECTIONS = [
    'teams', 'games', 'trainings', 'events', 'event_sessions', 'events_teams',
    'members', 'member_teams', 'participations', 'absences',
    'rankings', 'sponsors', 'teams_sponsors',
    'hall_slots', 'hall_closures', 'hall_events', 'hall_events_halls', 'halls', 'hall_slots_teams',
    'slot_claims', 'notifications', 'feedback', 'scorer_delegations', 'referee_expenses',
    'team_invites', 'news', 'app_settings', 'user_logs',
    'push_subscriptions', 'email_verifications',
    'teams_coaches', 'teams_responsibles', 'events_members',
    'volley_feedback',
    'tasks', 'task_templates', 'carpools', 'carpool_passengers',
    'polls', 'poll_votes', 'team_requests', 'registrations',
    'game_scheduling_seasons', 'game_scheduling_slots',
    'game_scheduling_opponents', 'game_scheduling_bookings',
    'query_templates', 'sv_vm_check',
    'directus_files',
  ]

  for (const col of ALL_COLLECTIONS) {
    await setPermCRUD(SPORT_ADMIN_POLICY, col)
  }

  console.log(`  ✓ Sport Admin permissions set`)

  // ── 10. Admin policy (admin_access=true — bypasses all) ────────

  console.log('\n10. Admin/Superuser — admin_access=true, bypasses all permissions')

  // ── Summary ──────���─────────────────────────────────────────────

  console.log(`\n${'═'.repeat(50)}`)
  console.log(`✅ Permission setup complete!`)
  console.log(`   ${stats.ok} permissions granted`)
  console.log(`   ${stats.err} errors`)
  console.log(`${'═'.repeat(50)}`)
  console.log(`\nRoles: ${Object.keys(roleMap).join(', ')}`)
  console.log(`Admin/Superuser: admin_access=true → bypass all permissions`)
  console.log(`Public: permissions on null-role policy "$t:public_label"\n`)
}

main().catch(err => {
  console.error('💥 Fatal error:', err)
  process.exit(1)
})
