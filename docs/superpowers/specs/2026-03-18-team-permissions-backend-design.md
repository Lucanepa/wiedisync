# Team Permissions Backend Enforcement

**Date:** 2026-03-18
**Status:** Draft
**Scope:** Backend-only — no frontend changes, no new features

## Problem

All coach/team_responsible permission checks in Wiedisync are frontend-only. PocketBase has no collection-level rules enforcing access. Any authenticated user with a valid token can bypass the UI and hit the API directly to modify teams, rosters, members, and hall slots.

## Goal

Add PocketBase hooks that enforce coach/team_responsible permissions server-side for 4 collections, matching the existing frontend authorization logic.

## Approach

**PB hooks as middleware** (Approach B from brainstorming). New `onRecord*` hooks validate the authenticated user's role and team membership before allowing writes. All permission logic lives in hooks — no PB collection rules needed.

### PB v0.36 Hook API Notes

- **Pre-write hooks**: `onRecordCreate`, `onRecordUpdate`, `onRecordDelete` — these fire before the write and can abort via `throw new ForbiddenError("message")`. Signature: `onRecordCreate(handler, ...collectionTags)` (handler first, collection name(s) after). Call `e.next()` to proceed.
- **Post-write hooks**: `onRecordAfterCreateSuccess`, `onRecordAfterUpdateSuccess` — fire after write, cannot abort. Used by `notifications.pb.js`.
- **`$app.save()` / `e.app.save()`** bypasses all `onRecord*` hooks — sync scripts (`sv_sync.pb.js`, `bp_sync.pb.js`, `clubdesk_sync.pb.js`) use this pattern and are unaffected.
- **`ForbiddenError`** is a valid global in PB v0.36 goja (confirmed: used in `game_scheduling_api.pb.js`, `push_subscriptions.pb.js`).
- **Goja limitations**: No `Array.map()`, `Array.includes()`, arrow functions work but `function()` is safer. Use for-loops for array iteration.
- Reference pattern: `slot_claims.pb.js` (pre-write validation with `onRecordCreate`).

## Files

| File | Purpose |
|---|---|
| `pb_hooks/team_permissions_lib.js` | Shared permission helpers |
| `pb_hooks/team_permissions.pb.js` | Hook registrations for all 4 collections |
| `scripts/test-team-permissions.sh` | Curl-based integration tests against dev PB |

## Shared Helpers (`team_permissions_lib.js`)

### `assertTeamAccess(e, teamId)`

Checks if the authenticated user can write to a given team's resources.

1. Get auth user from `e.requestInfo().auth`
2. No auth → `ForbiddenError`
3. User role includes `superuser` or `admin` → allow
4. User role includes `vb_admin` → allow if team's `sport === 'volleyball'`
5. User role includes `bb_admin` → allow if team's `sport === 'basketball'`
6. User is in team's `coach[]` or `team_responsible[]` → allow
7. Otherwise → `throw new ForbiddenError("You don't have permission to modify this team.")`

Implementation notes:
- Steps 4-6 require fetching the team record via `$app.findRecordById("teams", teamId)` to check sport and coach/TR arrays.
- Coach/TR arrays are multi-relation fields — iterate with a for-loop (no `Array.includes()` in goja):
  ```js
  var coaches = team.get("coach") || []
  for (var i = 0; i < coaches.length; i++) {
    if (coaches[i] === authId) return // allowed
  }
  ```
- Log denied access for observability: `console.log("[team_permissions] Denied: user " + authId + " cannot modify team " + teamId)`

### `assertMemberFieldAccess(e)`

Checks if the authenticated user can update the target member record, with field-level restrictions for coaches.

1. No auth → `ForbiddenError`
2. User role includes `superuser` or `admin` → allow all fields
3. User role includes `vb_admin` or `bb_admin` → allow all fields (sport scoping not applied to member edits since a member can be on multiple sport teams)
4. User is editing **themselves** (`auth.id === record.id`) → allow all fields
5. User is coach/TR of a team the target member belongs to → check changed fields:
   - Allowed: `position`, `number`, `licences`, `birthdate_visibility`
   - Any other field changed → `throw new ForbiddenError("Coaches can only edit position, number, licences, and birthdate_visibility.")`
   - "Changed" = `record.get(field) !== record.original().get(field)` for each non-allowed field
6. Otherwise → `ForbiddenError`

To determine if a member is on the coach's team: query `member_teams` where `member = targetMemberId` AND `team IN coachTeamIds`.

