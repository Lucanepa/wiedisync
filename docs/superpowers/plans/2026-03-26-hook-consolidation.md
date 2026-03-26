# PocketBase Hook Consolidation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce 47 hook files to ~32 by inlining single-use `_lib.js` files into their parent `.pb.js`, removing 2 dead hooks, and setting a safe memory limit — reducing hot-reload memory pressure and improving maintainability.

**Architecture:** Each single-use `_lib.js` gets inlined into its parent `.pb.js` as a top-level helper section (above the hook registrations). Two shared libs (`email_template_lib.js`, `push_lib.js`) remain as standalone files since they're used by multiple parents. Two dead hooks (`clubdesk_sync`, `birthdate_visibility_migration`) are deleted.

**Tech Stack:** PocketBase 0.36 goja (ES5 JavaScript), Docker/Coolify deployment

---

## Important Context

- Hooks run in PocketBase's **goja ES5 runtime** (not Node.js)
- `require(__hooks + "/file.js")` loads a module — when inlining, the `module.exports` pattern is replaced with plain variables/functions
- Hooks are deployed via Coolify Docker build (`COPY pb_hooks/` in Dockerfile)
- **Do NOT inline `email_template_lib.js` or `push_lib.js`** — they are shared across multiple hooks
- After inlining, the parent `.pb.js` file must NOT have `require()` calls to the removed lib
- Test each merged file by running `npm run lint:hooks` after each merge

## File Changes Summary

**Delete (2 files):**
- `pb_hooks/clubdesk_sync.pb.js`
- `pb_hooks/clubdesk_sync_lib.js`
- `pb_hooks/birthdate_visibility_migration.pb.js`

**Inline merges (11 libs → 11 parents, net -11 files):**

| Lib (delete after merge) | Parent (absorbs lib) |
|--------------------------|---------------------|
| `notifications_lib.js` | `notifications.pb.js` |
| `scorer_reminders_lib.js` | `scorer_reminders.pb.js` |
| `sv_sync_lib.js` | `sv_sync.pb.js` |
| `bp_sync_lib.js` | `bp_sync.pb.js` |
| `gcal_sync_lib.js` | `gcal_sync.pb.js` |
| `ical_feed_lib.js` | `ical_feed.pb.js` |
| `audit_log_lib.js` | `audit_log.pb.js` |
| `game_scheduling_lib.js` | `game_scheduling_api.pb.js` |
| `team_permissions_lib.js` | `team_permissions.pb.js` |
| `participation_priority_lib.js` | `participation_priority.pb.js` |
| `clubdesk_sync_lib.js` | (deleted with parent) |

**Keep unchanged (2 shared libs):**
- `pb_hooks/email_template_lib.js` (used by 7 hooks)
- `pb_hooks/push_lib.js` (used by notifications_lib → notifications.pb.js, push_subscriptions.pb.js)

**Result:** 47 files → 34 files

## Inlining Pattern

When inlining a `_lib.js` into its parent `.pb.js`, follow this pattern:

**Before (two files):**
```javascript
// feature_lib.js
module.exports = {
  doThing: function(app, record) { /* ... */ },
  doOther: function(app) { /* ... */ }
}

// feature.pb.js
onRecordAfterCreateRequest(function(e) {
  var lib = require(__hooks + "/feature_lib.js")
  lib.doThing(e.app, e.record)
}, "collection")
```

**After (one file):**
```javascript
// feature.pb.js

// ── helpers (inlined from feature_lib.js) ──
function doThing(app, record) { /* ... */ }
function doOther(app) { /* ... */ }

// ── hooks ──
onRecordAfterCreateRequest(function(e) {
  doThing(e.app, e.record)
}, "collection")
```

Key rules:
1. Convert `module.exports = { fn: function() {} }` to standalone `function fn() {}`
2. Replace all `lib.fn()` calls with direct `fn()` calls
3. If the lib has a `require()` for a shared lib (e.g., `email_template_lib.js`), keep that `require()` in the hook callbacks
4. Remove the `module.exports` block entirely
5. Add a `// ── helpers (inlined from X_lib.js) ──` comment before the helpers section

---

### Task 1: Delete dead hooks

**Files:**
- Delete: `pb_hooks/clubdesk_sync.pb.js`
- Delete: `pb_hooks/clubdesk_sync_lib.js`
- Delete: `pb_hooks/birthdate_visibility_migration.pb.js`

- [ ] **Step 1: Verify no other hooks reference these files**

Run: `grep -r "clubdesk_sync\|birthdate_visibility" pb_hooks/ --include="*.js" -l`
Expected: Only the files themselves (no external references)

- [ ] **Step 2: Delete the files**

```bash
rm pb_hooks/clubdesk_sync.pb.js pb_hooks/clubdesk_sync_lib.js pb_hooks/birthdate_visibility_migration.pb.js
```

- [ ] **Step 3: Lint**

Run: `npm run lint:hooks`
Expected: PASS (no errors from removed files)

- [ ] **Step 4: Commit**

