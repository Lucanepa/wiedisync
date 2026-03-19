# KSCW Project

## Infrastructure
All infrastructure details (IPs, URLs, ports, credentials, deploy commands) are in **INFRA.md**. Always consult it before making infrastructure-related changes or when you need connection details.

## Tech Stack
- Frontend: React 19 + TypeScript + Vite + TailwindCSS v4 + shadcn/ui
- UI Components: shadcn/ui primitives in `src/components/ui/` (lowercase), KSCW wrappers in `src/components/` (PascalCase)
- Backend: PocketBase (SQLite, REST API, Realtime, Auth)
- Hosting: Cloudflare Pages (frontend), Infomaniak VPS + Cloudflare Tunnel (backend)
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

## Work Style

- **Maximize parallel subagents**: When a task involves multiple independent pieces of work (e.g. editing different files, researching separate topics, running independent checks), always dispatch them as parallel subagents rather than doing them sequentially. This applies to exploration, implementation, testing, and any other work that doesn't have sequential dependencies.

## Key Patterns
- **shadcn/ui**: UI components use shadcn/ui on Tailwind CSS v4. Load `/kscw-shadcn` skill for KSCW-specific conventions (brand theming, component wrappers, migration map). Load `/tailwind-v4-shadcn` for general TW v4 + shadcn patterns. Full migration spec: `docs/superpowers/specs/2026-03-15-shadcn-migration-design.md`
- **Mobile-first**: All UI must be designed mobile-first — responsive layout, touch-friendly targets (min 44px), and tested on small screens before desktop
- **Dark mode contrast**: Always ensure text/bg contrast in both light and dark mode. Use shadcn semantic tokens (`bg-background`, `text-foreground`, `bg-primary`) which auto-switch in dark mode. For non-semantic colors, add explicit `dark:` variants.
- **Hallenplan virtual slots**: Games, trainings, and GCal hall events are converted to `HallSlot`-shaped objects at display time (via `_virtual` metadata field) and merged with real `hall_slots`. They're never stored in the DB. See `INFRA.md → Hallenplan Virtual Slots` for the full mapping table.
- PocketBase hooks use isolated scopes — shared code must use `require(__hooks + "/file.js")` with `module.exports`
- `pb_hooks/` is gitignored (contains API keys) — deployed separately via SSH/rsync
- `.env` is gitignored — Cloudflare Pages env vars handle production config
- **Troubleshooting**: When you encounter and solve an error, document it in `INFRA.md → Troubleshooting & Gotchas`. Check that section FIRST before debugging — the fix may already be documented.

## PocketBase Admin API

- **Use MCP tools, not curl**: Two PocketBase MCP servers are configured (`pocketbase-kscw-prod`, `pocketbase-kscw-dev`). Authenticate once with `auth_admin` per session, then use `list_collections`, `list_records`, `create_record`, etc. See `INFRA.md → MCP Servers` for details.
- **Adding columns/fields and creating records**: Can be done automatically via the API (no confirmation needed)
- **Creating collections**: ALWAYS create via the PB REST API using superuser auth (see INFRA.md for credentials and examples). Never create collections manually in the admin UI. Also update `scripts/setup-collections.ts` for reproducibility.
- **Deleting columns, collections, or records**: Must be confirmed with the user first, but can be executed by the agent

## SSH to VPS (PocketBase host)

- **Use `ssh -i ~/.ssh/id_ed25519 ubuntu@100.69.245.37`** to reach the Infomaniak VPS where KSCW PocketBase runs.
- PocketBase is a systemd service: `sudo systemctl restart pocketbase-kscw`
- Deploy hooks via `scp` + `sudo cp` to `/opt/pocketbase-kscw/pb_hooks/`
- See `INFRA.md → SSH to VPS` for common patterns (deploy hooks, read logs, restart PB).

### SQLite Safety Rules (CRITICAL)

PocketBase uses SQLite. Violating these rules **will corrupt the database** (happened 2026-03-16, required restore from backup):

