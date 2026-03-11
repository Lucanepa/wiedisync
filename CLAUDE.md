# KSCW Project

## Infrastructure
All infrastructure details (IPs, URLs, ports, credentials, deploy commands) are in **INFRA.md**. Always consult it before making infrastructure-related changes or when you need connection details.

## Tech Stack
- Frontend: React 19 + TypeScript + Vite + TailwindCSS
- Backend: PocketBase (SQLite, REST API, Realtime, Auth)
- Hosting: Cloudflare Pages (frontend), Synology NAS + Cloudflare Tunnel (backend)
- Language: German UI (Swiss German context), code in English

## Key Patterns
- **Mobile-first**: All UI must be designed mobile-first — responsive layout, touch-friendly targets (min 44px), and tested on small screens before desktop
- **Dark mode contrast**: Always ensure text/bg contrast in both light and dark mode. Every input, select, textarea must have explicit `dark:bg-gray-700 dark:text-gray-100` (or equivalent). Never leave default browser colors — they break in dark mode.
- **Hallenplan virtual slots**: Games, trainings, and GCal hall events are converted to `HallSlot`-shaped objects at display time (via `_virtual` metadata field) and merged with real `hall_slots`. They're never stored in the DB. See `INFRA.md → Hallenplan Virtual Slots` for the full mapping table.
- PocketBase hooks use isolated scopes — shared code must use `require(__hooks + "/file.js")` with `module.exports`
- `pb_hooks/` is gitignored (contains API keys) — deployed separately via SSH/rsync
- `.env` is gitignored — Cloudflare Pages env vars handle production config

## PocketBase Admin API

- **Adding columns/fields and creating records**: Can be done automatically via the API (no confirmation needed)
- **Deleting columns, collections, or records**: Must be confirmed with the user first, but can be executed by the agent

## Branches
- `main` → production (`kscw.lucanepa.com`)
- `dev` → preview (`dev-kscw.lucanepa.com`)

## Session Workflow

1. **Start of every chat**: Read `CLAUDE.md` and `INFRA.md` to get full project context before doing anything.
2. **End of every chat**: After finishing changes, append a few context lines to the **Changelog** section below summarizing what was done (date, short description). If entries get stale or redundant, overwrite with newer comments — keep it concise.

## Changelog
<!-- Grouped by feature domain. Overwrite when stale. -->
- **2026-03-11** — Repo cleanup: deleted duplicate root logos, unused assets (`kscw_gelb.png`, `kscw_trio.png`), dead code (`CoachRoute`, `LanguageToggle`, `useEventSessions`, `useParticipationSummary`, `swiss-volley.ts`), completed migration scripts, stale `PROJECT_SPEC.md`, `scorer_email_preview.html`, `clubdesk-theme.css`. Consolidated changelog. Updated CONTINGENCY.md and INFRA.md. Fixed a11y violations (color contrast, heading order, empty headings, scrollable regions, TeamChip readability) and login test strict mode (`exact: true`).
- **2026-03-10** — Auth & roles: Google OAuth login via Authentik. Sport-scoped admin roles (`vb_admin`, `bb_admin`) with `hasAdminAccessToSport`/`hasAdminAccessToTeam` in `useAuth`. Profile onboarding modal with per-user language preference. Two-branch signup + approval system with PendingPage. Role hierarchy: user → coach/team_responsible → vb_admin/bb_admin → admin → superuser. Team leadership (coach, captain, team_responsible) as multi-relations on `teams`.
- **2026-03-10** — Basketball: Basketplan sync via public XML API (`bp_sync.pb.js`, cron 06:05 UTC). 19 BB teams, 196 games, rankings. `bp_team_id` on teams, `basketplan` game source. Sport-scoped positions (VB: setter/libero/etc, BB: point_guard/center/etc) with array values, normalization guard, and sport-aware option filtering.
- **2026-03-09** — Terminplanung: game scheduling module with 4 PB collections, 7 API endpoints, conflict detection (same-day, gaps, cross-team, closures). Admin UI (`/admin/terminplanung` + dashboard), public opponent flow with Turnstile CAPTCHA. Excel import/export. Email notifications on booking confirmation.
- **2026-03-09** — Notifications & logging: `notifications` collection with PB hooks for activity changes, results, cancellations, reminders (cron 06:30 UTC). `user_logs` audit trail with `logActivity()` and `useMutation` auto-logging. NotificationBell, NotificationPanel, HomePage news section.
- **2026-03-06** — Hallenplan: virtual slots (games, trainings, GCal events), slot claims (FREI/claimed), hall closures (Schulferien + GCal + manual), pre-game shortening, Spielhalle shared slots. ClosureManager with grouped view. PB hooks for claim validation + auto-revocation.
- **2026-03-04** — Participation: RSVP on games/trainings/events with `ParticipationButton`/`ParticipationSummary`/`ParticipationRosterModal`. Coach deadlines (`respond_by`), `max_players` on events, PB hook for email reminders (cron 07:00 UTC). Team visibility filtering (users see own teams only).
- **2026-03-02** — Testing: Playwright E2E (223 tests, 4 projects, 6 categories: a11y, readability, overflow, sizing, grid-layout, mobile-ui). GitHub Actions CI. axe-core WCAG scanning. Vitest unit tests for `memberPositions.ts`. 8 test accounts (user/vorstand/admin/superuser/coach/unapproved/vb_admin/bb_admin).
- **2026-03-01** — Admin tools: native DB panel (SQL Editor, TableBrowser, SchemaViewer, RecordEditModal). ClubDesk CSV sync. Security hardening (filter injection, XSS, rate limiting, PII minimization, security headers).
- **2026-02-28** — Core platform: teams/members schema (birthdate, photos, sponsors, slug URLs, RosterEditor), Schreibereinsätze integration (scorer licences, assignments, iCal export), HomePage (games + events), calendar (home/away colors), DB relations cleanup.