```bash
git add -A pb_hooks/clubdesk_sync.pb.js pb_hooks/clubdesk_sync_lib.js pb_hooks/birthdate_visibility_migration.pb.js
git commit -m "chore: remove dead hooks (clubdesk_sync, birthdate_visibility_migration)"
```

---

### Task 2: Inline `audit_log_lib.js` → `audit_log.pb.js`

**Files:**
- Modify: `pb_hooks/audit_log.pb.js`
- Delete: `pb_hooks/audit_log_lib.js`

- [ ] **Step 1: Read both files**

Read `pb_hooks/audit_log_lib.js` and `pb_hooks/audit_log.pb.js` fully.

- [ ] **Step 2: Inline the lib functions**

Copy all exported functions from `audit_log_lib.js` into the top of `audit_log.pb.js` as standalone functions. Replace all `var audit = require(__hooks + "/audit_log_lib.js")` + `audit.fn()` calls with direct `fn()` calls. Add `// ── helpers (inlined from audit_log_lib.js) ──` section header.

- [ ] **Step 3: Delete the lib file**

```bash
rm pb_hooks/audit_log_lib.js
```

- [ ] **Step 4: Lint**

Run: `npm run lint:hooks`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pb_hooks/audit_log.pb.js pb_hooks/audit_log_lib.js
git commit -m "refactor: inline audit_log_lib into audit_log.pb.js"
```

---

### Task 3: Inline `notifications_lib.js` → `notifications.pb.js`

**Files:**
- Modify: `pb_hooks/notifications.pb.js`
- Delete: `pb_hooks/notifications_lib.js`

**Note:** `notifications_lib.js` uses `require(__hooks + "/push_lib.js")` — keep that `require()` call inside the callback where it's used.

- [ ] **Step 1: Read both files**
- [ ] **Step 2: Inline the lib functions, preserving `push_lib.js` require**
- [ ] **Step 3: Delete `pb_hooks/notifications_lib.js`**
- [ ] **Step 4: Lint** — Run: `npm run lint:hooks`
- [ ] **Step 5: Commit**

```bash
git add pb_hooks/notifications.pb.js pb_hooks/notifications_lib.js
git commit -m "refactor: inline notifications_lib into notifications.pb.js"
```

---

### Task 4: Inline `scorer_reminders_lib.js` → `scorer_reminders.pb.js`

**Files:**
- Modify: `pb_hooks/scorer_reminders.pb.js`
- Delete: `pb_hooks/scorer_reminders_lib.js`

**Note:** `scorer_reminders_lib.js` uses `require(__hooks + "/email_template_lib.js")` at the top level — move that `require()` inside each callback that needs it.

- [ ] **Step 1: Read both files**
- [ ] **Step 2: Inline the lib functions, moving `email_template_lib.js` require into callbacks**
- [ ] **Step 3: Delete `pb_hooks/scorer_reminders_lib.js`**
- [ ] **Step 4: Lint** — Run: `npm run lint:hooks`
- [ ] **Step 5: Commit**

```bash
git add pb_hooks/scorer_reminders.pb.js pb_hooks/scorer_reminders_lib.js
git commit -m "refactor: inline scorer_reminders_lib into scorer_reminders.pb.js"
```

---

### Task 5: Inline `sv_sync_lib.js` → `sv_sync.pb.js`

**Files:**
- Modify: `pb_hooks/sv_sync.pb.js`
- Delete: `pb_hooks/sv_sync_lib.js`

- [ ] **Step 1: Read both files**
- [ ] **Step 2: Inline the lib functions**
- [ ] **Step 3: Delete `pb_hooks/sv_sync_lib.js`**
- [ ] **Step 4: Lint** — Run: `npm run lint:hooks`
- [ ] **Step 5: Commit**

```bash
git add pb_hooks/sv_sync.pb.js pb_hooks/sv_sync_lib.js
git commit -m "refactor: inline sv_sync_lib into sv_sync.pb.js"
```

---

### Task 6: Inline `bp_sync_lib.js` → `bp_sync.pb.js`

**Files:**
- Modify: `pb_hooks/bp_sync.pb.js`
- Delete: `pb_hooks/bp_sync_lib.js`

- [ ] **Step 1: Read both files**
- [ ] **Step 2: Inline the lib functions**
- [ ] **Step 3: Delete `pb_hooks/bp_sync_lib.js`**
- [ ] **Step 4: Lint** — Run: `npm run lint:hooks`
- [ ] **Step 5: Commit**

```bash
git add pb_hooks/bp_sync.pb.js pb_hooks/bp_sync_lib.js
git commit -m "refactor: inline bp_sync_lib into bp_sync.pb.js"
```

---

### Task 7: Inline `gcal_sync_lib.js` → `gcal_sync.pb.js`

**Files:**
- Modify: `pb_hooks/gcal_sync.pb.js`
- Delete: `pb_hooks/gcal_sync_lib.js`

- [ ] **Step 1: Read both files**
- [ ] **Step 2: Inline the lib functions**
- [ ] **Step 3: Delete `pb_hooks/gcal_sync_lib.js`**
- [ ] **Step 4: Lint** — Run: `npm run lint:hooks`
- [ ] **Step 5: Commit**

```bash
git add pb_hooks/gcal_sync.pb.js pb_hooks/gcal_sync_lib.js
git commit -m "refactor: inline gcal_sync_lib into gcal_sync.pb.js"
```

---

### Task 8: Inline `ical_feed_lib.js` → `ical_feed.pb.js`

**Files:**
- Modify: `pb_hooks/ical_feed.pb.js`
- Delete: `pb_hooks/ical_feed_lib.js`

- [ ] **Step 1: Read both files**
- [ ] **Step 2: Inline the lib functions**
- [ ] **Step 3: Delete `pb_hooks/ical_feed_lib.js`**
- [ ] **Step 4: Lint** — Run: `npm run lint:hooks`
- [ ] **Step 5: Commit**

```bash
git add pb_hooks/ical_feed.pb.js pb_hooks/ical_feed_lib.js
git commit -m "refactor: inline ical_feed_lib into ical_feed.pb.js"
```

---

### Task 9: Inline `game_scheduling_lib.js` → `game_scheduling_api.pb.js`

**Files:**
- Modify: `pb_hooks/game_scheduling_api.pb.js`
- Delete: `pb_hooks/game_scheduling_lib.js`

**Note:** `game_scheduling_api.pb.js` also uses `email_template_lib.js` — keep those `require()` calls.

- [ ] **Step 1: Read both files**
- [ ] **Step 2: Inline the lib functions, preserving `email_template_lib.js` requires**
- [ ] **Step 3: Delete `pb_hooks/game_scheduling_lib.js`**
- [ ] **Step 4: Lint** — Run: `npm run lint:hooks`
- [ ] **Step 5: Commit**

```bash
git add pb_hooks/game_scheduling_api.pb.js pb_hooks/game_scheduling_lib.js
git commit -m "refactor: inline game_scheduling_lib into game_scheduling_api.pb.js"
```

---

### Task 10: Inline `team_permissions_lib.js` → `team_permissions.pb.js`

**Files:**
- Modify: `pb_hooks/team_permissions.pb.js`
- Delete: `pb_hooks/team_permissions_lib.js`

- [ ] **Step 1: Read both files**
- [ ] **Step 2: Inline the lib functions**
- [ ] **Step 3: Delete `pb_hooks/team_permissions_lib.js`**
- [ ] **Step 4: Lint** — Run: `npm run lint:hooks`
- [ ] **Step 5: Commit**

```bash
git add pb_hooks/team_permissions.pb.js pb_hooks/team_permissions_lib.js
git commit -m "refactor: inline team_permissions_lib into team_permissions.pb.js"
```

---

### Task 11: Inline `participation_priority_lib.js` → `participation_priority.pb.js`

**Files:**
- Modify: `pb_hooks/participation_priority.pb.js`
- Delete: `pb_hooks/participation_priority_lib.js`

- [ ] **Step 1: Read both files**
- [ ] **Step 2: Inline the lib functions**
- [ ] **Step 3: Delete `pb_hooks/participation_priority_lib.js`**
- [ ] **Step 4: Lint** — Run: `npm run lint:hooks`
- [ ] **Step 5: Commit**

```bash
git add pb_hooks/participation_priority.pb.js pb_hooks/participation_priority_lib.js
git commit -m "refactor: inline participation_priority_lib into participation_priority.pb.js"
```

---

### Task 12: Set safe Docker memory limit

**Files:**
- Modify: `INFRA.md` (update documented memory limits)

- [ ] **Step 1: Set container memory to 2GB**

```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@100.69.245.37 \
  "sudo docker update --memory=2g --memory-swap=3g \$(sudo docker ps --filter 'publish=8093' -q)"
