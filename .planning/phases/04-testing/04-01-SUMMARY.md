---
phase: 04-testing
plan: 01
subsystem: testing
tags: [playwright, e2e, admin-mode, role-gating]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: AdminModeProvider context and useAdminMode hook
  - phase: 02-toggle-ui
    provides: AdminToggle component with SwitchToggle role="switch"
  - phase: 03-page-migration
    provides: effectiveIsAdmin gating on TeamsPage and Layout admin nav
provides:
  - E2E test coverage for admin/member mode separation (5 tests)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [addInitScript for localStorage pre-seeding, desktop sidebar expansion helper, project-name skip for mobile]

key-files:
  created: [e2e/tests/member/admin-mode.spec.ts]
  modified: []

key-decisions:
  - "Used addInitScript instead of evaluate+reload to avoid auth token refresh rate limiting"
  - "Desktop-only tests (sidebar-dependent) with mobile skip via project.name check"
  - "Toggle click instead of localStorage swap for member-mode filtering to avoid addInitScript persistence on reload"

patterns-established:
  - "expandSidebar helper: click collapsed rail logo, wait 300ms for CSS transition"
  - "Bilingual aria-label matching: /admin.?mod|member.?mod|mitglied.?mod/i for EN/DE"

requirements-completed: [TEST-01, TEST-02, TEST-03]

# Metrics
duration: 15min
completed: 2026-03-11
---

# Phase 04 Plan 01: Admin Mode E2E Testing Summary

**Playwright E2E tests validating admin toggle visibility, member-mode team filtering, and admin-mode gold bar + nav links**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-10T23:17:22Z
- **Completed:** 2026-03-10T23:32:43Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- 5 passing E2E tests covering all three test requirements (TEST-01, TEST-02, TEST-03)
- Admin toggle visibility: admin sees switch, regular user does not
- Member mode filtering: admin toggle OFF shows fewer teams than toggle ON
- Admin mode controls: gold border bar and admin nav links (Spielplanung, Hallenplan, Terminplanung) visible only in admin mode
- Full Playwright suite regression-free (223 passed, 29 skipped, 0 failed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create admin-mode E2E spec with all three test blocks** - `e629ca7` (test)

## Files Created/Modified
- `e2e/tests/member/admin-mode.spec.ts` - 5 E2E tests across 4 describe blocks covering admin toggle visibility, team filtering, and admin UI controls

## Decisions Made
- Used `page.addInitScript()` to pre-seed `kscw-admin-mode` localStorage before navigation, avoiding auth refresh race conditions from evaluate+reload patterns
- Made tests desktop-only (skip on mobile project) since they depend on the sidebar which only renders at >= 1024px viewport
- For team filtering test, used sidebar toggle click instead of localStorage+reload to avoid `addInitScript` persistence across reloads
- Used href-based selectors (`a[href="/admin/spielplanung"]`) instead of text selectors for admin nav link assertions to avoid i18n dependency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed aria-label regex for bilingual support**
- **Found during:** Task 1
- **Issue:** Plan specified `/admin-modus|mitglied-modus/i` but admin storage state uses English locale, yielding "Admin Mode"/"Member Mode" labels
- **Fix:** Changed regex to `/admin.?mod|member.?mod|mitglied.?mod/i` to match both EN and DE
- **Files modified:** e2e/tests/member/admin-mode.spec.ts
- **Verification:** Tests pass with English-locale admin user
- **Committed in:** e629ca7

**2. [Rule 1 - Bug] Added sidebar expansion before toggle assertions**
- **Found during:** Task 1
- **Issue:** AdminToggle is inside the expanded sidebar panel, which starts collapsed (translate-x-full). Plan did not account for sidebar needing expansion.
- **Fix:** Added `expandSidebar()` helper that clicks the KSCW logo to open the sidebar panel
- **Files modified:** e2e/tests/member/admin-mode.spec.ts
- **Verification:** Toggle and nav link assertions work after sidebar expansion
- **Committed in:** e629ca7

**3. [Rule 3 - Blocking] Avoided auth refresh rate limiting via addInitScript**
- **Found during:** Task 1
- **Issue:** Using evaluate+reload pattern caused PB authRefresh to fire multiple times across parallel test workers, triggering rate limits that cleared auth and caused login redirects
- **Fix:** Used `page.addInitScript()` to set localStorage before initial navigation, eliminating need for reload
- **Files modified:** e2e/tests/member/admin-mode.spec.ts
- **Verification:** All tests pass reliably without auth failures
- **Committed in:** e629ca7

**4. [Rule 1 - Bug] Handled test_admin user having no team assignments**
- **Found during:** Task 1
- **Issue:** Plan assumed admin has >= 1 team in member mode, but test_admin has 0 team assignments. Team filtering test failed with "No team assigned" empty state.
- **Fix:** Reversed test order: start in admin mode (all teams visible), then toggle to member mode (0 teams), assert adminModeCount > memberModeCount
- **Files modified:** e2e/tests/member/admin-mode.spec.ts
- **Verification:** Test correctly asserts 26 admin-mode teams > 0 member-mode teams
- **Committed in:** e629ca7

---

**Total deviations:** 4 auto-fixed (2 bugs, 1 blocking, 1 bug)
**Impact on plan:** All fixes necessary for tests to run correctly in the actual test environment. No scope creep.

## Issues Encountered
- PocketBase rate limiting (2 auth req / 3s) causes auth refresh failures when multiple test workers reload pages simultaneously. Solved by using `addInitScript` to avoid extra reloads.
- Pre-existing login test flake (`e2e/tests/auth/login.spec.ts`) observed once during full suite run -- unrelated to admin-mode changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 4 phases of the admin/member mode milestone are complete
- E2E test coverage validates the full feature chain: context provider, toggle UI, page migration, and behavioral correctness

---
*Phase: 04-testing*
*Completed: 2026-03-11*
