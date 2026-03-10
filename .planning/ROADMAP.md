# Roadmap: KSCW v1.0 — Admin/Member Separation

## Overview

This milestone separates the admin experience from the member experience across the KSCW platform. It starts by building the mode-switching infrastructure (context provider, persistence, role gating), then adds the visible toggle UI, then migrates all existing pages to respect the mode, and finally validates everything with E2E tests. When complete, admins see a clean member view by default and can switch to admin mode when they need management powers.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - AdminModeProvider context, useAdminMode hook, AdminOnly wrapper, persistence
- [x] **Phase 2: Toggle UI** - Admin mode toggle in navigation, visual indicator, auto-activation on admin routes (completed 2026-03-10)
- [x] **Phase 3: Page Migration** - Audit and migrate all isAdmin conditionals to respect admin mode across ~14 files (completed 2026-03-10)
- [x] **Phase 4: Testing** - E2E tests validating toggle visibility, member mode filtering, and admin mode controls (completed 2026-03-11)

## Phase Details

### Phase 1: Foundation
**Goal**: Admin mode infrastructure exists and correctly gates admin-level features based on mode state
**Depends on**: Nothing (first phase)
**Requirements**: MODE-01, MODE-02, MODE-03, MODE-04
**Success Criteria** (what must be TRUE):
  1. An admin user can call a function to toggle between admin mode and member mode, and the mode value is available throughout the component tree
  2. After toggling admin mode ON, refreshing the browser retains the mode state
  3. Opening the app in a new session starts in member mode (toggle OFF)
  4. A regular user (non-admin) has no access to admin mode state or toggle functionality — the context reports member mode unconditionally
**Plans:** 1/1 plans complete

Plans:
- [x] 01-01-PLAN.md — AdminModeProvider context, useAdminMode hook, AdminOnly wrapper, App.tsx wiring

### Phase 2: Toggle UI
**Goal**: Admins can visually switch between admin and member mode from any page
**Depends on**: Phase 1
**Requirements**: TOGGLE-01, TOGGLE-02, TOGGLE-03
**Success Criteria** (what must be TRUE):
  1. An admin user sees the admin mode toggle in the desktop sidebar and in the mobile MoreSheet
  2. When admin mode is active, a visual indicator (e.g. gold accent bar or badge) is visible on screen to clearly distinguish the mode
  3. Navigating to any `/admin/*` route automatically activates admin mode if it was off
  4. A regular user sees no toggle, no indicator, and no admin mode UI in sidebar or MoreSheet
**Plans:** 1/1 plans complete

Plans:
- [x] 02-01-PLAN.md — AdminToggle component, Layout/MoreSheet integration, nav gating, visual indicator, auto-activation

### Phase 3: Page Migration
**Goal**: Regular pages show a clean member experience with no admin noise, while coach features remain untouched
**Depends on**: Phase 2
**Requirements**: PAGE-01, PAGE-02, PAGE-03, PAGE-04, PAGE-05
**Success Criteria** (what must be TRUE):
  1. An admin user in member mode sees only their own teams on pages like Games, Trainings, Teams, and Calendar — identical to what a regular member sees
  2. An admin user in member mode sees no inline edit buttons, management controls, or admin-only UI elements on any page
  3. A coach user sees training CRUD, attendance management, and roster editing for their own teams regardless of admin mode state
  4. Admin nav links (e.g. /admin/database, /admin/terminplanung) are hidden from the sidebar and MoreSheet when admin mode is OFF
  5. An admin user in admin mode sees all teams and all inline admin controls — the current full-access behavior is preserved
**Plans:** 2/2 plans complete

Plans:
- [x] 03-01-PLAN.md — Migrate Hallenplan module and Calendar HallenplanView to respect admin mode
- [x] 03-02-PLAN.md — Migrate Teams, Scorer, and Trainings modules to respect admin mode

### Phase 4: Testing
**Goal**: E2E tests confirm the admin/member separation works correctly across roles and modes
**Depends on**: Phase 3
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. An E2E test verifies that an admin user sees the admin toggle and a regular user does not
  2. An E2E test verifies that an admin with toggle OFF sees only their own teams (member-filtered view)
  3. An E2E test verifies that an admin with toggle ON sees edit controls and management UI on pages
**Plans:** 1/1 plans complete

Plans:
- [x] 04-01-PLAN.md — E2E tests for admin toggle visibility, member mode team filtering, and admin mode UI controls

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/1 | Complete    | 2026-03-10 |
| 2. Toggle UI | 1/1 | Complete   | 2026-03-10 |
| 3. Page Migration | 2/2 | Complete | 2026-03-10 |
| 4. Testing | 1/1 | Complete | 2026-03-11 |
