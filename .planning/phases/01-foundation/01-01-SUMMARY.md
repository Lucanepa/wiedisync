---
phase: 01-foundation
plan: 01
subsystem: ui
tags: [react, context, hooks, localStorage, admin-mode]

# Dependency graph
requires: []
provides:
  - AdminModeProvider context with localStorage persistence
  - useAdminMode hook exposing isAdminMode, toggleAdminMode, setAdminMode, effectiveIsAdmin, effectiveIsCoach
  - AdminOnly conditional rendering wrapper component
affects: [02-toggle-ui, 03-page-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Context + hook pattern (createContext null default, Provider with useState + localStorage, hook with null check) matching useTheme.tsx"
    - "Role-gated derived state: effectiveIsCoach derives from coachTeamIds only when admin mode OFF"
    - "useMemo for context value to prevent unnecessary re-renders"

key-files:
  created:
    - src/hooks/useAdminMode.tsx
    - src/components/AdminOnly.tsx
  modified:
    - src/App.tsx

key-decisions:
  - "Followed useTheme.tsx pattern exactly for consistency across all context providers"
  - "No unit test framework added - project uses Playwright E2E only, verified via tsc --noEmit and existing E2E tests"

patterns-established:
  - "AdminModeProvider as separate context from AuthContext to avoid re-render cascade"
  - "effectiveIsCoach/effectiveIsAdmin as derived flags that replace direct useAuth role checks in UI"

requirements-completed: [MODE-01, MODE-02, MODE-03, MODE-04]

# Metrics
duration: 2min
completed: 2026-03-10
---

# Phase 1 Plan 1: Admin Mode Infrastructure Summary

**AdminModeProvider context with localStorage persistence, role-gated derived flags, and AdminOnly wrapper component**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T17:06:38Z
- **Completed:** 2026-03-10T17:08:51Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- AdminModeProvider context with isAdminMode, toggleAdminMode, setAdminMode, effectiveIsAdmin, effectiveIsCoach
- localStorage persistence with key "kscw-admin-mode", default OFF (member mode)
- Non-admin users always get false values regardless of localStorage state
- effectiveIsCoach correctly derives from coachTeamIds only when mode OFF (no isAdmin grant leak)
- AdminOnly wrapper for conditional rendering of admin-only UI elements
- Provider correctly nested in App.tsx (ThemeProvider > AuthProvider > AdminModeProvider > BrowserRouter)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AdminModeProvider and useAdminMode hook** - `b9f8a96` (feat)
2. **Task 2: Create AdminOnly wrapper and wire provider into App.tsx** - `e312d93` (feat)

## Files Created/Modified
- `src/hooks/useAdminMode.tsx` - AdminModeProvider context and useAdminMode hook (64 lines)
- `src/components/AdminOnly.tsx` - Conditional rendering wrapper for admin-only UI (7 lines)
- `src/App.tsx` - Added AdminModeProvider import and nesting between AuthProvider and BrowserRouter

## Decisions Made
- Followed useTheme.tsx pattern exactly for consistency (createContext null, Provider with useState, hook with null check)
- No unit test framework added -- project uses Playwright E2E only; verified via tsc --noEmit and existing E2E tests (7/7 passed)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in hallenplan, scorer, and trainings modules cause `tsc -b` (used in `npm run build`) to fail. These are unrelated to this plan's changes. `npx tsc --noEmit` passes for this plan's files. Logged to deferred items.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- AdminModeProvider and useAdminMode hook ready for Phase 2 (toggle UI in sidebar/header)
- AdminOnly wrapper ready for Phase 3 (wrapping admin-only UI elements)
- No blockers

---
*Phase: 01-foundation*
*Completed: 2026-03-10*

## Self-Check: PASSED