Implementation note for coach team lookup (goja-compatible):
```js
var coachTeams = $app.findRecordsByFilter("teams",
  'active=true && (coach~"' + authId + '" || team_responsible~"' + authId + '")',
  "", 100, 0)
var coachTeamIds = []
for (var i = 0; i < coachTeams.length; i++) {
  coachTeamIds.push(coachTeams[i].id)
}
var memberOnTeam = $app.findRecordsByFilter("member_teams",
  'member="' + targetId + '" && team IN ("' + coachTeamIds.join('","') + '")',
  "", 1, 0)
if (!memberOnTeam || memberOnTeam.length === 0) {
  throw new ForbiddenError("Member is not on your team.")
}
```

Define allowed fields as a constant at the top of the lib for easy maintenance:
```js
var COACH_EDITABLE_MEMBER_FIELDS = ["position", "number", "licences", "birthdate_visibility"]
```

### `assertAdminAccess(e)`

Checks if the authenticated user has admin-level access. Used for hall_slots.

1. No auth → `ForbiddenError`
2. User role includes `superuser` or `admin` → allow
3. `hall_slots` has a `team` field (relation to `teams`). Fetch the team record to determine sport:
   - `vb_admin` → allow if team's `sport === 'volleyball'`
   - `bb_admin` → allow if team's `sport === 'basketball'`
4. Otherwise → `throw new ForbiddenError("Only admins can manage hall slots.")`

## Hook Registrations (`team_permissions.pb.js`)

### `teams` — create, update, delete

```js
onRecordCreate((e) => {
  var lib = require(__hooks + "/team_permissions_lib.js")
  lib.assertAdminAccess(e)
  e.next()
}, "teams")

onRecordUpdate((e) => {
  var lib = require(__hooks + "/team_permissions_lib.js")
  lib.assertTeamAccess(e, e.record.id)
  e.next()
}, "teams")

onRecordDelete((e) => {
  var lib = require(__hooks + "/team_permissions_lib.js")
  lib.assertAdminAccess(e)
  e.next()
}, "teams")
```

Note: Team create and delete are admin-only. Only update is open to coaches/TR.

### `member_teams` — create, update, delete

```js
onRecordCreate((e) => {
  var lib = require(__hooks + "/team_permissions_lib.js")
  lib.assertTeamAccess(e, e.record.getString("team"))
  e.next()
}, "member_teams")

onRecordUpdate((e) => {
  var lib = require(__hooks + "/team_permissions_lib.js")
  var oldTeamId = e.record.original().getString("team")
  var newTeamId = e.record.getString("team")
  lib.assertTeamAccess(e, oldTeamId)
  if (newTeamId !== oldTeamId) {
    lib.assertTeamAccess(e, newTeamId)
  }
  e.next()
}, "member_teams")

onRecordDelete((e) => {
  var lib = require(__hooks + "/team_permissions_lib.js")
  lib.assertTeamAccess(e, e.record.getString("team"))
  e.next()
}, "member_teams")
```

### `members` — update

```js
onRecordUpdate((e) => {
  var lib = require(__hooks + "/team_permissions_lib.js")
  lib.assertMemberFieldAccess(e)
  e.next()
}, "members")
```

### `hall_slots` — create, update, delete

```js
onRecordCreate((e) => {
  var lib = require(__hooks + "/team_permissions_lib.js")
  lib.assertAdminAccess(e)
  e.next()
}, "hall_slots")

onRecordUpdate((e) => {
  var lib = require(__hooks + "/team_permissions_lib.js")
  lib.assertAdminAccess(e)
  e.next()
}, "hall_slots")

onRecordDelete((e) => {
  var lib = require(__hooks + "/team_permissions_lib.js")
  lib.assertAdminAccess(e)
  e.next()
}, "hall_slots")
```

## Permission Matrix

| Collection | Operation | Coach/TR (own team) | vb_admin (VB teams) | bb_admin (BB teams) | admin/superuser |
|---|---|---|---|---|---|
| `teams` | create | **no** | **no** | **no** | yes |
| `teams` | update | yes | yes | yes | yes |
| `teams` | delete | **no** | **no** | **no** | yes |
| `member_teams` | create | yes | yes | yes | yes |
| `member_teams` | update | yes | yes | yes | yes |
| `member_teams` | delete | yes | yes | yes | yes |
| `members` | update | 4 fields only | all fields | all fields | all fields |
| `hall_slots` | create | **no** | yes | yes | yes |
| `hall_slots` | update | **no** | yes | yes | yes |
| `hall_slots` | delete | **no** | yes | yes | yes |

