/**
 * KSCW Directus 11 Hybrid Permission Setup
 *
 * SOURCE OF TRUTH (read this before editing):
 *   The numbered SQL migrations in `directus/scripts/0NN-*.sql` are the source
 *   of truth for the LIVE permissions on dev + prod. This file is the
 *   fresh-install snapshot — it must reproduce the same end-state when
 *   bootstrapping a brand-new Directus instance from zero.
 *
 *   When you change permissions:
 *     1. Write a new SQL migration (NN+1) that mutates live perms idempotently.
 *     2. Apply it on dev, then prod.
 *     3. Update this file to match the new end-state. Otherwise the next
 *        run of `setup-permissions.mjs` (during a DR rebuild, fresh dev env,
 *        or onboarding) will silently roll back security hardening.
 *   That bidirectional contract is enforced by reviewers — see PERMISSIONS.md.
 *
 * Reflects state through migration 043 (2026-05-06). Audit history:
 *   023 messaging RBAC scoping        024 PII fields off cross-member read
 *   025 feedback status lock          026 coach team-scoped writes
 *   027 sport admin delete lock       028 auto-action markers
 *   029 messaging self-read fields    030 members.read field gaps
 *   031 spielplaner_assignments       032 trainings team-scoping
 *   033 member-read team-scoping      034 spielplaner_assignments.read
 *   035 second-pass audit             036 third-pass audit
 *   037 junction cascade pass 2       038-039 absence override
 *   040 excluded_guest_levels         041 team-dashboard prefs
 *   042 blocks + spielplaner perms    043 security hardening pass
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

/**
 * user_logs.user is an INTEGER FK to members.id, NOT a UUID FK to
 * directus_users. The naive `{ user: { _eq: '$CURRENT_USER' } }` filter
 * tries to compare an int to the caller's UUID and Postgres throws
 * "Invalid numeric value" (see CHANGELOG v4.4.8). The correct path
 * traverses one more level: user_logs → members → directus_users.
 */
const OWN_DU = { user: { user: { _eq: '$CURRENT_USER' } } }

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

/**
 * Fields visible to regular members when reading OTHER members.
 * Migration 024 explicitly removed `email` + `phone` from this set — they
 * leak across the whole club. Self-read covers them via MEMBER_OWN_READABLE.
 * Migration 030 added `kscw_membership_active`, `shell`, `shell_expires`.
 */
const MEMBER_VISIBLE_FIELDS = [
  'id', 'first_name', 'last_name', 'photo', 'number',
  'position', 'licences', 'user',
  'coach_approved_team', 'role', 'language',
  'requested_team', 'birthdate_visibility', 'hide_phone',
  'license_nr', 'sex', 'licence_category', 'licence_activated', 'licence_validated',
  'kscw_membership_active', 'shell', 'shell_expires',
]

/** Fields a member can update on their own profile */
const MEMBER_EDITABLE_FIELDS = [
  'first_name', 'last_name', 'phone', 'birthdate', 'email',
  'birthdate_visibility', 'hide_phone', 'photo', 'language',
  'position', 'number', 'licences', 'website_visible',
  'requested_team',
  // ClubDesk personal data fields
  'anrede', 'adresse', 'plz', 'ort', 'nationalitaet', 'sex', 'ahv_nummer',
]

/** Public fields for teams */
const PUBLIC_TEAM_FIELDS = [
  'id', 'name', 'full_name', 'sport', 'league', 'season', 'team_picture',
  'team_picture_pos', 'active', 'social_url', 'color', 'coach', 'captain',
  'team_responsible', 'sponsors',
]

