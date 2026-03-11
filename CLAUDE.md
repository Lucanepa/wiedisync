# KSCW Project

## Infrastructure
All infrastructure details (IPs, URLs, ports, credentials, deploy commands) are in **INFRA.md**. Always consult it before making infrastructure-related changes or when you need connection details.

## Tech Stack
- Frontend: React 19 + TypeScript + Vite + TailwindCSS
- Backend: PocketBase (SQLite, REST API, Realtime, Auth)
- Hosting: Cloudflare Pages (frontend), Synology NAS + Cloudflare Tunnel (backend)
- Language: German UI (Swiss German context), code in English

## Data Format: TOON

This project uses TOON (Token-Oriented Object Notation) for passing structured data to LLMs.
TOON combines YAML-style indentation with CSV-style tabular arrays.

### Syntax rules
- Scalar: `key: value`
- Primitive array: `tags[3]: a,b,c`
- Object array: `users[2]{id,name,role}:\n  1,Alice,admin\n  2,Bob,user`
- Nested objects use indentation (like YAML)
- Strings with commas/spaces must be quoted
- Use `encode(data)` from `@toon-format/toon` to convert JSON → TOON

### When to use it
- When passing uniform arrays of objects to LLM prompts (saves ~40% tokens vs JSON)
- NOT for deeply nested/non-uniform data (use JSON-compact there)

