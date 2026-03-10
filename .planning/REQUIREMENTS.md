# Requirements: KSCW

**Defined:** 2026-03-10
**Core Value:** Club members can see their upcoming games, trainings, and hall schedules at a glance — and coaches/admins can manage everything from one place.

## v1.0 Requirements

Requirements for admin/member separation. Each maps to roadmap phases.

### Admin Mode Infrastructure

- [x] **MODE-01**: Admin/superuser user can toggle between admin mode and member mode
- [x] **MODE-02**: Admin mode state persists across page navigation and browser refresh (localStorage)
- [x] **MODE-03**: Admin mode defaults to OFF (member mode) for new sessions
- [x] **MODE-04**: Non-admin users never see or interact with admin mode features

### Toggle UI

- [x] **TOGGLE-01**: Admin mode toggle is visible in sidebar (desktop) and MoreSheet (mobile) for admin/superuser only
- [x] **TOGGLE-02**: Visual indicator (e.g. gold accent bar) clearly shows when admin mode is active
- [x] **TOGGLE-03**: Admin mode auto-activates when navigating to `/admin/*` routes

### Page Migration

- [x] **PAGE-01**: In member mode, pages filter data to user's own teams only
- [x] **PAGE-02**: In member mode, admin inline controls (edit buttons, management UI) are hidden
- [x] **PAGE-03**: Coach features (training CRUD, attendance, roster for own teams) remain visible regardless of admin mode
- [x] **PAGE-04**: Admin nav links (/admin/*) are hidden in member mode
- [x] **PAGE-05**: In admin mode, all teams and inline admin controls are visible (current behavior)

### Testing

- [x] **TEST-01**: E2E test for admin toggle visibility (admin sees it, regular user does not)
- [x] **TEST-02**: E2E test for member mode filtering (admin with toggle OFF sees only own teams)
- [x] **TEST-03**: E2E test for admin mode inline controls (admin with toggle ON sees edit controls)

## Future Requirements

### Admin UX Enhancements

- **ADMIN-01**: Admin dashboard with at-a-glance club stats
- **ADMIN-02**: Audit log viewer in admin area

## Out of Scope

| Feature | Reason |
|---------|--------|
| Permission system rewrite | Existing roles (user, vorstand, admin, superuser, coach) work fine |
| Backend/API changes | This is a frontend-only architecture change |
| New feature modules | v1.0 focuses only on UX separation |
| Vorstand toggle access | Only ~3 admins need this, vorstand can use existing access |
| Route mirroring (/admin/games etc.) | Research rejected this — context-based rendering is better for this codebase |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MODE-01 | Phase 1: Foundation | Complete |
| MODE-02 | Phase 1: Foundation | Complete |
| MODE-03 | Phase 1: Foundation | Complete |
| MODE-04 | Phase 1: Foundation | Complete |
| TOGGLE-01 | Phase 2: Toggle UI | Complete |
| TOGGLE-02 | Phase 2: Toggle UI | Complete |
| TOGGLE-03 | Phase 2: Toggle UI | Complete |
| PAGE-01 | Phase 3: Page Migration | Complete |
| PAGE-02 | Phase 3: Page Migration | Complete |
| PAGE-03 | Phase 3: Page Migration | Complete |
| PAGE-04 | Phase 3: Page Migration | Complete |
| PAGE-05 | Phase 3: Page Migration | Complete |
| TEST-01 | Phase 4: Testing | Complete |
| TEST-02 | Phase 4: Testing | Complete |
| TEST-03 | Phase 4: Testing | Complete |

**Coverage:**

- v1.0 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-11 after Phase 4 completion*