1. **NEVER run `sqlite3` directly against the live DB** while PocketBase is running. Use PB's API/MCP tools or the in-app SQL Editor instead.
2. **NEVER start a second PocketBase instance** pointing at the same `pb_data` directory. Two writers = guaranteed corruption.
3. **NEVER bulk-move/delete all hooks** from `pb_hooks/` as a debugging strategy. Instead, rename the suspect file to `.disabled` and restart.
4. **If you need raw SQL access**, stop PocketBase first (`sudo systemctl stop pocketbase-kscw`), run your queries, then restart. Never have two processes writing to the same SQLite file.
5. **To debug a crashing hook**, use binary search: rename half the hooks to `.disabled`, restart, check logs. Narrow down the broken file without removing everything.

## Domains & Hosting

- **`kscw.ch`** — currently ClubDesk (external). Will eventually be migrated to point at KSCW platform. **Do NOT change until explicitly confirmed.**
- **`wiedisync.kscw.ch`** — React app (Wiedisync) production, CF Pages project `kscw`
- **`dev.wiedisync.kscw.ch`** — React app dev/preview, CF Pages project `kscw` (dev branch)
- **`api.kscw.ch`** — PocketBase API production, CF Tunnel → VPS `:8091`
- **`api-dev.kscw.ch`** — PocketBase API dev, CF Tunnel → VPS `:8092`
- **`kscw-website.pages.dev`** — Public club website (static HTML), CF Pages project `kscw-website`. **Deploy to dev/preview only** until further notice — do NOT push website changes to production.
- **`kscw-push.lucanepa.workers.dev`** — Web push CF Worker

See `INFRA.md → Domains & Hosting Overview` for full domain map, future migration plan, and hardcoded URL reference table.

## Branches & Dev-First Workflow

- `main` → production (`wiedisync.kscw.ch`, PB: `api.kscw.ch`)
- `dev` → preview (`dev.wiedisync.kscw.ch`, PB: `api-dev.kscw.ch`)

**All changes go through `dev` first.** Never push directly to `main`. When asked to push/deploy Wiedisync or the public website, always push to `dev` unless explicitly told to push to `main`/production. Workflow:

1. Develop and commit on `dev` branch
2. Deploy frontend to dev (push `dev` → Cloudflare Pages preview)
3. Deploy hooks to dev PB (`/opt/pocketbase-kscw-dev/pb_hooks/`, restart `pocketbase-kscw-dev`)
4. Test on `dev.wiedisync.kscw.ch` against `api-dev.kscw.ch`
5. Once confirmed working, merge `dev` → `main` (with user approval)
6. Deploy hooks to prod PB and push `main` to trigger production build

**Dev PB daily sync**: A cron job at 04:00 UTC copies prod `pb_data` to dev PB daily (script: `/opt/pocketbase-kscw-dev/sync-from-prod.sh`, log: `/var/log/pocketbase-kscw-dev-sync.log`). Hooks are NOT synced — they stay as deployed to dev.

## Session Workflow

1. **Start of every chat**: Read `CLAUDE.md` and `INFRA.md` to get full project context before doing anything.
2. **End of every chat**: After finishing changes, append a few context lines to the **Changelog** section below summarizing what was done (date, short description). If entries get stale or redundant, overwrite with newer comments — keep it concise.