```

- [ ] **Step 2: Update INFRA.md memory table**

Change the PB prod memory limit from `1 GB` to `2 GB` and swap from `1.5 GB` to `3 GB` in the container resources table.

- [ ] **Step 3: Verify health**

```bash
curl -s https://api.kscw.ch/api/health
```
Expected: `{"message":"API is healthy.","code":200}`

- [ ] **Step 4: Commit**

```bash
git add INFRA.md
git commit -m "docs: update PB prod memory limit to 2GB in INFRA.md"
```

---

### Task 13: Final verification

- [ ] **Step 1: Count remaining hook files**

```bash
ls pb_hooks/*.js | wc -l
```
Expected: 34

- [ ] **Step 2: Verify no broken require references**

```bash
grep -r "require(__hooks" pb_hooks/ --include="*.js" | grep -v "email_template_lib\|push_lib" | grep "_lib"
```
Expected: No output (all lib requires eliminated except shared libs)

- [ ] **Step 3: Full lint pass**

Run: `npm run lint:hooks`
Expected: PASS

- [ ] **Step 4: Deploy to dev and test**

Push to `dev` branch, wait for Coolify to redeploy, then verify:
```bash
curl -s https://api-dev.kscw.ch/api/health
```

- [ ] **Step 5: Monitor memory after deploy**

```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@100.69.245.37 \
  "sudo docker stats --no-stream --format '{{.MemUsage}} {{.MemPerc}}' \$(sudo docker ps --filter 'publish=8093' -q)"
```
Expected: Stable memory usage, well below 2 GB limit