### Example
\`\`\`toon
context:
  task: portfolio analysis
positions[3]{ticker,shares,costBasis}:
  AAPL,100,150.25
  MSFT,50,280.00
  NVDA,75,420.50
\`\`\`

## Key Patterns
- **Mobile-first**: All UI must be designed mobile-first — responsive layout, touch-friendly targets (min 44px), and tested on small screens before desktop
- **Dark mode contrast**: Always ensure text/bg contrast in both light and dark mode. Every input, select, textarea must have explicit `dark:bg-gray-700 dark:text-gray-100` (or equivalent). Never leave default browser colors — they break in dark mode.
- **Hallenplan virtual slots**: Games, trainings, and GCal hall events are converted to `HallSlot`-shaped objects at display time (via `_virtual` metadata field) and merged with real `hall_slots`. They're never stored in the DB. See `INFRA.md → Hallenplan Virtual Slots` for the full mapping table.
- PocketBase hooks use isolated scopes — shared code must use `require(__hooks + "/file.js")` with `module.exports`
- `pb_hooks/` is gitignored (contains API keys) — deployed separately via SSH/rsync
- `.env` is gitignored — Cloudflare Pages env vars handle production config

## PocketBase Admin API

- **Use MCP tools, not curl**: Two PocketBase MCP servers are configured (`pocketbase-kscw-prod`, `pocketbase-kscw-dev`). Authenticate once with `auth_admin` per session, then use `list_collections`, `list_records`, `create_record`, etc. See `INFRA.md → MCP Servers` for details.
- **Adding columns/fields and creating records**: Can be done automatically via the API (no confirmation needed)
- **Creating collections**: ALWAYS create via the PB REST API using superuser auth (see INFRA.md for credentials and examples). Never create collections manually in the admin UI. Also update `scripts/setup-collections.ts` for reproducibility.
- **Deleting columns, collections, or records**: Must be confirmed with the user first, but can be executed by the agent

## SSH to NAS

- **Use `ssh nas-ts`** (not `ssh lucanepa@100.64.212.125`). SSH multiplexing is enabled for fast repeated connections.
- Docker needs sudo: `echo '@Bocconi13' | sudo -S /usr/local/bin/docker ...`
- See `INFRA.md → SSH to NAS` for common patterns (deploy hooks, read logs, restart PB).

## Branches
- `main` → production (`kscw.lucanepa.com`)
- `dev` → preview (`dev-kscw.lucanepa.com`)

## Session Workflow

1. **Start of every chat**: Read `CLAUDE.md` and `INFRA.md` to get full project context before doing anything.
2. **End of every chat**: After finishing changes, append a few context lines to the **Changelog** section below summarizing what was done (date, short description). If entries get stale or redundant, overwrite with newer comments — keep it concise.

## Changelog
<!-- Grouped by feature domain. Overwrite when stale. -->
- **2026-03-11** — Unified email templates: created shared `email_template_lib.js` with branded dark-mode layout (KSCW logo, sport accent stripes, info cards, alert boxes, CTA buttons, plain-text fallbacks). Refactored all 4 email-sending hooks (`scorer_reminders_lib.js`, `participation_reminders.pb.js`, `game_scheduling_api.pb.js`, `slot_claims.pb.js`) to use the shared template. All emails now have consistent branding, proper HTML+plain-text, and sport-aware accent colors (VB gold, BB orange).
- **2026-03-11** — PocketBase upgrade: v0.23.12 → v0.36.6. Docker image switched from `spectado/pocketbase:latest` to `adrianmusante/pocketbase:0.36.6`. DB auto-migrated, all E2E tests pass. Backup at `pb_data_backup_20260311`. Key changes: CRUD API rules now checked before hooks (v0.27), extra relation filter checks (v0.32), list query optimizations (v0.36).
- **2026-03-11** — Schreibereinsätze delegation: duty delegation feature (`scorer_delegations` collection). Assigned members can delegate duties — same-team instant transfer, cross-team requires confirmation (updates both `*_member` and `*_duty_team`). DelegationModal with member search (split by team), DelegationRequestBanner for incoming requests, `useScorerDelegations` hook. AssignmentEditor split: admin gets dropdowns, regular users get read-only + "Weitergeben" button. PB hook (`scorer_delegation.pb.js`) handles validation, transfer, notifications, daily expiry cron. NotificationPanel extended with `duty_delegation_request` type.
- **2026-03-11** — Scorer reminders: fixed date filter bug (PB datetime vs plain date mismatch — used range filter), added `app_settings` collection with `scorer_reminders_enabled` toggle (default: off), superuser-only toggle in ScorerPage UI. Added dry-run endpoints (`/api/scorer-reminders/dry-run` for fake data, `/api/scorer-reminders/dry-run-game` for real game data). Currently VB-only (`source = "swiss_volley"`).
- **2026-03-11** — ID standardization: Renamed `sv_game_id` → `game_id`, `sv_team_id` → `team_id`, `bp_team_id` → `bb_source_id` across PB collections, hooks, and frontend. Added `vb_`/`bb_` prefixes to all IDs (stored in DB, stripped in UI). Renamed `sv_rankings` collection → `rankings`, `SvRanking` type → `Ranking`, `svTeamIds` → `teamIds`. Fixed BB game numbers (`g.id` → `g.gameNumber`). Convention: `vb_` for volleyball, `bb_` for basketball.
- **2026-03-11** — Repo cleanup: deleted duplicate root logos, unused assets (`kscw_gelb.png`, `kscw_trio.png`), dead code (`CoachRoute`, `LanguageToggle`, `useEventSessions`, `useParticipationSummary`, `swiss-volley.ts`), completed migration scripts, stale `PROJECT_SPEC.md`, `scorer_email_preview.html`, `clubdesk-theme.css`. Consolidated changelog. Updated CONTINGENCY.md and INFRA.md. Fixed a11y violations (color contrast, heading order, empty headings, scrollable regions, TeamChip readability) and login test strict mode (`exact: true`).
- **2026-03-10** — Auth & roles: Google OAuth login via Authentik. Sport-scoped admin roles (`vb_admin`, `bb_admin`) with `hasAdminAccessToSport`/`hasAdminAccessToTeam` in `useAuth`. Profile onboarding modal with per-user language preference. Two-branch signup + approval system with PendingPage. Role hierarchy: user → coach/team_responsible → vb_admin/bb_admin → admin → superuser. Team leadership (coach, captain, team_responsible) as multi-relations on `teams`.
- **2026-03-10** — Basketball: Basketplan sync via public XML API (`bp_sync.pb.js`, cron 06:05 UTC). 19 BB teams, 196 games, rankings. `bb_source_id` on teams (raw Basketplan ID), `basketplan` game source. Sport-scoped positions (VB: setter/libero/etc, BB: point_guard/center/etc) with array values, normalization guard, and sport-aware option filtering.
- **2026-03-09** — Terminplanung: game scheduling module with 4 PB collections, 7 API endpoints, conflict detection (same-day, gaps, cross-team, closures). Admin UI (`/admin/terminplanung` + dashboard), public opponent flow with Turnstile CAPTCHA. Excel import/export. Email notifications on booking confirmation.
- **2026-03-09** — Notifications & logging: `notifications` collection with PB hooks for activity changes, results, cancellations, reminders (cron 06:30 UTC). `user_logs` audit trail with `logActivity()` and `useMutation` auto-logging. NotificationBell, NotificationPanel, HomePage news section.
- **2026-03-06** — Hallenplan: virtual slots (games, trainings, GCal events), slot claims (FREI/claimed), hall closures (Schulferien + GCal + manual), pre-game shortening, Spielhalle shared slots. ClosureManager with grouped view. PB hooks for claim validation + auto-revocation.
- **2026-03-04** — Participation: RSVP on games/trainings/events with `ParticipationButton`/`ParticipationSummary`/`ParticipationRosterModal`. Coach deadlines (`respond_by`), `max_players` on events, PB hook for email reminders (cron 07:00 UTC). Team visibility filtering (users see own teams only).
- **2026-03-02** — Testing: Playwright E2E (223 tests, 4 projects, 6 categories: a11y, readability, overflow, sizing, grid-layout, mobile-ui). GitHub Actions CI. axe-core WCAG scanning. Vitest unit tests for `memberPositions.ts`. 8 test accounts (user/vorstand/admin/superuser/coach/unapproved/vb_admin/bb_admin).
- **2026-03-01** — Admin tools: native DB panel (SQL Editor, TableBrowser, SchemaViewer, RecordEditModal). ClubDesk CSV sync. Security hardening (filter injection, XSS, rate limiting, PII minimization, security headers).
- **2026-02-28** — Core platform: teams/members schema (birthdate, photos, sponsors, slug URLs, RosterEditor), Schreibereinsätze integration (scorer licences, assignments, iCal export), HomePage (games + events), calendar (home/away colors), DB relations cleanup.
