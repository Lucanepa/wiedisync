/**
 * apply-api-rules.ts — Apply listRule/viewRule to all PocketBase collections.
 *
 * This enforces server-side row-level security so users only see data
 * for teams they belong to, regardless of client-side filters.
 *
 * Usage:
 *   PB_URL=https://api-dev.kscw.ch PB_EMAIL=admin@kscw.ch PB_PASSWORD=xxx npx tsx scripts/apply-api-rules.ts
 *
 * Idempotent — safe to run multiple times.
 */

import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL ?? 'https://api-dev.kscw.ch'
const PB_EMAIL = process.env.PB_EMAIL ?? 'admin@kscw.ch'
const PB_PASSWORD = process.env.PB_PASSWORD ?? ''

if (!PB_PASSWORD) {
  console.error('PB_PASSWORD is required. Set it as an environment variable.')
  process.exit(1)
}

const pb = new PocketBase(PB_URL)
await pb.collection('_superusers').authWithPassword(PB_EMAIL, PB_PASSWORD)
console.log(`Authenticated to ${PB_URL}\n`)

// ── Admin bypass clause ──────────────────────────────────────────────
// role is a multi-select field → use ?~ (any value contains) not ?= (broken for select fields in PB v0.36)
const ANY_ADMIN = [
  '@request.auth.role ?~ "admin"',
  '@request.auth.role ?~ "superuser"',
  '@request.auth.role ?~ "vorstand"',
  '@request.auth.role ?~ "vb_admin"',
  '@request.auth.role ?~ "bb_admin"',
].join(' || ')

// ── Helper: team membership check via back-relation ──────────────────
// "user is a member of team X" where X is accessed via a relation field
function teamMemberCheck(teamField: string): string {
  return `@request.auth.id ?= ${teamField}.member_teams_via_team.member`
}

function coachOrTRCheck(teamField: string): string {
  return `${teamField}.coach ?~ @request.auth.id || ${teamField}.team_responsible ?~ @request.auth.id`
}

function teamScopedRule(teamField: string): string {
  return `${ANY_ADMIN} || ${teamMemberCheck(teamField)} || ${coachOrTRCheck(teamField)}`
}

// "auth user shares a team with the member referenced by memberField"
// Traverses: memberField → members → member_teams_via_member → team → member_teams_via_team → member
function teammateMemberCheck(memberField: string): string {
  return `@request.auth.id ?= ${memberField}.member_teams_via_member.team.member_teams_via_team.member`
}

// "auth user coaches a team that the member referenced by memberField belongs to"
// Traverses: memberField → members → member_teams_via_member → team → coach/team_responsible
function coachOfMemberCheck(memberField: string): string {
  return `${memberField}.member_teams_via_member.team.coach ?~ @request.auth.id || ${memberField}.member_teams_via_member.team.team_responsible ?~ @request.auth.id`
}

// ── Rules definition ─────────────────────────────────────────────────

