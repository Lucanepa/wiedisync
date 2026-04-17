# Changelog

All notable changes to Wiedisync are documented in this file.

## [3.9.4] — 2026-04-17

### Fixes

- **Consistent team season format** — All 32 active teams now use the short season format `2025/26`. Previously 18 basketball teams carried the long format `2025/2026` and one volleyball team had a `2025/27` typo, causing mismatches against `getCurrentSeason()` and the sync-written `games.season` / `rankings.season` (both short). 19 rows normalised on dev + prod.
- **Enum + constraint on `teams.season`** — Field converted from free-text input to a dropdown (`allowOther: false`) and a Postgres CHECK constraint `teams_season_format_check` enforces `^\d{4}/\d{2}$` on both dev and prod, so the drift can't recur.
- **Auto-rolling season window** — New yearly cron hook (`schedule('0 3 1 5 *')` in `kscw-hooks`, May 1 at 03:00 UTC) rewrites the dropdown choices to a 5-season window starting from the currently-live season. Jan–Apr → starts at last autumn's season; May onward → starts at this autumn's. So from May 1 2026 onwards, `2025/26` is no longer selectable and `2030/31` becomes available — admins are forced to set teams to a current or future season.

## [3.9.3] — 2026-04-17

### Fixes

- **Team join-request notifications** — Coaches and team responsibles now receive an email, in-app notification, and push notification when a member requests to join their team via the account-claim or additional-team flow. Previously only new signups via `/register` triggered notifications; additional-team requests (`team_requests` collection) were silent.

## [3.9.2] — 2026-04-17

### Fixes

- **Signup with existing email** — Signing up with an email that already exists (including mixed-case variants like `Joaquinburgazzi@gmail.com`) now cleanly redirects to the login page with an "account already exists" banner instead of failing with a generic "Registrierung fehlgeschlagen" error. `/check-email` is now case-insensitive and also checks `directus_users` for accounts without a linked member record.
- **Password reset for mixed-case emails** — `/set-password` now matches `members.email` and `vm_email` case-insensitively, and falls back to `directus_users` when no member row exists. Members with mixed-case stored emails could not reset their password before. Existing mixed-case emails in the database (17 members, 17 users, 1 `vm_email`) were normalised to lowercase to prevent future drift.

## [3.9.1] — 2026-04-17

### Fixes

- **Team page load flash** — Navigating from the teams list into a team detail page no longer briefly shows an empty roster before the loading indicator reappears. Derived loading state in `useTeamMembers`, `useMultiTeamMembers`, and `useTeamAbsences` flips to `true` synchronously when the team/ID input changes, eliminating a one-frame paint window.

## [3.9.0] — 2026-04-14

### Features

- **Coach/TR participation editing** — Coaches and team responsibles can now change participation status for other team members directly in the roster modal (trainings and games). Pencil icon next to each member's status opens an inline dropdown to set Confirmed, Maybe, Declined, or clear back to No response. Also works on waitlisted members.
- **Self-override for absences** — Members can now override their own absence-declined status by clicking the RSVP button and selecting a different status.

## [3.8.0] — 2026-04-10

### Features

- **Interactive guided tours** — In-app step-by-step walkthroughs using React Joyride v3. 10 role-aware tours covering: Getting Started, Trainings (player + coach), Games (player + coach), Events, Absences, Scorer (player + admin), and Hallenplan. Custom KSCW-branded tooltip with blue-to-gold progress bar.
- **Central Guide menu** — MoreSheet → "Anleitung" at `/guide`. Lists all available tours filtered by user role, with completion checkmarks and step counts.
- **Per-page tour buttons** — Small "?" icon next to page titles to start context-specific tours. Popover picker when multiple tours are available for the same page.
- **Welcome modal for new users** — Auto-triggers on first login for approved users. "Ja, los geht's" starts the Getting Started tour, "Überspringen" dismisses permanently.
- **Role-based auto-offers** — Coaches visiting `/trainings` and admins entering admin routes get a one-time toast offering relevant tours.
- **Full i18n support** — All 10 tours translated in 5 languages (DE, EN, FR, IT, GSW).

