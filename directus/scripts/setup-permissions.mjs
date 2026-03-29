/**
 * KSCW Directus 11 Permissions Setup
 *
 * Directus 11 model: Roles → Policies → Permissions
 *   1. Create access policies (one per role)
 *   2. Attach policies to roles
 *   3. Create permissions on each policy
 *
 * Run with: node scripts/setup-permissions.mjs
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@kscw.ch'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'REDACTED_ADMIN_PASSWORD'

let token = null
let stats = { ok: 0, err: 0 }

async function auth() {
  const res = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
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
    throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 200)}`)
  }
  return text ? JSON.parse(text).data : null
}

// ── Create or find a policy ─────────────────────────────────────────

async function findOrCreatePolicy(name, opts = {}) {
  // Check existing
  const existing = await api('GET', '/policies')
  const found = existing.find(p => p.name === name)
  if (found) return found.id

  const policy = await api('POST', '/policies', {
    name,
    icon: opts.icon || 'shield',
    admin_access: opts.admin_access || false,
    app_access: opts.app_access !== false, // default true
  })
  return policy.id
}

// ── Attach policy to role ───────────────────────────────────────────

async function attachPolicyToRole(roleId, policyId) {
  try {
    await api('POST', '/access', {
      role: roleId,
      policy: policyId,
    })
  } catch (e) {
    // May already be attached
    if (!e.message.includes('RECORD_NOT_UNIQUE')) {
      console.warn(`  ⚠ attach policy: ${e.message.slice(0, 80)}`)
    }
  }
}

// ── Create permission on a policy ───────────────────────────────────

async function perm(policyId, collection, action, filter = null) {
  const body = {
    policy: policyId,
    collection,
    action,
    fields: ['*'],
  }
  if (filter) body.permissions = filter

  try {
    await api('POST', '/permissions', body)
    stats.ok++
    return true
  } catch (e) {
    if (e.message.includes('RECORD_NOT_UNIQUE')) {
      stats.ok++
      return true
    }
    console.error(`  ✗ ${collection}.${action}: ${e.message.slice(0, 100)}`)
    stats.err++
    return false
  }
}

async function permRead(policyId, collection, filter = null) {
  return perm(policyId, collection, 'read', filter)
}

async function permCRUD(policyId, collection, filter = null) {
  await perm(policyId, collection, 'create', filter)
  await perm(policyId, collection, 'read', filter)
  await perm(policyId, collection, 'update', filter)
  await perm(policyId, collection, 'delete', filter)
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🔐 KSCW Directus 11 Permissions Setup\n')
  await auth()

  // Get roles
  const roles = await api('GET', '/roles')
  const roleMap = {}
  for (const r of roles) roleMap[r.name] = r.id
  console.log('Roles:', Object.keys(roleMap).join(', '))

  const MEMBER_ROLE = roleMap['Member']
  const COACH_ROLE = roleMap['Coach']
  const ADMIN_ROLE = roleMap['Admin']

  if (!MEMBER_ROLE || !COACH_ROLE || !ADMIN_ROLE) {
    console.error('❌ Missing roles. Run create-users.mjs first.')
    process.exit(1)
  }

  // ── 1. Create policies ──────────────────────────────────────────

  console.log('\n📋 Creating policies...')

  // Find existing public policy
  const allPolicies = await api('GET', '/policies')
  const publicPolicy = allPolicies.find(p => p.name === '$t:public_label')
  const PUBLIC_POLICY = publicPolicy?.id
  console.log(`  Public policy: ${PUBLIC_POLICY || 'NOT FOUND'}`)

  const MEMBER_POLICY = await findOrCreatePolicy('KSCW Member', { icon: 'person', app_access: true })
  console.log(`  Member policy: ${MEMBER_POLICY}`)

  const COACH_POLICY = await findOrCreatePolicy('KSCW Coach', { icon: 'sports', app_access: true })
  console.log(`  Coach policy: ${COACH_POLICY}`)

  const ADMIN_POLICY = await findOrCreatePolicy('KSCW Admin', { icon: 'admin_panel_settings', app_access: true })
  console.log(`  Admin policy: ${ADMIN_POLICY}`)

  // ── 2. Attach policies to roles ─────────────────────────────────

  console.log('\n🔗 Attaching policies to roles...')
  await attachPolicyToRole(MEMBER_ROLE, MEMBER_POLICY)
  await attachPolicyToRole(COACH_ROLE, COACH_POLICY)
  await attachPolicyToRole(COACH_ROLE, MEMBER_POLICY) // Coach inherits member
  await attachPolicyToRole(ADMIN_ROLE, ADMIN_POLICY)
  console.log('  ✓ Done')

  // ── 3. Public permissions ───────────────────────────────────────

  if (PUBLIC_POLICY) {
    console.log('\n📖 Public read...')
    const PUBLIC_READ = [
      'halls', 'hall_closures', 'hall_events', 'teams', 'games', 'events',
      'rankings', 'game_scheduling_seasons', 'game_scheduling_slots', 'sponsors',
      // Junction tables needed for deep queries
      'teams_coach', 'teams_captain', 'teams_team_responsible', 'teams_sponsors', 'events_teams',
    ]
    for (const col of PUBLIC_READ) {
      await permRead(PUBLIC_POLICY, col)
    }
    // Public needs to read files (team photos, logos)
    await permRead(PUBLIC_POLICY, 'directus_files')
    console.log(`  ✓ ${PUBLIC_READ.length + 1} public read permissions`)
  }

  // ── 4. Member permissions ───────────────────────────────────────

  console.log('\n👤 Member permissions...')

  // Read: all public + auth-only collections
  const MEMBER_READ = [
    'halls', 'hall_closures', 'hall_events', 'teams', 'games', 'events',
    'rankings', 'game_scheduling_seasons', 'game_scheduling_slots', 'sponsors',
    'hall_slots', 'slot_claims', 'event_sessions', 'app_settings',
    'members', 'member_teams', 'trainings', 'participations', 'absences',
    'scorer_delegations', 'referee_expenses',
    // Junctions
    'teams_coach', 'teams_captain', 'teams_team_responsible', 'teams_sponsors', 'events_teams',
    // Files
    'directus_files',
  ]
  for (const col of MEMBER_READ) {
    await permRead(MEMBER_POLICY, col)
  }

  // Own profile update
  await perm(MEMBER_POLICY, 'members', 'update', {
    user: { _eq: '$CURRENT_USER' },
  })

  // Own participations: create + update
  await perm(MEMBER_POLICY, 'participations', 'create')
  await perm(MEMBER_POLICY, 'participations', 'update', {
    member: { user: { _eq: '$CURRENT_USER' } },
  })

  // Own absences: CRUD
  await perm(MEMBER_POLICY, 'absences', 'create')
  await perm(MEMBER_POLICY, 'absences', 'update', {
    member: { user: { _eq: '$CURRENT_USER' } },
  })
  await perm(MEMBER_POLICY, 'absences', 'delete', {
    member: { user: { _eq: '$CURRENT_USER' } },
  })

  // Own notifications: read + update (mark read)
  await permRead(MEMBER_POLICY, 'notifications', {
    member: { user: { _eq: '$CURRENT_USER' } },
  })
  await perm(MEMBER_POLICY, 'notifications', 'update', {
    member: { user: { _eq: '$CURRENT_USER' } },
  })

  // Own push subscriptions
  await permRead(MEMBER_POLICY, 'push_subscriptions', {
    member: { user: { _eq: '$CURRENT_USER' } },
  })
  await perm(MEMBER_POLICY, 'push_subscriptions', 'create')
  await perm(MEMBER_POLICY, 'push_subscriptions', 'delete', {
    member: { user: { _eq: '$CURRENT_USER' } },
  })

  // Scorer delegations: create + update (accept/decline)
  await perm(MEMBER_POLICY, 'scorer_delegations', 'create')
  await perm(MEMBER_POLICY, 'scorer_delegations', 'update')

  console.log(`  ✓ Member permissions set`)

  // ── 5. Coach permissions ────────────────────────────────────────

  console.log('\n🏐 Coach permissions...')

  // Coach can read everything member can + user_logs
  await permRead(COACH_POLICY, 'user_logs')

  // Coach CRUD on activities
  await permCRUD(COACH_POLICY, 'trainings')
  await permCRUD(COACH_POLICY, 'events')
  await permCRUD(COACH_POLICY, 'event_sessions')

  // Coach can update games (duty assignments, scores)
  await perm(COACH_POLICY, 'games', 'update')

  // Coach can manage participations
  await permCRUD(COACH_POLICY, 'participations')

  // Coach can manage absences (view team)
  await permCRUD(COACH_POLICY, 'absences')

  // Coach can manage slot claims
  await permCRUD(COACH_POLICY, 'slot_claims')

  // Coach can manage notifications
  await perm(COACH_POLICY, 'notifications', 'create')
  await perm(COACH_POLICY, 'notifications', 'update')

  // Coach can manage scorer delegations + referee expenses
  await permCRUD(COACH_POLICY, 'scorer_delegations')
  await permCRUD(COACH_POLICY, 'referee_expenses')

  // Coach can manage push subscriptions
  await permCRUD(COACH_POLICY, 'push_subscriptions')

  // Coach can upload files
  await perm(COACH_POLICY, 'directus_files', 'create')

  console.log(`  ✓ Coach permissions set`)

  // ── 6. Admin permissions ────────────────────────────────────────

  console.log('\n⚙️ Admin permissions...')

  const ALL_COLLECTIONS = [
    'halls', 'hall_closures', 'hall_events', 'hall_slots', 'teams', 'members',
    'member_teams', 'games', 'trainings', 'events', 'event_sessions', 'rankings',
    'participations', 'absences', 'slot_claims', 'scorer_delegations', 'referee_expenses',
    'notifications', 'user_logs', 'push_subscriptions', 'email_verifications',
    'app_settings', 'sponsors', 'team_invites',
    'game_scheduling_seasons', 'game_scheduling_slots', 'game_scheduling_opponents',
    'game_scheduling_bookings',
    'tasks', 'task_templates', 'carpools', 'carpool_passengers', 'polls', 'poll_votes',
    // Junctions
    'teams_coach', 'teams_captain', 'teams_team_responsible', 'teams_sponsors', 'events_teams',
    'hall_events_halls', 'hall_slots_teams',
    // Files
    'directus_files',
  ]

  for (const col of ALL_COLLECTIONS) {
    await permCRUD(ADMIN_POLICY, col)
  }

  console.log(`  ✓ Admin permissions set`)

  // ── Summary ───────────────────────────────────────────────────────

  console.log(`\n═══════════════════════════════════════`)
  console.log(`✅ Permissions setup complete!`)
  console.log(`   ${stats.ok} permissions granted`)
  console.log(`   ${stats.err} errors`)
  console.log(`═══════════════════════════════════════`)
  console.log(`\nNote: Superuser role has admin_access=true → bypasses all permissions`)
}

main().catch(err => {
  console.error('💥 Fatal error:', err)
  process.exit(1)
})