## Changelog
<!-- Grouped by feature domain. Overwrite when stale. -->
- **2026-03-17** — Website: Instagram embeds on team pages. Scraped kscw.ch for team-specific IG accounts (H1: `kscw_h1`, H3: `h3_kscw`, D2: `kscwvolleyd2`, HU23: `kscw_vbu23`). Set `social_url` on teams in PB (prod+dev). Exposed `social_url` in public team API. Added `instagram-media` blockquote embed via IG `embed.js` at bottom of each team page (only shown when `social_url` is set). i18n keys for DE/EN. Website now dev-only deployment until further notice.
- **2026-03-17** — KSCW public website (now in separate `kscw-website` repo, deployed to `kscw-website.pages.dev`; `website_draft/` deleted from this repo): Full static site with dynamic team pages. Single `team.html` template renders all 16+ teams via `/api/public/team/{id}` hook (roster, trainings, games, rankings, team photo, coach/captain). Clean URLs (`/volleyball/h1`, `/basketball/lions`) via CF Pages `_worker.js`. Shared nav from `partials/header.html` loaded dynamically. Samsung dark mode fix (`forced-color-adjust`). Mobile-responsive game rows. Team overview pages with PB team photos as card backgrounds. Promotion/relegation color bands on volleyball rankings. Public PB hook: `pb_hooks/public_team_data.pb.js` (GET `/api/public/team/{id}` + GET `/api/public/teams`). Opened `teams`, `games`, `rankings` collections for public read. Contact page with VB/BB contacts.
- **2026-03-16** — Removed multi-club infrastructure entirely: deleted `clubs` collection, removed `club` relation field from all 20 domain collections (19 original + `news`), cleaned API rules referencing club, deleted `src/clubConfig.ts`, `pb_hooks/club_defaults.pb.js`, removed `clubId` from `useAuth` context and all auto-injection logic in `usePB`/`useMutation`/`useRealtime`/`useTeamMembers`. Cleaned `sv_sync_lib.js`, `bp_sync_lib.js`, `setup-collections.ts`, `RosterEditor`, `PlayerProfile`, `ProfileEditModal`. KSCW is a single-club platform — no multi-tenancy needed.
- **2026-03-13** — KSCW PocketBase migrated from Synology NAS (Docker) to Infomaniak VPS (native systemd service at `/opt/pocketbase-kscw/`, port 8091). New Cloudflare tunnel `kscw-vps` routes `api.kscw.ch` → VPS. Removed MinIO container (unused S3) and old KSCW containers from NAS. Updated all deploy commands in INFRA.md from NAS Docker to VPS scp+systemd pattern.
- **2026-03-12** — Scorer reminder routing refined on deployed NAS hooks: production sends go to the assigned duty member with `reminders@volleyball.lucanepa.com` in CC; dry-run endpoints now always send test emails directly to `reminders@volleyball.lucanepa.com`.
- **2026-03-12** — Scorer reminder emails now route to `reminders@volleyball.lucanepa.com` for both real sends and dry-run endpoints (`/api/scorer-reminders/dry-run`, `/api/scorer-reminders/dry-run-game`) via deployed NAS hook updates.
- **2026-03-12** — Scorer info panel is now volleyball-only in `ScorerPage`: the expandable duty-info block is hidden when the basketball tab is active to avoid showing volleyball-specific guidance in basketball context.
- **2026-03-12** — Scoreboard ranking dedup adjusted: accordion per-metric team ranking now de-duplicates by taking each team’s best metric value (max) instead of summing across multiple rows, preserving previously correct top-chip behavior while removing duplicate team entries.
- **2026-03-12** — Scoreboard consistency fix: `Most` chips now use the same aggregated-per-team metric as the accordion ranking (eliminates mismatches like top chip vs expanded table). Accordion sub-table `Value` header now uses the active metric label instead of a generic `Value`.
- **2026-03-12** — Expanded scoreboard sub-table layout polish: switched to centered, auto-width mini-table (no forced full-width stretch), with centered headers/cells and team chips centered in their column.
- **2026-03-12** — Scoreboard accordion details switched to true tabular sub-view: expanded metric rows now show a compact 4-column table (`#`, `Team`, `Value`, `%`) instead of inline combined text.
- **2026-03-12** — Scoreboard header/alignment tweak: first column header renamed to `Metric`/`Metrik`, and first column content is now left-aligned while `Total` and `Most` remain centered.
- **2026-03-12** — Scoreboard accordion ranking aggregation fix: expanded metric lists now aggregate by unique team (`team_id`) instead of showing one entry per league row, eliminating duplicate team chips (e.g. repeated H1/H3) and showing summed metric values per team.
- **2026-03-12** — Scoreboard table density/layout tweak: each sport table now uses three equal-width columns (`TEAM`, `TOTAL`, `MOST`) with centered content/chips to better use available horizontal space.
- **2026-03-12** — Scoreboard number formatting switched to Swiss thousands separators (`'`), e.g. `15'440`, for totals and metric values displayed in chips/expanded metric lists.
- **2026-03-12** — Scoreboard rows are now accordion-style: each metric row is clickable and expands inline to show team ranking for that metric (rank, team chip, value, and percentage share), while keeping the collapsed `Total`/`Most` summary row.
- **2026-03-12** — Scoreboard `Most` chips now include team + value + percentage (share of the row total), e.g. `H3 - 105 (34%)`, while preserving team-based chip colors.
- **2026-03-12** — Scoreboard completeness: added `Narrow losses` metric row to volleyball totals table (`defeats_narrow`) and localized labels in EN/DE (`scoreboardNarrowLosses`).
- **2026-03-12** — Scoreboard wording cleanup: removed redundant “Most …” phrasing from left metric labels in the 2 sport tables. The left column now uses neutral labels (e.g., `Wins`, `Losses`, `Ranking points`) while the right team column remains `Most`.
- **2026-03-12** — Narrow W/L availability fix (deployed on NAS): root cause was backend mismatch — `sv_sync_lib.js` did not persist Swiss Volley ranking split fields (`winsClear`, `winsNarrow`, `defeatsClear`, `defeatsNarrow`) and the `rankings` schema in prod lacked corresponding columns. Added fields (`wins_clear`, `wins_narrow`, `defeats_clear`, `defeats_narrow`) to `rankings`, patched sync mapping, and reran `/api/sv-sync` to backfill.
- **2026-03-12** — Hallenplan free-slot logic generalized across sports: recurring training templates now surface as `FREI` whenever no concrete training overlaps and no home game/closure suppresses the slot. Removed BB-only Spielhalle free-slot special case so VB/BB follow the same availability rules.
- **2026-03-12** — Scoreboard layout simplified to 2 sport tables only (`KSCW Volleyball`, `KSCW Basketball`): each metric row now shows `Total` and `Most` (leading team chip), replacing the separate interactive metric tables/modal flow.
- **2026-03-12** — Scoreboard is now a dedicated tab (`Scoreboard`) separate from the league `Rangliste` tab. It always shows two sport blocks (`Volleyball` and `Basketball`) with per-sport fallback messaging when not enough KSCW teams are available in season data.
- **2026-03-12** — Removed the club-wide `KSCW total` card; scoreboard aggregates are now shown per sport only.
- **2026-03-12** — Games rankings now include a new `KSCW Scoreboard` block (split by volleyball/basketball) that highlights per-season leaders across KSCW teams for ranking points, wins/losses (including clear/narrow splits when available), sets, and scored/conceded points. The section only appears for sports with at least two KSCW teams in the current season data.
- **2026-03-12** — Rankings column order adjusted again: `#` now appears before `PTS` (rank first, points second) for better scanability, while points remain bold.
- **2026-03-12** — Rankings stats simplification: removed `Diff` from rankings and show scored points as `won:lost` in one column (similar to sets). Desktop volleyball now always shows W/L split subtext; when split data is not synced yet, it displays `-/-` as fallback.
- **2026-03-12** — Backend notification recipient fix (deployed on NAS): patched `pb_hooks/notifications_lib.js` so team notifications include `coach`, `captain`, and `team_responsible` relations (not only `member_teams`). Also aligned season cutoff to September (`month < 8`) and added fallback member lookup without season when seasonal roster rows are missing.
- **2026-03-12** — Volleyball ranking split is now directly visible on desktop in `W`/`L` cells (`clear/narrow`), while mobile keeps tap-to-open breakdown modal. Also fixed rankings header/body alignment by removing a leftover duplicate `Pts` header.
- **2026-03-12** — Games team filter hydration fix: removed invalid nested `<button>` structure in `TeamMultiSelect` by moving the clear-selection control outside the trigger button, eliminating React DOM nesting warning and reducing filter UI reset risk on refresh.
- **2026-03-12** — Rankings table column order tweak: moved `Pts` to the first column for both volleyball and basketball rankings, keeping points visually emphasized in bold.
- **2026-03-12** — Volleyball ranking mobile detail: tapping `W`/`L` now opens a breakdown modal (3:0/3:1 vs 3:2 wins, and 0:3/1:3 vs 2:3 losses). Swiss Volley sync now persists `winsClear`, `winsNarrow`, `defeatsClear`, and `defeatsNarrow` into rankings.
- **2026-03-12** — Admin mode banner polish: added left/right gold borders so the top admin ribbon is fully framed.
- **2026-03-12** — Desktop rankings table now shows more available standings data from sync sources: added points-for/points-against and point-diff columns for volleyball on large screens, plus point-diff for basketball, while keeping the compact mobile layout.
- **2026-03-12** — Notification create flow cleanup: reverted frontend-side notification writes for trainings/games to avoid duplicate records. Creation notifications are now backend-hook driven only (single source of truth), with recipient expansion handled in `pb_hooks/notifications_lib.js`.
- **2026-03-12** — Admin mode banner: replaced the top gold-only border with a slim labeled banner in `Layout` that shows the localized `Admin Mode` text when admin mode is active.
- **2026-03-12** — Recurring trainings modal date row layout updated: "Indefinitely" checkbox is now always inline with date fields. Layout uses 3 columns (`from`, `to`, `indefinitely`) when end date is active, and 2 columns (`from`, `indefinitely`) when indefinite mode is enabled.
- **2026-03-12** — Trainings recurring generator modal: fixed stale success state persisting across reopen. Closing the modal now fully resets internal form/result state so "X", backdrop close, and "Close" button all reopen on a clean form instead of showing previous "trainings generated" confirmation.
- **2026-03-11** — Web Push notifications: deployed Cloudflare Worker `kscw-push` (kscw-push.lucanepa.workers.dev) with VAPID JWT signing + AES-128-GCM payload encryption. Generated fresh VAPID key pair, set 3 Worker secrets (VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, AUTH_SECRET). Updated VAPID public key in `push_subscriptions.pb.js` and auth secret in `push_lib.js`. Deployed both hooks. Frontend: `usePushNotifications` hook, `public/sw.js` service worker, push toggle in `NotificationPanel`. PB: `push_subscriptions` collection, `/api/web-push/*` endpoints. Notifications automatically trigger push via `notifications_lib.js → push_lib.js → CF Worker`.
- **2026-03-11** — Unified email templates: created shared `email_template_lib.js` with branded dark-mode layout (KSCW logo, sport accent stripes, info cards, alert boxes, CTA buttons, plain-text fallbacks). Refactored all 4 email-sending hooks (`scorer_reminders_lib.js`, `participation_reminders.pb.js`, `game_scheduling_api.pb.js`, `slot_claims.pb.js`) to use the shared template. All emails now have consistent branding, proper HTML+plain-text, and sport-aware accent colors (VB gold, BB orange).
- **2026-03-11** — PocketBase upgrade: v0.23.12 → v0.36.6. Docker image switched from `spectado/pocketbase:latest` to `adrianmusante/pocketbase:0.36.6`. DB auto-migrated, all E2E tests pass. Backup at `pb_data_backup_20260311`. Key changes: CRUD API rules now checked before hooks (v0.27), extra relation filter checks (v0.32), list query optimizations (v0.36).
- **2026-03-11** — Schreibereinsätze delegation: duty delegation feature (`scorer_delegations` collection). Assigned members can delegate duties — same-team instant transfer, cross-team requires confirmation (updates both `*_member` and `*_duty_team`). DelegationModal with member search (split by team), DelegationRequestBanner for incoming requests, `useScorerDelegations` hook. AssignmentEditor split: admin gets dropdowns, regular users get read-only + "Weitergeben" button. PB hook (`scorer_delegation.pb.js`) handles validation, transfer, notifications, daily expiry cron. NotificationPanel extended with `duty_delegation_request` type.
- **2026-03-11** — Scorer reminders: fixed date filter bug (PB datetime vs plain date mismatch — used range filter), added `app_settings` collection with `scorer_reminders_enabled` toggle (default: off), superuser-only toggle in ScorerPage UI. Added dry-run endpoints (`/api/scorer-reminders/dry-run` for fake data, `/api/scorer-reminders/dry-run-game` for real game data). Currently VB-only (`source = "swiss_volley"`).
- **2026-03-11** — ID standardization: Renamed `sv_game_id` → `game_id`, `sv_team_id` → `team_id`, `bp_team_id` → `bb_source_id` across PB collections, hooks, and frontend. Added `vb_`/`bb_` prefixes to all IDs (stored in DB, stripped in UI). Renamed `sv_rankings` collection → `rankings`, `SvRanking` type → `Ranking`, `svTeamIds` → `teamIds`. Fixed BB game numbers (`g.id` → `g.gameNumber`). Convention: `vb_` for volleyball, `bb_` for basketball.
- **2026-03-11** — Repo cleanup: deleted duplicate root logos, unused assets (`kscw_gelb.png`, `kscw_trio.png`), dead code (`CoachRoute`, `LanguageToggle`, `useEventSessions`, `useParticipationSummary`, `swiss-volley.ts`), completed migration scripts, stale `PROJECT_SPEC.md`, `scorer_email_preview.html`, `clubdesk-theme.css`. Consolidated changelog. Updated CONTINGENCY.md and INFRA.md. Fixed a11y violations (color contrast, heading order, empty headings, scrollable regions, TeamChip readability) and login test strict mode (`exact: true`).
- **2026-03-10** — Auth & roles: Google OAuth login (direct PocketBase provider; Authentik removed 2026-03). Sport-scoped admin roles (`vb_admin`, `bb_admin`) with `hasAdminAccessToSport`/`hasAdminAccessToTeam` in `useAuth`. Profile onboarding modal with per-user language preference. Two-branch signup + approval system with PendingPage. Role hierarchy: user → coach/team_responsible → vb_admin/bb_admin → admin → superuser. Team leadership (coach, captain, team_responsible) as multi-relations on `teams`.
- **2026-03-10** — Basketball: Basketplan sync via public XML API (`bp_sync.pb.js`, cron 06:05 UTC). 19 BB teams, 196 games, rankings. `bb_source_id` on teams (raw Basketplan ID), `basketplan` game source. Sport-scoped positions (VB: setter/libero/etc, BB: point_guard/center/etc) with array values, normalization guard, and sport-aware option filtering.
- **2026-03-09** — Terminplanung: game scheduling module with 4 PB collections, 7 API endpoints, conflict detection (same-day, gaps, cross-team, closures). Admin UI (`/admin/terminplanung` + dashboard), public opponent flow with Turnstile CAPTCHA. Excel import/export. Email notifications on booking confirmation.
- **2026-03-09** — Notifications & logging: `notifications` collection with PB hooks for activity changes, results, cancellations, reminders (cron 06:30 UTC). `user_logs` audit trail with `logActivity()` and `useMutation` auto-logging. NotificationBell, NotificationPanel, HomePage news section.
- **2026-03-06** — Hallenplan: virtual slots (games, trainings, GCal events), slot claims (FREI/claimed), hall closures (Schulferien + GCal + manual), pre-game shortening, Spielhalle shared slots. ClosureManager with grouped view. PB hooks for claim validation + auto-revocation.
- **2026-03-04** — Participation: RSVP on games/trainings/events with `ParticipationButton`/`ParticipationSummary`/`ParticipationRosterModal`. Coach deadlines (`respond_by`), `max_players` on events, PB hook for email reminders (cron 07:00 UTC). Team visibility filtering (users see own teams only).
- **2026-03-02** — Testing: Playwright E2E (223 tests, 4 projects, 6 categories: a11y, readability, overflow, sizing, grid-layout, mobile-ui). GitHub Actions CI. axe-core WCAG scanning. Vitest unit tests for `memberPositions.ts`. 8 test accounts (user/vorstand/admin/superuser/coach/unapproved/vb_admin/bb_admin).
- **2026-03-01** — Admin tools: native DB panel (SQL Editor, TableBrowser, SchemaViewer, RecordEditModal). ClubDesk CSV sync. Security hardening (filter injection, XSS, rate limiting, PII minimization, security headers).
- **2026-02-28** — Core platform: teams/members schema (birthdate, photos, sponsors, slug URLs, RosterEditor), Schreibereinsätze integration (scorer licences, assignments, iCal export), HomePage (games + events), calendar (home/away colors), DB relations cleanup.