## [3.6.0] — 2026-04-05

### Features

- **SV licence card on profile** — Swiss Volley section now shows licence category badge, licence number, LAS/Foreigner/FdO badges, regional federation, and activated/validated status — all read directly from `sv_vm_check` (single source of truth). Licence fields no longer synced to `members`.
- **Absence card layout** — Absence cards on profile now show badge+detail on top row, dates spanning full width on a separate bottom row.

### Security

- **sv_vm_check field restriction** — Member-level read permission restricted to 11 safe fields (excludes email, birthday, name, phone PII). Previously exposed all fields including personal data of all Swiss Volley players.

### Refactoring

- **Licence data from sv_vm_check** — `licence_category`, `licence_activated`, `licence_validated` no longer synced from VM to `members` table. Frontend reads them directly from `sv_vm_check` by `association_id`. `vm_email`, `geschlecht`, and `licences` still sync to members (needed for auth flows).

## [3.5.0] — 2026-04-05

### Features

- **Expanded Volleymanager sync** — `sv_vm_check` now includes 16 new columns: birthday, nationality (name + IOC code), LAS status (`is_locally_educated`), abroad player status (`is_foreigner`), federation (club regional association), main club name/ID, double licence club/team info, activation/validation dates. Filter changed from "validated only" to all non-deceased/non-anonymized players (260 total).
- **VM email sync to members** — Monthly cron syncs each member's Volleymanager email (`vm_email` field) from their `sv_vm_check` record, matched by `license_nr` ↔ `association_id`.
- **VM email claim on signup** — When a new user registers with an email matching an existing member's `vm_email`, the registration auto-claims that member record instead of creating a duplicate. Works in both `/kscw/register` (new signup) and `/kscw/set-password` (OTP shell claim) flows.

## [3.4.0] — 2026-04-04

### Infrastructure

- **Hetzner VPS migration** — Migrated all backend infrastructure from Infomaniak VPS (2 vCPU, 3.8GB RAM) to Hetzner CPX32 (4 vCPU, 8GB RAM). Directus prod+dev now run on Supabase Postgres with 150GB disk. All DNS records (directus.kscw.ch, directus-dev.kscw.ch, status.kscw.ch, coolify.kscw.ch) repointed to Hetzner tunnel. Uptime Kuma monitoring restored with 6 monitors and email alerts. Sentry tunnel CF Worker deployed. Old Infomaniak VPS decommissioned.

## [3.3.0] — 2026-04-04

### Features

- **Error log context enrichment** — `GET /kscw/admin/error-logs` now enriches each entry with a `_context` object containing human-readable data from the database. User IDs resolve to member name, role, and team memberships (with sport). Record IDs resolve to team names, member names, or game matchups for `teams`, `members`, and `games` collections. The `?search=` parameter also searches inside `_context`, so you can find errors by member name or team name.

## [3.2.0] — 2026-04-04

### Security

- **SQL injection fix** — Parameterized `whereRaw` binding in registration endpoint (`registration.js:34`).
- **Email header injection** — Strip `\r\n\t` from user-supplied name/subject in contact form to prevent SMTP header injection.
- **HTML escaping in email templates** — All interpolated values (title, subtitle, greeting, CTA, footer, info card rows, alert boxes) now escaped via `escHtml()`.
- **Coach emails removed from public endpoint** — `GET /kscw/public/team/:id` no longer returns email addresses. Contact form still routes to coaches server-side.
- **Password reset rate limiting** — Max 3 requests per hour per IP.
- **Sentry tunnel CORS** — Restricted from any `*.pages.dev` to only `wiedisync.pages.dev` and its subdomains.
- **iCal feed validation** — Source parameter whitelisted, team IDs validated as numeric.
- **Postgres role constraint** — CHECK constraint prevents privilege escalation via direct SQL (`members_role_values_valid`).
- **Slot claims unique index** — Partial unique index on `(hall_slot, date) WHERE status = 'active'` prevents race-condition double claims.
- **Hardcoded emails → env vars** — `OWNER_EMAIL`, `CONTACT_EMAIL_BB` moved to environment variables.
- **Notification subject PII** — Member names removed from join-request email subjects (kept in body only).
- **SQL history** — Admin SQL editor history moved from `localStorage` to `sessionStorage`.
- **npm audit** — Fixed all known dependency vulnerabilities (0 remaining).