const RULES: Record<string, { listRule: string | null; viewRule: string | null }> = {
  // A. Public/shared — no team scope needed
  halls:         { listRule: '', viewRule: '' },
  hall_closures: { listRule: '', viewRule: '' },
  hall_events:   { listRule: '', viewRule: '' },
  teams:         { listRule: '', viewRule: '' },
  hall_slots:    { listRule: '@request.auth.id != ""', viewRule: '@request.auth.id != ""' },
  app_settings:  { listRule: null, viewRule: null },  // superuser-only (read by ScorerPage when isSuperAdmin)

  // B. Team-scoped — user must be on the team
  trainings:    { listRule: teamScopedRule('team'),      viewRule: teamScopedRule('team') },
  games: {
    // Public read — game schedules/scores are public (shown on kscw-website calendar).
    // Write access is already protected by hooks.
    listRule: '',
    viewRule: '',
  },
  member_teams: {
    // Go through team relation → back-reference other member_teams on same team
    listRule: `${ANY_ADMIN} || ${teamMemberCheck('team')} || ${coachOrTRCheck('team')}`,
    viewRule: `${ANY_ADMIN} || ${teamMemberCheck('team')} || ${coachOrTRCheck('team')}`,
  },
  events: {
    // Public read — events are club calendar data (title, date, location), not sensitive.
    // Participation/RSVP data is protected separately in the participations collection.
    listRule: '',
    viewRule: '',
  },
  event_sessions: {
    listRule: `${ANY_ADMIN} || event.teams:length = 0 || @request.auth.id ?= event.teams.member_teams_via_team.member || event.teams.coach ?~ @request.auth.id`,
    viewRule: `${ANY_ADMIN} || event.teams:length = 0 || @request.auth.id ?= event.teams.member_teams_via_team.member || event.teams.coach ?~ @request.auth.id`,
  },

  // C. Teammate-scoped — self + people on same team(s) + admin
  members: {
    // Can see self + teammates (share a team) + members of coached teams
    // Note: on the members collection itself, back-relations start from current record (no field prefix)
    listRule: `${ANY_ADMIN} || id = @request.auth.id || @request.auth.id ?= member_teams_via_member.team.member_teams_via_team.member || member_teams_via_member.team.coach ?~ @request.auth.id || member_teams_via_member.team.team_responsible ?~ @request.auth.id`,
    viewRule: `${ANY_ADMIN} || id = @request.auth.id || @request.auth.id ?= member_teams_via_member.team.member_teams_via_team.member || member_teams_via_member.team.coach ?~ @request.auth.id || member_teams_via_member.team.team_responsible ?~ @request.auth.id`,
  },
  absences: {
    // Own + teammate absences + absences of coached team members
    listRule: `${ANY_ADMIN} || @request.auth.id = member || ${teammateMemberCheck('member')} || ${coachOfMemberCheck('member')}`,
    viewRule: `${ANY_ADMIN} || @request.auth.id = member || ${teammateMemberCheck('member')} || ${coachOfMemberCheck('member')}`,
  },
  participations: {
    // Own + teammate + coached team participations
    listRule: `${ANY_ADMIN} || @request.auth.id = member || ${teammateMemberCheck('member')} || ${coachOfMemberCheck('member')}`,
    viewRule: `${ANY_ADMIN} || @request.auth.id = member || ${teammateMemberCheck('member')} || ${coachOfMemberCheck('member')}`,
  },
  // Auth-only (needed cross-team for hallenplan)
  slot_claims:    { listRule: '@request.auth.id != ""', viewRule: '@request.auth.id != ""' },
  notifications: {
    listRule: '@request.auth.id = member',
    viewRule: '@request.auth.id = member',
  },
  scorer_delegations: {
    listRule: `${ANY_ADMIN} || @request.auth.id = from_member || @request.auth.id = to_member`,
    viewRule: `${ANY_ADMIN} || @request.auth.id = from_member || @request.auth.id = to_member`,
  },
  feedback: {
    listRule: `${ANY_ADMIN} || @request.auth.id = user`,
    viewRule: `${ANY_ADMIN} || @request.auth.id = user`,
  },

  // D. Admin-only (accessed via hooks)
  push_subscriptions: { listRule: null, viewRule: null },
  user_logs:          { listRule: null, viewRule: null },

  // E. Game scheduling (enforce expected values)
  game_scheduling_seasons:  { listRule: '', viewRule: '' },
  game_scheduling_opponents: { listRule: null, viewRule: null },
  game_scheduling_bookings:  { listRule: null, viewRule: null },
  game_scheduling_slots:     { listRule: '', viewRule: '' },
}

// ── Apply rules ──────────────────────────────────────────────────────

let updated = 0
let skipped = 0
let errors = 0

for (const [name, rules] of Object.entries(RULES)) {
  try {
    const col = await pb.collections.getOne(name)
    await pb.collections.update(col.id, {
      listRule: rules.listRule,
      viewRule: rules.viewRule,
    })
    const listDesc = rules.listRule === null ? 'locked' : rules.listRule === '' ? 'public' : 'filtered'
    const viewDesc = rules.viewRule === null ? 'locked' : rules.viewRule === '' ? 'public' : 'filtered'
    console.log(`  ✓ ${name} (list: ${listDesc}, view: ${viewDesc})`)
    updated++
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err)
    if (msg.includes('not found') || msg.includes('404')) {
      console.log(`  ⊘ ${name}: collection not found, skipping`)
      skipped++
    } else {
      console.error(`  ✗ ${name}: ${msg}`)
      errors++
    }
  }
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped, ${errors} errors`)
if (errors > 0) process.exit(1)