Coach-editable fields on `members`: `position`, `number`, `licences`, `birthdate_visibility`.

## Edge Cases

1. **PB hooks that write to these collections** (e.g., `sv_sync.pb.js`, `bp_sync.pb.js`, `clubdesk_sync.pb.js`) use `$app.save()` / `e.app.save()` which bypasses `onRecord*` hooks — no conflict.
2. **A coach removing themselves from the coach array** — allowed. They lose access after the update completes. The UI should warn about this, but that's a frontend concern (out of scope).
3. **member_teams season scoping** — hooks check team access regardless of season. A coach of a team can modify member_teams for any season of that team.
4. **User with no role** — treated as regular user, denied all writes except self-profile edits.
5. **Unapproved users** — not checked by these hooks (PB handles auth). If a user is authenticated but not approved, they can still edit their own profile.
6. **Logging** — all denied access attempts are logged with `console.log("[team_permissions] Denied: ...")` for production observability (visible in `journalctl -u pocketbase-kscw`).

## Testing

### Test Script: `scripts/test-team-permissions.sh`

Curl-based integration tests against dev PB (`kscw-api-dev.lucanepa.com`).

Authenticates as different test users and attempts each operation, asserting expected HTTP status codes.

### Test Cases

**`assertTeamAccess` (teams, member_teams):**

| # | Scenario | Expected |
|---|---|---|
| 1 | Coach updates own team | 200 |
| 2 | Coach updates team they don't coach | 403 |
| 3 | Coach creates member_teams for own team | 200 |
| 4 | Coach creates member_teams for other team | 403 |
| 5 | Coach deletes member_teams from own team | 200 |
| 6 | Coach updates member_teams on own team | 200 |
| 7 | vb_admin updates volleyball team | 200 |
| 8 | vb_admin updates basketball team | 403 |
| 9 | bb_admin updates basketball team | 200 |
| 10 | admin updates any team | 200 |
| 11 | superuser updates any team | 200 |
| 12 | Regular user updates team | 403 |
| 13 | Team_responsible (not coach) updates own team | 200 |
| 14 | Unauthenticated request updates team | 401/403 |
| 15 | Coach creates a team | 403 |
| 16 | Coach deletes a team | 403 |
| 17 | Admin creates a team | 200 |
| 18 | Admin deletes a team | 200 |
| 19 | Coach updates member_teams, changing team field to other team | 403 |

**`assertMemberFieldAccess` (members):**

| # | Scenario | Expected |
|---|---|---|
| 20 | User edits own profile (any field) | 200 |
| 21 | Coach edits team member's `position` | 200 |
| 22 | Coach edits team member's `number` | 200 |
| 23 | Coach edits team member's `licences` | 200 |
| 24 | Coach edits team member's `birthdate_visibility` | 200 |
| 25 | Coach edits team member's `email` | 403 |
| 26 | Coach edits team member's `phone` | 403 |
| 27 | Coach edits member NOT on their team | 403 |
| 28 | Admin edits any member, any field | 200 |
| 29 | Unauthenticated request edits member | 401/403 |

**`assertAdminAccess` (hall_slots):**

| # | Scenario | Expected |
|---|---|---|
| 30 | Coach creates hall_slot | 403 |
| 31 | Coach updates hall_slot | 403 |
| 32 | Coach deletes hall_slot | 403 |
| 33 | vb_admin creates volleyball hall_slot | 200 |
| 34 | vb_admin creates basketball hall_slot | 403 |
| 35 | bb_admin creates basketball hall_slot | 200 |
| 36 | admin creates any hall_slot | 200 |
| 37 | Unauthenticated request creates hall_slot | 401/403 |

## Deployment

1. Deploy hooks to dev: `scp` to VPS `/tmp/` → `sudo cp` to `/opt/pocketbase-kscw/pb_hooks/` → restart
2. Run test script against dev
3. Once passing, deploy to prod (same process)

## Out of Scope

- Frontend changes (already has correct permission gates)
- New coach features
- Read/list rules (all reads remain open to authenticated users)
- PB collection-level rules (all enforcement via hooks)
- Permissions for collections beyond these 4
- `members` create/delete hooks — member creation is via auth signup (PB handles this), deletion is admin-only in the UI and not a coach operation
- `/// <reference path>` header — add `/// <reference path="../pb_data/types.d.ts" />` to both hook files for IDE support (consistent with existing hooks)