## [3.1.0] — 2026-03-31

### Features

- **Error log annotations** — Errors can now be marked as `solved`, `important`, or `open` with resolution notes and commit references. Solved errors are hidden by default when checking logs, so only new/unresolved errors surface. Bulk annotation supported. Backed by Postgres `error_annotations` table with MD5-based entry hashing. New endpoints: `POST /kscw/admin/error-logs/annotate`, `POST /kscw/admin/error-logs/annotate-bulk`, `GET /kscw/admin/error-logs/annotations`. Existing `GET /kscw/admin/error-logs` now returns `_hash` and `_annotation` per entry and accepts `?show_solved=true`.

## [3.0.0] — 2026-03-29

### Breaking

- **PocketBase → Directus migration** — Backend fully migrated from PocketBase (SQLite) to Directus 11 (PostgreSQL). All API endpoints, auth flows, and data moved. PocketBase containers decommissioned.

### Infrastructure

- **Production Directus** — `directus.kscw.ch` deployed on VPS port 8096 with PostgreSQL (`directus_kscw_prod`), CF tunnel, Google OAuth SSO, and branded email templates.
- **Data migration** — 4026 records, 54 files, 464 users created and linked. Bcrypt password hashes transferred from PB. Polymorphic activity IDs remapped.
- **Schema sync tooling** — `npm run schema:pull/diff/push` scripts using Directus snapshot API for dev→prod alignment.
- **9 Postgres triggers** — Validation and notification logic (slot claims, shell conversion, coach approval, guest block, training claim revocation, game/training/event notifications, scorer delegation) runs at database level with zero Node.js overhead.
- **30+ custom endpoints** — Shell invites, OTP verification, password set, contact form, game scheduling (7 routes), iCal feed, GCal sync, scorer reminders, feedback→GitHub, scorer delegation, web push.
- **10 cron jobs** — Shell/invite/delegation expiry, notification cleanup, participation reminders, daily activity alerts, shell reminder emails, SV sync (06:00), BP sync (06:05).
- **Web push via Directus** — Push subscription endpoints and delivery integrated into notification crons.
- **Turnstile CAPTCHA** — Filter hook validates on unauthenticated member/feedback creation + check-email endpoint.
- **Branded emails** — Liquid templates (password reset, invitation) + JS template helper (OTP, scorer reminders) with KSCW dark-mode design.
- **PB decommissioned** — Containers removed, tunnel routes deleted, dev data purged. PB prod data preserved as backup at `/opt/pocketbase-kscw/`.

## [2.9.0] — 2026-03-29

### Security