/** Coach Dashboard prefs — readable by Coach/Team Responsible/Admin via an explicit read row. NOT added to PUBLIC_TEAM_FIELDS. */
const LEADER_TEAM_DASHBOARD_FIELDS = [
  'dashboard_range_from',
  'dashboard_range_to',
  'dashboard_league_only',
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

    // Calendar: hall slots, closures, hall events, halls.
    // Migration 035 removed `slot_claims` from Public — internal hall booking
    // strategy isn't public. Same migration also removed events/events_teams/
    // participations (every RSVP across the club was anonymously readable).
    // Migration 032 removed `trainings` (per-team schedule, members-only).
    await setPermRead(PUBLIC_POLICY, 'hall_slots')
    await setPermRead(PUBLIC_POLICY, 'hall_slots_teams')  // M2M junction
    await setPermRead(PUBLIC_POLICY, 'hall_closures')
    await setPermRead(PUBLIC_POLICY, 'hall_events')
    await setPermRead(PUBLIC_POLICY, 'hall_events_halls')  // M2M junction
    await setPermRead(PUBLIC_POLICY, 'halls')

    // Feedback — public create (kscw-website form, validated by Turnstile hook)
    await setPerm(PUBLIC_POLICY, 'feedback', 'create', null,
      ['type', 'title', 'description', 'source', 'source_url', 'status', 'name', 'email', 'screenshot'])

    // Mixed tournament signups — public create (kscw-website form, validated by Turnstile hook)
    await setPerm(PUBLIC_POLICY, 'mixed_tournament_signups', 'create', null,
      ['name', 'email', 'sex', 'position_1', 'position_2', 'position_3', 'teams', 'notes', 'is_member', 'member_id'])

    // Files (team photos, logos, feedback screenshots)
    await setPermRead(PUBLIC_POLICY, 'directus_files')
    await setPerm(PUBLIC_POLICY, 'directus_files', 'create')

    console.log(`  ✓ Public permissions set`)
  } else {
    console.log('\n5. ⚠ No public policy found — skipping public permissions')
  }

  // ── 6. Member permissions ──────────────────────────────────────

  console.log('\n6. Member permissions...')

  // ── Unfiltered cross-club reads ─────────────────────────────
  // Truly directory-level info: club-public schedules and venue data.
  // Per migration 036, the M2M junctions (teams_coaches/teams_responsibles/
  // teams_sponsors / member_teams) stay open so the whole-club app can show
  // cross-team rosters. Member-level fields they expose are bounded by the
  // members.read field whitelist below.
  const MEMBER_READ_ALL = [
    'teams', 'games', 'rankings', 'sponsors',
    'event_sessions',
    'hall_slots', 'hall_closures', 'hall_events', 'hall_events_halls', 'halls', 'hall_slots_teams',
    'news', 'app_settings',
    'referee_expenses', 'carpools', 'carpool_passengers', 'polls',
    // Junctions
    'teams_coaches', 'teams_responsibles', 'teams_sponsors', 'events_teams', 'events_members',
    // Files
    'directus_files',
  ]
  for (const col of MEMBER_READ_ALL) {
    await setPermRead(MEMBER_POLICY, col)
  }

  // ── Team-scoped reads (migration 032 / 033) ─────────────────
  // trainings: only my teams. events: own + club-wide + my-teams + invited.
  // participations + absences: own + same-team. polls + referee_expenses
  // already covered above for cross-club but fine — those are team-scoped
  // by app navigation; they don't carry PII.
  const MY_TEAMS_FILTER = { team: { members: { member: { user: { _eq: '$CURRENT_USER' } } } } }
  await setPermRead(MEMBER_POLICY, 'trainings', MY_TEAMS_FILTER)

  const EVENTS_VISIBLE = {
    _or: [
      { created_by: { user: { _eq: '$CURRENT_USER' } } },
      { event_type: { _in: ['verein', 'tournament'] } },
      { teams: { teams_id: { members: { member: { user: { _eq: '$CURRENT_USER' } } } } } },
      { invited_members: { members_id: { user: { _eq: '$CURRENT_USER' } } } },
    ],
  }
  await setPermRead(MEMBER_POLICY, 'events', EVENTS_VISIBLE)

  const SAME_TEAM_AS_ME = {
    _or: [
      { member: { user: { _eq: '$CURRENT_USER' } } },
      { member: { member_teams: { team: { members: { member: { user: { _eq: '$CURRENT_USER' } } } } } } },
    ],
  }
  await setPermRead(MEMBER_POLICY, 'participations', SAME_TEAM_AS_ME)
  await setPermRead(MEMBER_POLICY, 'absences', SAME_TEAM_AS_ME)

  // ── slot_claims — keep open for now (calendar UI relies on it),
  // public read removed in 035; member read still permissive per audit decision.
  await setPermRead(MEMBER_POLICY, 'slot_claims')

  // sv_vm_check — null row filter + narrow field whitelist.
  //
  // ⚠ Open audit finding (2026-05-06): without a row filter, every member
  // can read every member's licence row. The intended fix was a row filter
  // {member: {user: $CURRENT_USER}}, but:
  //   (a) sv_vm_check has no `member` FK column (linked by `email` /
  //       `association_id`), and
  //   (b) Directus 11 generates `CASE WHEN 1 THEN col END` SQL whenever a
  //       row filter is set on this collection, which Postgres 12+ rejects
  //       ("argument of CASE/WHEN must be type boolean, not type integer").
  //
  // Mitigation TODO: build a custom `/kscw/sv-licence/me` endpoint that
  // returns the caller's own row, REVOKE Member's direct sv_vm_check.read,
  // update useLicenceCard to use the endpoint. Tracked in SECURITY.md.
  // For now: 11-field whitelist (no PII surface) keeps the original posture.
  const VM_CHECK_FIELDS = [
    'id', 'association_id', 'licence_category', 'licence_activated', 'licence_validated',
    'is_locally_educated', 'is_foreigner', 'federation', 'nationality_code',
    'licence_activation_date', 'licence_validation_date',
  ]
  await setPermRead(MEMBER_POLICY, 'sv_vm_check', null, VM_CHECK_FIELDS)

  // Members — limited fields for other members. PII (email/phone) excluded
  // (migration 024). Self-read row is added below with editable fields.
  await setPermRead(MEMBER_POLICY, 'members', null, MEMBER_VISIBLE_FIELDS)

  // Members — read own profile with expanded fields (editable fields must be readable)
  const MEMBER_OWN_READABLE = [...new Set([...MEMBER_VISIBLE_FIELDS, ...MEMBER_EDITABLE_FIELDS])]
  await setPermRead(MEMBER_POLICY, 'members', OWN_USER, MEMBER_OWN_READABLE)

  // Members — update own profile (limited fields)
  await setPerm(MEMBER_POLICY, 'members', 'update', OWN_USER, MEMBER_EDITABLE_FIELDS)

  // Participations: read scope set above (SAME_TEAM_AS_ME); CRU below.
  await setPerm(MEMBER_POLICY, 'participations', 'create')
  await setPerm(MEMBER_POLICY, 'participations', 'update', OWN_MEMBER)

  // Absences: read scope set above (SAME_TEAM_AS_ME); CUD below.
  await setPerm(MEMBER_POLICY, 'absences', 'create')
  await setPerm(MEMBER_POLICY, 'absences', 'update', OWN_MEMBER)
  await setPerm(MEMBER_POLICY, 'absences', 'delete', OWN_MEMBER)

  // Notifications — read/update/delete own
  await setPermRead(MEMBER_POLICY, 'notifications', OWN_MEMBER)
  await setPerm(MEMBER_POLICY, 'notifications', 'update', OWN_MEMBER)
  await setPerm(MEMBER_POLICY, 'notifications', 'delete', OWN_MEMBER)

  // Announcements (Vereinsnews) — read only published, non-expired posts.
  // Audience matching (sport / teams / roles) is enforced client-side in
  // useAnnouncements; the server-side filter just prevents draft leakage.
  // Field whitelist excludes internal admin state (notify_push, notify_email,
  // fanout_sent_at) which members shouldn't see.
  await setPermRead(MEMBER_POLICY, 'announcements', {
    _and: [
      { published_at: { _nnull: true } },
      { published_at: { _lte: '$NOW' } },
      { _or: [
        { expires_at: { _null: true } },
        { expires_at: { _gt: '$NOW' } },
      ] },
    ],
  }, [
    // Intentionally exclude audience_teams / audience_roles — once role/team
    // targeting (v2) lands, exposing those arrays to non-admins would reveal
    // targeting intent for posts that weren't meant to be widely visible.
    'id', 'image', 'link', 'pinned',
    'published_at', 'expires_at',
    'audience_type', 'audience_sport',
    'translations', 'created_by',
    'date_created', 'date_updated',
  ])

  // Push subscriptions — CRUD own
  await setPermRead(MEMBER_POLICY, 'push_subscriptions', OWN_MEMBER)
  await setPerm(MEMBER_POLICY, 'push_subscriptions', 'create')
  await setPerm(MEMBER_POLICY, 'push_subscriptions', 'update', OWN_MEMBER)
  await setPerm(MEMBER_POLICY, 'push_subscriptions', 'delete', OWN_MEMBER)

  // Member teams — directory-level cross-club read kept (migration 036).
  // `guest_level` stays readable: the FE's getGuestLevel() needs it on the
  // user's own rows, and cross-team visibility of guest_level is acceptable
  // (it's already implicit in roster cards). The 2026-05-06 audit raised it
  // as Low; we explicitly accept that read scope and document in SECURITY.md.
  await setPermRead(MEMBER_POLICY, 'member_teams')

  // Blocks — see only my own outgoing blocks (incoming blocks stay opaque)
  // (migration 042).
  await setPermRead(MEMBER_POLICY, 'blocks', { blocker: { user: { _eq: '$CURRENT_USER' } } })

  // Spielplaner assignments — self-scoped (migrations 034, 042).
  await setPermRead(MEMBER_POLICY, 'spielplaner_assignments', OWN_MEMBER)

  // Scorer delegations — read/create/update own
  await setPermRead(MEMBER_POLICY, 'scorer_delegations', OWN_DELEGATION)
  await setPerm(MEMBER_POLICY, 'scorer_delegations', 'create')
  await setPerm(MEMBER_POLICY, 'scorer_delegations', 'update', OWN_DELEGATION)

  // Team invites — read own
  await setPermRead(MEMBER_POLICY, 'team_invites', { member: { user: { _eq: '$CURRENT_USER' } } })

  // User logs — create + read own
  await setPerm(MEMBER_POLICY, 'user_logs', 'create')
  await setPermRead(MEMBER_POLICY, 'user_logs', OWN_DU)

  // Feedback — create + read own (migration 043 scoped read by submitter email).
  await setPerm(MEMBER_POLICY, 'feedback', 'create')
  await setPermRead(MEMBER_POLICY, 'feedback', { email: { _eq: '$CURRENT_USER.email' } })

  // Tasks — read scope mirrors update (migration 043).
  const OWN_TASK_FILTER = {
    _or: [
      { assigned_to: { user: { _eq: '$CURRENT_USER' } } },
      { claimed_by: { user: { _eq: '$CURRENT_USER' } } },
    ],
  }
  await setPermRead(MEMBER_POLICY, 'tasks', OWN_TASK_FILTER)
  await setPerm(MEMBER_POLICY, 'tasks', 'update', OWN_TASK_FILTER)

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
  // Members — update position + number (migration 036 scoped to my-team members).
  // Coach uses { member_teams.team.coach.members_id... }; TR uses team_responsible.
  // We can't tell which sub-policy this is at this layer, so the broader Coach
  // filter is used; TR is identical because both junction columns appear on teams.
  const COACH_TEAM_MEMBERS = {
    member_teams: {
      team: {
        _or: [
          { coach: { members_id: { user: { _eq: '$CURRENT_USER' } } } },
          { team_responsible: { members_id: { user: { _eq: '$CURRENT_USER' } } } },
        ],
      },
    },
  }
  await setPerm(LEADER_POLICY, 'members', 'update', COACH_TEAM_MEMBERS, ['position', 'number'])

  // Coach Dashboard prefs — explicit read for Leader (Coach/TR).
  // PUBLIC_TEAM_FIELDS doesn't include these, so KSCW Member never sees them.
  await setPermRead(LEADER_POLICY, 'teams', null, LEADER_TEAM_DASHBOARD_FIELDS)

  // Teams — update scoped (migration 043). Coach ↔ team via teams.coach M2M;
  // Team Responsible ↔ team via teams.team_responsible M2M.
  await setPerm(LEADER_POLICY, 'teams', 'update', {
    _or: [
      { coach: { members_id: { user: { _eq: '$CURRENT_USER' } } } },
      { team_responsible: { members_id: { user: { _eq: '$CURRENT_USER' } } } },
    ],
  })

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

  // Announcements — restricted to same filter as members (no draft access).
  // F6 audit fix: coaches don't need to see admin's pre-publication drafts.
  // Vorstand keeps unrestricted access for their pipeline-visibility role.
  await setPermRead(LEADER_POLICY, 'announcements', {
    _and: [
      { published_at: { _nnull: true } },
      { published_at: { _lte: '$NOW' } },
      { _or: [
        { expires_at: { _null: true } },
        { expires_at: { _gt: '$NOW' } },
      ] },
    ],
  }, [
    // Intentionally exclude audience_teams / audience_roles — once role/team
    // targeting (v2) lands, exposing those arrays to non-admins would reveal
    // targeting intent for posts that weren't meant to be widely visible.
    'id', 'image', 'link', 'pinned',
    'published_at', 'expires_at',
    'audience_type', 'audience_sport',
    'translations', 'created_by',
    'date_created', 'date_updated',
  ])

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
    'announcements',
  ]
  for (const col of VORSTAND_READ_ALL) {
    await setPermRead(VORSTAND_POLICY, col)
  }

  console.log(`  ✓ Vorstand permissions set`)

  // ���─ 9. Sport Admin permissions ───��─────────────────────────────

  console.log('\n9. Sport Admin permissions...')

  // Sport Admin tier: club-wide CRU on operational collections, but NOT
  // members.delete or teams.delete (migration 027 — full admin only,
  // club-wide blast radius).
  const SPORT_ADMIN_FULL_CRUD = [
    'games', 'trainings', 'events', 'event_sessions', 'events_teams',
    'member_teams', 'participations', 'absences',
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
    'announcements',
    'directus_files',
  ]
  for (const col of SPORT_ADMIN_FULL_CRUD) {
    await setPermCRUD(SPORT_ADMIN_POLICY, col)
  }
  // Restricted: read/create/update only on members + teams (delete blocked).
  for (const col of ['members', 'teams']) {
    await setPerm(SPORT_ADMIN_POLICY, col, 'create')
    await setPermRead(SPORT_ADMIN_POLICY, col)
    await setPerm(SPORT_ADMIN_POLICY, col, 'update')
    // No delete — migration 027.
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