- **Authorization hardening** — Added missing authorization checks on `/scorer-delegation/accept|decline` (only recipient can act) and `/team-invites/extend` (only admin/coach/TR of member's team). Previously any authenticated user could call these endpoints for any member.
- **Cryptographically secure OTP** — Replaced `Math.random()` with `crypto.randomBytes()` for 8-digit OTP code generation.
- **OTP brute-force protection** — Added rate limiting (5 attempts per 15 minutes per email) on `/verify-email/confirm`.
- **Privacy at API level** — New Directus filter hook enforces `birthdate_visibility` and `hide_phone` settings on `members.items.read`, preventing bypass via direct API calls. Admins and own-record exempt.
- **Sentry PII removal** — Stopped sending email/name to Sentry user context; added breadcrumb email scrubbing. OTP code removed from email subject line.
- **Error message sanitization** — All 500-status error responses across 7 endpoint files now return generic "Internal error" instead of leaking `err.message` internals.
- **Server log PII cleanup** — Replaced email addresses in log statements with member/user IDs (3 endpoints + password reset).
- **Feedback anonymization** — GitHub issues created from user feedback now show `Member #ID` instead of full name.
- **Security headers** — Added `Strict-Transport-Security` (HSTS) and `frame-ancestors 'none'` to CSP.
- **DOMPurify on i18n HTML** — Added DOMPurify sanitization to all `dangerouslySetInnerHTML` usages in ScorerRow and ScorerPage.

## [2.8.1] — 2026-03-29

### Improvements

- **Branded email templates** — All KSCW emails now use consistent dark-mode branded design. Directus auth emails (password reset, user invitation) use Liquid templates mounted into the container. OTP verification emails display a large gold code with alert box. Scorer reminder emails include sport-aware accent colors (VB gold / BB orange), game info cards, and CTA to scorer page. Shared JS template helper (`email-template.js`) ported from PocketBase `email_template_lib.js`. All emails include both HTML and plain-text fallbacks.

## [2.8.0] — 2026-03-29

### Infrastructure

- **Postgres triggers** — Moved 9 validation and notification hooks from Node.js into Postgres triggers: slot claim validation, shell member conversion, coach approval guard, guest participation block, training claim revocation, and batch notifications on games/trainings/events CRUD. Zero Node RAM overhead — triggers use efficient `INSERT...SELECT` for batch member notifications.
- **Directus custom endpoints** — Ported all 30+ PocketBase `routerAdd` hooks to Directus endpoint extension: shell invites (create/claim/extend/info), OTP email verification, password set, contact form with coach routing, game scheduling (7 routes), iCal feed (volleyball/basketball/all), GCal sync, scorer reminders, feedback→GitHub, scorer delegation accept/decline.
- **Optimized crons** — Participation reminders, daily notification reminders, auto-cancel trainings, and auto-decline tentatives now use batch SQL instead of per-member loops. Shell expiry, invite expiry, and notification cleanup are single UPDATE/DELETE statements.
- **Daily sync crons** — Swiss Volley (06:00 UTC) and Basketplan (06:05 UTC) sync crons added to Directus hooks extension. Crons call the existing sync endpoints via internal HTTP with `DIRECTUS_ADMIN_TOKEN` — single source of truth, no code duplication.
- **Web push via Directus** — Push subscription endpoints (`/kscw/web-push/*`) and `sendPushToMember`/`sendPushToMembers` helpers migrated from PocketBase hooks to Directus endpoint extension. Crons now trigger push after inserting deadline and upcoming-activity notifications. Scorer delegation accept/decline also sends push. Frontend hook updated to use Directus auth. SQL migration for `push_subscriptions` table.
- **Postgres DEFAULT values** — `members.language` defaults to `'german'`, `members.birthdate_visibility` to `'full'` at the database level, eliminating the member_defaults filter hook.

## [2.7.2] — 2026-03-29

### Features

- **Google OAuth SSO** — Configured Directus dev SSO with OpenID driver for Google login. Redirect allow list includes dev, prod, and localhost callback URLs.

### Bug Fixes

- **Fixed hallenplan crash** — `hall_slots.team` is a single M2O integer FK in Directus (was multi-relation array in PocketBase). Added `wrapFkAsArray()` utility to normalize single FKs into arrays at fetch time. Added null safety to all `slot.team` accesses across hallenplan components.
- **Fixed 403 on games, sponsors, trainings** — Directus rejects PocketBase-style dot-notation relational filters (`'kscw_team.sport'`). Converted to nested object syntax (`{kscw_team: {sport: ...}}`).
- **Excluded incomplete games** — Games without an opponent, date, or time are now filtered out at the query level across all views (games, home, spielplanung, hallenplan, calendar).

## [2.7.1] — 2026-03-29

### Bug Fixes

- **Integer FK stringification** — Enhanced `stringifyIds()` to convert all Directus integer foreign key fields to strings (not just `id`). Fixes silent comparison failures across all pages where relation fields like `kscw_team`, `hall`, `scorer_duty_team` were returned as integers but compared to string IDs.
- **Removed non-existent `name` field** from members collection queries (scorer, roster editor) — caused 403 errors in Directus.
- **Fixed sort field names** — Replaced PocketBase `created`/`updated` with Directus `date_created`/`date_updated` across 10 files.
- **Fixed `_neq` NULL exclusion** — Added null fallback on hallenplan and player profile status filters.
- **Fixed null safety** on `hall_slots.team` array access in recurring training modal.

### Code Quality

- **Deduplicated 30+ local `asObj()` definitions** — replaced with imports from shared `src/utils/relations.ts`.
- **Replaced 3 `getId()` duplicates** with `relId()` from shared utility.

### Infrastructure

- **Added Directus system fields** — `date_created`, `date_updated`, `user_created`, `user_updated` on all 42 collections. Backfilled 3886 existing records.
- **Increased Directus dev token TTL** from 15min to 1 hour (refresh token from 7d to 30d).

## [2.7.0] — 2026-03-28

### Infrastructure

- **Directus relation expansion** — Migrated all 62 files from PocketBase `obj.expand?.relation` pattern to Directus inline relation access with `fields: ['*', 'relation.*']` queries. Added `asObj<T>()` type-safe helper for runtime narrowing across all modules (games, trainings, events, scorer, hallenplan, calendar, auth, admin, teams, carpool).
- **Sentry error tracking** — Added `@sentry/react` with ErrorBoundary (German fallback UI), automatic user context on login/logout, `@sentry/vite-plugin` for source map uploads, and session replay. Configured via `VITE_SENTRY_DSN` env var.
- **Cloudflare Web Analytics** — CSP headers updated; enable via CF Pages dashboard toggle (no code changes needed, privacy-first, no cookies).
- **Participations public access** — Added public read permission for participations collection in Directus so unauthenticated homepage game cards load correctly.

## [2.6.1] — 2026-03-27

### Bug Fixes

- **PB hooks scope fix** — Restored `require()` pattern for all 17 PocketBase hooks. PB 0.36 JSVM isolates each callback scope — the recent "inline _lib.js" refactors broke helper access, causing 400 errors on member_teams create, broken audit logging, and failed crons. 34 files changed (17 `.pb.js` + 17 new `_lib.js`).

## [2.6.0] — 2026-03-26

### Features

- **Team Settings** — New accordion section in team editor (RosterEditor) replacing the flat "Features" toggle list. Grouped into 3 collapsible panels: Features (5 switch toggles), Game Defaults (min players, RSVP deadline, require-note), Training Defaults (auto-cancel, min players, RSVP deadline, require-note). iOS-style switch toggles with KSCW brand purple. Italic hint text on each setting. Number inputs debounced (500ms). Mobile-responsive (44px touch targets). 14 files changed across frontend, backend, and 5 i18n locales.
- **Color-coded RSVP save popup** — The "Saved" confirmation popup in ParticipationButton and GameDetailModal now matches the response color: green for yes, red for no, yellow (with black text) for maybe.
- **Auto-decline "Maybe" after deadline** — New per-team toggle (`auto_decline_tentative`). When enabled, the daily cron converts tentative participations to "declined" after the respond_by deadline passes. Applies to games, trainings, and events. Gated per team — off by default.
- **Team defaults for games & trainings** — Coaches can set default `min_participants`, `respond_by_days`, `require_note_if_absent`, and `auto_cancel_on_min` at the team level. These pre-fill new game/training creation forms and the recurring training generator. Per-activity overrides always win.
- **Sync hook defaults** — Swiss Volley and Basketplan sync now apply `game_respond_by_days` from team settings when creating new games (creation only, not updates).

## [2.5.0] — 2026-03-26

### Features

- **Team photo zoom** — Coaches can now zoom in and out when adjusting the team photo crop. When zoomed out, KSCW brand-colored bands appear on the sides. Zoom level is stored alongside crop position in `team_picture_pos`. Slider + buttons UI during crop adjustment. Works on TeamDetail and TeamCard. i18n in all 5 locales.

## [2.4.1] — 2026-03-26

### Features

- **Referee expenses** — Coaches can record who paid the referees for volleyball home games directly in the game detail modal (searchable member dropdown + "Other" option, CHF amount, notes). New admin page under Admin → Schiedsrichterkosten with team/season filters and CSV export. New PB collection: `referee_expenses`.

## [2.4.0] — 2026-03-25

### Features

- **Participation warnings** — Red/yellow triangle warning icons on game, training, and event cards when participation is insufficient. Click/tap to see details (mobile-friendly popover).
- **Game roster check** — RED warning when fewer than 6 field players (volleyball, libero-aware) or 5 players (basketball) are confirmed. YELLOW warning when no coach is present. Both sports, configurable via `min_participants` field.
- **Training auto-cancel** — New "Auto-cancel" toggle on trainings. When enabled, training is automatically cancelled at the RSVP deadline if confirmed count is below the minimum — freeing the hall slot for others and notifying all coaches.
- **Pre-deadline alerts** — Email + in-app notification sent to all team members 1 day before the RSVP deadline if game roster is incomplete or training minimum is not met.
- **Min participants for events & games** — New `min_participants` field on events and games collections. Events show RED triangle when below threshold.

### Technical

- New utility: `participationWarnings.ts` with pure warning computation functions + 22 unit tests
- New component: `ParticipationWarningBadge` with shadcn Popover for mobile-friendly click interaction
- Extended `participation_reminders.pb.js` cron with pre-deadline alerts and auto-cancel logic
- PB schema: added `auto_cancel_on_min` (trainings), `min_participants` (events, games) on dev+prod
- Updated INFRA.md: hooks are mounted from host, not built into Docker image

## [2.3.1] — 2026-03-24

### Bug Fixes

- **Coach visibility** — Coaches and team responsibles now see trainings, games, events, and participation for teams they manage, even if they're not a player on that team. Merged `coachTeamIds` into page filters (GamesPage, TrainingsPage, EventsPage, HomePage).
- **Events team filter** — Added `TeamFilter` component to EventsPage (shown when user has >1 team).
- **Pending members 400 error** — Created missing `requested_team` relation field on `members` collection (dev+prod). Updated members API rule to allow coaches to see members whose `requested_team` points to their team.

## [2.3.0] — 2026-03-24

### Features

- **Admin Dashboard** — New overview page (`/admin/database` → Dashboard tab) with sticky KPI strip showing member count, team count, pending approvals, PB health, and sync freshness. Four collapsible sections: Members & Teams (bar chart + team table + unapproved list), Games & Season (upcoming games, results, win/loss, scorer coverage), Activity & Participation (RSVP rates, notifications, recent user activity), Infrastructure (compact health/sync summary with link to full InfraHealth page). Visible to all admins.
- **Query Workspace** — Enhanced query tab (superadmin only) with: horizontal chip strip for saved/template/recent queries, 10 pre-built parameterized query templates (members in team, games by date, scorer gaps, etc.), visual point-and-click SQL builder, SQL/Visual mode toggle, chart visualization for results (auto-detects bar/line/pie from data shape), save queries for reuse. New `query_templates` PB collection.
- **Shared `useInfraHealth` hook** — Extracted PB health and sync freshness logic into a reusable hook shared between Dashboard and InfraHealthPage.
- **shadcn Tabs** — Added Tabs component for the 3-tab DatabasePage layout.

## [2.2.0] — 2026-03-24

### Features

- **RSVP response timestamps** — Participation Roster modal now shows when each team member responded, displayed as locale-aware relative time (e.g., "vor 2 Std.", "gestern"). Works for games, trainings, and events. Uses PocketBase's existing `updated` field — no backend changes needed.
- **Team toggle for RSVP visibility** — New `show_rsvp_time` feature toggle in team settings (RosterEditor). Coaches and team responsible can enable/disable RSVP timestamp visibility per team. Off by default. For multi-team events, timestamps show if any associated team has the toggle enabled.

## [2.1.1] — 2026-03-24

### Bug Fixes

- **Auth email hooks re-enabled** — After Coolify redeploy, the `auth_emails.pb.js` file was disabled on running containers. Removed the broken `onMailerRecordOTPSend` hook that silently blocked all OTP email sending when it threw. The 4 working branded hooks (password reset, verification, email change, login alert) are now active again. PB-native OTP emails use PocketBase's default template (functional, not branded).

## [2.1.0] — 2026-03-24

### Features

- **OTP-based authentication** — Replaced all token-link-based password flows with email OTP verification (8-digit codes). Four flows redesigned:
  - **New member signup**: Email → OTP verification → registration form (prevents fake signups)
  - **Existing member activation** (ClubDesk imports): Email → OTP → set password (no more confusing "password reset" for first-time users)
  - **Shell invite (QR join)**: Claim invite → OTP → set password inline (no separate email needed)
  - **Forgot password**: Inline on login page → OTP → set new password (no more token links)
- **Shared OTP input component** — 8-digit input with auto-advance, paste support, backspace navigation, resend countdown, mobile-friendly (`inputMode="numeric"`)
- **Context-aware labeling** — OTP screens show different titles per flow: "Activate Account", "Verify Email", "Reset Password", "Set Password"
- **PB native OTP** — Uses PocketBase v0.36's built-in `requestOTP`/`authWithOTP` for existing users. Custom `/api/verify-email` hook for pre-registration verification.
- **Custom `/api/set-password` endpoint** — Allows password setting after OTP auth without requiring old password (admin-level DAO)
- **Branded OTP emails** — KSCW-themed email template with prominent code display, language-aware (DE/EN)

### Removed

- `ResetPasswordPage.tsx` and `/reset-password/:token` route — fully replaced by OTP flow

## [2.0.1] — 2026-03-24

### Bug Fixes

- **Feedback submissions not listed** — Added missing `created`/`updated` autodate fields to PocketBase `feedback` collection (both prod and dev). The `sort: '-created'` query was silently failing, causing "Noch kein Feedback eingereicht" for all users.
- **Participation counts vanishing in detail views** — `ParticipationSummary` now distinguishes "still loading" from "no data" instead of returning null during fetch, preventing the brief disappearance of confirmed/declined counts when opening game or training detail modals.
- **Empty dates handled gracefully** — `formatDate()` on feedback page no longer crashes on empty or invalid date strings from backfilled records.

### Features

- **Multiple screenshots in feedback** — Users can now attach up to 5 screenshots per feedback submission (was limited to 1). Drag-and-drop, file picker with multi-select, and individual remove buttons.

## [2.0.0] — 2026-03-23

### Security

- **Server-side Row Level Security (RLS)** — Added PocketBase API rules (listRule/viewRule) to all 24 collections. Data access is now enforced at the database level, not just client-side filters.
  - **Team-scoped**: trainings, member_teams — only visible to team members and coaches
  - **Teammate-scoped**: members, absences, participations — only see people on your team(s)
  - **Per-member**: notifications — strictly own records
  - **Public**: games, events, halls, teams, hall_closures — public club data
  - **Locked**: app_settings, user_logs, push_subscriptions — superuser-only
  - Coach + player dual-role supported (different access paths per team)
- Added `scripts/apply-api-rules.ts` — idempotent migration script to apply all rules

## [1.1.0] — 2026-03-22

### Infrastructure
- Migrated PocketBase from bare systemd services to Coolify (self-hosted PaaS) on VPS
- Dockerized PocketBase with `Dockerfile` for reproducible deployments
- Refactored hook secrets from `secrets.json` to environment variables (`$os.getenv()`)
- Added ESLint config + CI job for PocketBase hook validation (`lint:hooks`)
- Consolidated all URLs to `kscw.ch` domain (removed `lucanepa.com` tunnel routes)
- Set up Uptime Kuma at `status.kscw.ch` for external monitoring
- Added Telegram alerting via `@kscw_alerts_bot` for deploy/container notifications
- Updated dev data sync script for Docker containers
- Cleaned up old systemd unit files (`pocketbase-kscw`, `pocketbase-kscw-dev`, `webhook-listener`)

## [1.0.1] — 2026-03-20

### Renamed

- Rename `active` field to `kscw_membership_active` on members collection to avoid confusion with `wiedisync_active` (claimed account status)

## [1.0.0] — 2026-03-19

### Core Platform
- React 19 + TypeScript + Vite + Tailwind CSS foundation
- PocketBase backend with realtime subscriptions
- Cloudflare Pages hosting, Infomaniak VPS backend (CF Tunnel)
- Service worker for cache management
- 4 languages: German, English, French, Italian (+ Swiss German)

### Authentication & Accounts
- Email login, signup with team selection, password reset
- OAuth login (Google) with onboarding for missing profile data
- Role approval system (pending → coach_approved_team flow)
- Superadmin / admin / member role hierarchy
- Privacy settings and GDPR-compliant account deletion
- Claimed vs unclaimed account distinction (`wiedisync_active`)

### Games
- Upcoming games with compact cards and score display
- Game detail modal with sets, referees, venue
- KSCW-perspective score coloring (own team highlighted)
- Swiss thousands separator formatting
- Embed page for external game widgets

### Scoreboard
- Absolute / Per Game toggle for team statistics
- Set scores aligned with team rows
- Unique team counting and tie ranking

### Scorer
- Scorer duty management page
- Duty delegation between members
- 44px mobile touch targets

### Calendar
- Monthly grid with game type indicators (H/A colored boxes)
- Hall event support, entry selection with detail modals
- Absence tracking with clickable bars filtered by team
- Mobile-first design with overflow modal
- iCal integration

### Trainings
- Training management with min/max participants
- Recurring training selection logic
- Guest counter and note input on training cards
- Cancel button redesign, single dropdown on mobile
- Batch participation queries, no past training generation

### Participation
- RSVP on all activities (games, trainings, events)
- Participation notes with save confirmation
- Realtime status sync across components
- Player/guest split counter with coach indicator
- `is_staff` flag using `isCoachOf` check

### Absences
- Absence tracking module integrated with calendar
- Team-scoped absence name resolution

### Events
- Event management with Trainingsweekend type
- Team permissions and TeamMultiSelect
- Calendar integration

### Teams
- Team overview with photo card backgrounds
- Team detail pages with roster, player profiles
- Position management with multi-position support
- Per-team guest levels (G1/G2/G3) replacing global is_guest flag
- Guest level cycle button on member_teams
- Guest restriction: server-side hooks block guests from game participation

### Roster Editor
- Add External User button with extend handler
- Shell member indicators and extend button

### External User Invite System
- QR code generation for team invites
- Public `/join/:token` page for invite claims
- Shell account → full member conversion on password set
- Cron jobs: shell expiry, reminders, invite cleanup
- Team permissions backend enforcement (hooks + tests)

### Hallenplan
- Virtual slots, summary view, multi-hall support
- Slot claiming system
- Sport field on hall_slots (optional)
- Hide past days to maximize space
- Dark mode support in SlotEditor

### Admin Mode
- Admin/member mode separation with toggle UI
- AdminModeProvider context + useAdminMode hook
- All modules respect admin mode toggle
- E2E tests for admin/member mode separation

### Notifications
- In-app notification system
- Unread badge in MoreSheet

### Navigation & UI
- Mobile-first sidebar with MoreSheet
- Logo Y-axis spin animation on sidebar expand/collapse
- Sport filtering (volleyball + basketball) with persisted preference
- Inter font, lucide-react icons
- shadcn/ui migration: 19 primitives, KSCW brand variants, adaptive Dialog/Drawer modal
- Filter chips with bulk toggle
- Dark mode with color-scheme meta tag
- Samsung Internet forced dark mode prevention
- Language dropdown (replacing button grid)

### Admin Tools
- Database browser with schema viewer and record editor
- ClubDesk sync page
- Admin setup and dashboard for game scheduling (Terminplanung)
- Public Terminplanung page and opponent flow
- Scorer assignment page

### Legal
- Datenschutz (privacy policy) page
- Impressum page

### Infrastructure
- Auto-deploy webhook for PocketBase hooks
- Domain migration: lucanepa.com → kscw.ch
- GitHub Actions CI with Playwright E2E tests (including WebKit)
- PocketBase auth rate limiting verification

### Location Autocomplete
- LocationCombobox with two-layer search (local halls + Nominatim)
- useHallSearch hook for client-side filtering
- useNominatimSearch hook with 600ms debounce
- Integrated in EventForm, TrainingForm, AwayProposalForm, admin hall editing

### Feedback & Bug Reporting
- Feedback page with bug/feature/feedback type selector
- Screenshot upload, user submission history
- PocketBase hooks: Turnstile CAPTCHA, GitHub issue creation, email notification
