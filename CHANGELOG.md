# Changelog

All notable changes to Wiedisync are documented in this file. Recent releases carry more detail; older entries are one-liners — see `git log` for the full text.

## v4.6.6 — 2026-05-10

### Roster summary: excluded guests no longer leak into "Confirmed" tally

- Modal showed "14 Confirmed" while the filtered list and exports both had 13. `playerParticipations` filter was `!p.is_staff || memberIdSet.has(p.member)` — only enforced roster membership for staff-flagged rows. A confirmed RSVP from a guest at one of the activity's `excludedGuestLevels` was filtered out of `memberList` (and therefore hidden from the visible list and export), but its participation row still satisfied `!p.is_staff` and counted in the summary. Filter is now a single `memberIdSet.has(p.member)` — pure-staff participations still route through `staffParticipations` as before.

## v4.6.5 — 2026-05-10

### Roster export PNG/PDF — finally has pixels

- v4.6.4 swapped `opacity: 0` for `left: -10000px` on the printable view, thinking the opacity was the only computed style being inlined into the snapshot. It wasn't — `html-to-image` clones the source DOM with computed styles intact, including the cloned root's `position: fixed; left: -10000px`, so inside the SVG `<foreignObject>` the cloned content painted at x=−10000 (outside the canvas area). Same blank result, different mechanism.
- Restructured the printable view so the OUTER wrapper does the hiding (`position: fixed; width: 0; height: 0; overflow: hidden`) while the INNER node passed to `toPng` keeps clean normal-flow styles — no `opacity`, no off-screen positioning. The clone no longer carries any hide hack and the snapshot fills with real pixels. Verified end-to-end on localhost.
- New `?debugExport=1` URL flag dumps a `[rosterExport] PNG diagnostics` console group with the source `getBoundingClientRect`, computed-style snapshot, intermediate `toSvg` data URL, and final `toPng` size. Kept enabled in prod — costs nothing when the flag is absent, useful next time someone reports a blank export.

### Activity-kind line in the export header

- New small uppercase line above the title in PNG/PDF + first metadata row in CSV: `TRAINING`, `GAME`, or `EVENT`. Game call sites (`GamesPage`, `GameDetailModal`) override with `"<home> vs <away>"`, so a game export reads `KSCW H1 VS PFADI` above the team-and-date title. The modal's on-screen title is unchanged — only the export header carries the matchup.
- New `activityKind?: string` prop on `ParticipationRosterModal`; defaults derived from `activityType` via new `kindTraining` / `kindGame` / `kindEvent` keys (EN + DE; FR/GSW/IT fall back to EN).

### Localhost dev server: CORS-safe by construction

- Localhost (`localhost`, `127.0.0.1`, `*.local`) now ALWAYS points at `directus-dev.kscw.ch`, regardless of `VITE_DIRECTUS_URL` in `.env*`. Prod Directus has a strict CORS allowlist that doesn't and shouldn't include localhost — an env override that pointed there silently broke every fetch with "blocked by CORS policy". The override line in `.env.local` is now a no-op for `npm run dev`; only matters for non-localhost preview builds.

## v4.6.4 — 2026-05-10

### Roster export PNG/PDF: actually contains pixels now

- v4.6.2 fixed the "blank snapshot" failure caused by the printable view sitting inside Vaul Drawer's transformed ancestor (re-anchored `position: fixed`) by portaling the view to `document.body`. The wrapper kept `opacity: 0` as the hide mechanism — and `html-to-image` clones the source DOM with computed styles intact, so the painted canvas inherited 0 alpha across the frame. Result: the saved PNG/PDF was a fully transparent image filled with the `backgroundColor: '#ffffff'` baseline → blank white file.
- Switched the hide mechanism from `opacity: 0` (and `zIndex: -1`) to `left: -10000px`. The printable view stays invisible to the user, fully opaque for the snapshot, and the off-screen positioning means it never gets composited into the visible viewport even briefly.

### `/status`: humane label before the first cron fires

- Migration 045 seeds `sync_runs` rows at the 1970-01-01 epoch so a freshly-deployed system shows them as stale immediately. The status row was rendering that literally as "20583 d ago" — accurate, useless. `useInfraHealth.ts` flags any heartbeat dated before 2000-01-01 as `awaitingFirstRun: true`; `StatusPage` shows "Awaiting first run" (still orange — the cron genuinely hasn't fired yet). Once the next cycle runs (gcal_sync 04:00 UTC, svrz_sync 04:30 UTC, sv_sync 06:00 UTC, bp_sync 06:05 UTC) the row flips to "X h ago".
- New i18n key `bugfixes.statusAwaitingFirstRun` (EN + DE; FR/GSW/IT fall back to EN as they don't translate the `/status` rows yet).

## v4.6.3 — 2026-05-10

### MoreSheet swipe-down to dismiss

- `MoreSheet` now matches the Vaul-based detail modals (`TrainingDetailModal`, `GameDetailModal`, `EventDetailModal`) and the existing `NotificationPanel` — drag the sheet down from the top to dismiss. Touch handlers on the wrapper measure `clientY - touchStart`; only consume the drag when the inner scroll is at the top so a downward swipe in the middle of a long admin nav still scrolls normally. Release past 100px slides the sheet out via the existing close animation.

### Real cron heartbeat health (`/status`)

- `/status` no longer reports "41 d ago" on syncs that are firing nightly. The previous detection used `MAX(games.date_updated)` per source as a proxy for "did the cron run?" — only bumped when a row actually changed, which is rare in steady-state.
- **Migration 045** adds a `sync_runs` table: `source` PK, `last_run_at`, `status` (`'ok' | 'error'`), `rows_changed`, `duration_ms`, `error_message`. Idempotent. Seeds the known sources (sv_sync, bp_sync, svrz_sync, vm_sync, gcal_sync) at 1970-01-01 so they show stale until first cron fire. `REVOKE ALL FROM anon, authenticated` — only `supabase_admin` writes, members read via the custom endpoint.
- New `logCronRun(database, source, opts)` helper in `error-log.js` upserts on completion (success or failure) — `onConflict('source').merge()`. Failures swallow + log to JSONL so cron health tracking can never crash the cron itself.
- `sv_sync`, `bp_sync`, `vm_sync`, `svrz_sync` cron blocks now record a heartbeat on every termination path. New `gcal_sync` cron at 04:00 UTC calls the existing `/admin/gcal-sync` endpoint nightly — that endpoint was admin-trigger-only, so `hall_events` literally never auto-refreshed (root cause of the orange "Hall schedule sync" row).
- New `GET /kscw/admin/sync-status` endpoint (auth-required) returns one row per source with `age_seconds` precomputed. `useInfraHealth.ts` reads from there. Swiss Volley row aggregates `sv_sync` + `svrz_sync` (most recent of the two wins) so a single cron failure doesn't flip the row orange while the other is healthy.
- Hook also distinguishes "stale" from "errored" — a cron that just failed renders red, not orange. Frontend type gains `hadError?: boolean` on `SyncStatus`.

## v4.6.2 — 2026-05-10

### Roster: explicit RSVP wins over absence overlay

- **Critical**: clicking "Yes" on an activity covered by a weekly unavailability now sticks. The participation row was being correctly updated to confirmed (BEFORE UPDATE trigger from migration 038 clears `auto_declined_by` on user status changes — that part still works), but the roster modal's `getMemberStatus` checked the absence-cover overlay **first** and returned `declined` regardless of the row's actual status. Logic flipped: a participation row whose `auto_declined_by` is null is treated as user-owned and its status is sacred; the absence overlay is only consulted when there is no row OR the row still carries the auto-decline marker.
- Same change applied to the row badge label and to `statusLabelText` (used by the roster export) so a manually-confirmed user never renders as "Unavailable" / "Declined (Absence)".
- `Participation` type gains the optional `auto_declined_by?: number | null` field so the frontend can distinguish system-set rows from user-set ones.
- Backend `participations.items.create` filter (the v4.4.10 absence guard) now skips when the request carries user accountability — `autoDeclineForAbsence` (cron writing fresh declined rows when an absence is created) still works because that path runs in system context with null accountability.

### Bottom sheet UX

- Top close strip on `MoreSheet` and `NotificationPanel` is now one big full-width button, with the visual handle bar inside it. Tap anywhere on the strip — handle, chevron, blank space — to dismiss. Hover/active states give the row a subtle background flash.

### Roster export

- **PNG / PDF were blank.** The hidden printable view sat at `position: fixed; left: -10000px` inside the modal's Vaul Drawer (or Radix Dialog on desktop), and an ancestor `transform` re-anchored the "fixed" coords to the drawer instead of the viewport — html-to-image's bounding-rect calc then captured an empty rectangle. View now portals to `document.body` (escapes the transformed ancestor) at `top:0/left:0` with `opacity:0 + pointer-events:none + z-index:-1` so it lays out at full size while staying invisible and inert. Also waits for `document.fonts.ready` before snapshotting.
- **Stale-bundle handling**: dynamic imports of `html-to-image` and `jspdf` now throw a typed `ExportLibraryError` ("App may have been updated — please refresh") when CF Pages no longer has the chunk hashes the user's loaded SPA references. Surfaced as a sonner toast.
- **Filename**: dropped the duplicate date — title already contains it ("H3 — 11/05/2026"), so the old pattern produced "H3-—-11_05_2026_11_05_2026_Confirmed.csv". Now `<title>_<filter>.<ext>` when the title already includes the date. Em/en/hyphen dashes collapse to single underscores, so the result is "H3_11_05_2026_Confirmed.csv".
- **CSV**: dropped the redundant date metadata row (was just duplicating the title's date). Position values in the data column are now translated through the `teams` namespace, matching the "Positions:" summary line.

## v4.6.1 — 2026-05-10

### Explicit close affordance on bottom sheets

- `MoreSheet` and `NotificationPanel` now show a chevron-down button at the top-right of the handle row on mobile (44×44px touch target). Tapping it triggers `startClose()` — same animation path as backdrop tap, so the slide-down + unmount flow is unchanged. NotificationPanel also gets a small `X` close button in the header on desktop (`lg:` only) for parity with native popover patterns.
- Background: even with the v4.6.0 scroll fix, the dismiss UX on phones with very tall content (admin mode in MoreSheet, long unread queues) was unclear — the only ways to close were a backdrop tap (small target above the sheet) or a nav-link tap (which navigates somewhere). The chevron makes "just close it" a one-tap action without leaving the current page.

## v4.6.0 — 2026-05-10

### Roster export — CSV / PNG / PDF

- **New Export dropdown in `ParticipationRosterModal`**, gated by `canEditRoster` (coach / team-responsible / admin). Three formats: CSV, PNG image, PDF. Respects the active status filter — exporting "Confirmed" produces only confirmed members; exporting "All" appends the waitlist + staff sections so the file mirrors what's on screen.
- **Columns**: full name (with leadership suffix — Coach / C / TR / Staff), `members.number` (jersey), `members.position[]` (default positions), human-readable status (including the absence-reason variant for declined-by-absence rows), guest count, free-text note (or absence reason), RSVP timestamp.
- **CSV**: vanilla `Blob` via the existing `toCSV` / `downloadText` helpers in `src/modules/admin/utils/exportResults.ts`. UTF-8 BOM up front so Excel autodetects encoding (umlauts in member names). Five-row metadata header (title, date, filter + count, exported-at) before the data table.
- **PNG / PDF**: hidden printable view rendered off-screen at 800px width with light-mode inline styles — exports look identical regardless of the user's dark-mode setting. PNG via `html-to-image` (lazy-loaded, ~47KB gzip). PDF wraps the same snapshot via `jspdf` (lazy-loaded, ~127KB gzip), slicing the canvas vertically when content exceeds one A4 page. Both libs are dynamic imports — main bundle is unchanged for users who never click Export.
- **Filename**: `<title>_<date>_<filter>.<ext>` with reserved characters sanitised.
- **Position summary header**: above the member table, the export shows a pill row with the count of each playing position represented in the current population (e.g. `3 Setter`, `5 Outside hitter`, `4 Middle blocker`, `2 Opposite`, `2 Libero`). Members are counted once per position they declare on their profile (a setter/outside hybrid contributes to both buckets). Order is fixed (S → O → M → D → L → BB equivalents → guest → other) so consecutive exports read consistently. CSV gets a `Positions:` line in the metadata block; PNG/PDF render pills below the status counts. Localised via the existing `teams` namespace position keys (de/en/gsw/fr/it).

### Mobile bottom sheet scroll fix

- **`MoreSheet` and `NotificationPanel` couldn't be scrolled on mobile** (both Android Chrome and iOS Safari) when content overflowed — admin-mode users carry a long secondary nav + admin section + super-admin section, well past the 85vh cap. Both components placed the slide-up keyframe (`animate-sheet-up`, `translateY(100%) → 0`, `both` fill) and `overflow-y-auto` on the **same DOM node**. The active/settled `transform` promotes the element to a compositor layer; on both engines that layer mishandles touch-driven scrolling. `position: sticky` children of a transformed ancestor are also broken on both — which compounded the problem for the sticky handles.
- **Restructure**: outer animated wrapper (`flex flex-col max-h-[85vh]` + `animate-sheet-*`) wraps an inner `flex-1 overflow-y-auto overscroll-contain` body. Scroll lives on a node with no transform. `panelRef` in `NotificationPanel` was moved to the new scroll container so the swipe-down-to-close gate (`scrollTop <= 0 && dy > 0`) still reads the correct scroll position.
- **`onAnimationEnd` hardened** on both wrappers (`if (e.target === e.currentTarget)`) to ignore bubbled `animationend` from descendants — latent footgun if any child ever gets a CSS animation.
- **Audit pass** confirmed `Modal` (Vaul-based shadcn `Drawer` on mobile) is structurally fine. `MemberMultiSelect` and `ParticipationButton` use sibling-not-ancestor backdrops, so interior taps don't bubble to the close handler.

### Roster filter dropdown

- `ParticipationRosterModal` status filter row converted from a horizontally-scrolling chip strip to a single `DropdownMenu` trigger. Saves ~36px of vertical space on mobile, removes the awkward x-scroll on narrow screens, and shows all options with colored dot + count per status. Active filter shown on the trigger button with the same dot.

## v4.5.4 — 2026-05-10

### Roster modal hides excluded guests

- Per-training `excluded_guest_levels` (commit `af71850`, v4.5.x) hid input buttons on the guest's own card and 403'd `participations.create` server-side, but never touched the staff-side roster view. Excluded guests sat in `ParticipationRosterModal` as zombie "Hasn't replied yet" rows — they couldn't reply and they inflated the "not responded" count.
- `ParticipationRosterModal` gained an `excludedGuestLevels` prop and now drops members whose `member_teams.guest_level` is in the excluded set before building `memberList`. Wired through from `TrainingDetailModal` and `TrainingsPage`.
- Games extension: same modal also drops any member with `guest_level > 0` whenever `activityType === 'game'` — matches the hard rule from `af71850` (games never allow guests). No call-site changes; `GameDetailModal` and `GamesPage` already pass `activityType="game"`.

## v4.5.3 — 2026-05-07

### Roster duplicate guard

- **DB constraint.** Migration 044 adds `UNIQUE (member, team)` on `member_teams`. Same member + same team is now strictly one row. Refetch races, double-clicks, and two coaches both hitting "approve" can no longer spawn twins. The migration sanity-checks for existing duplicates first and refuses to apply until `directus/scripts/dedupe-member-teams.mjs` cleans them up.
- **Data cleanup.** 5 duplicate rows removed from prod (`Hanna Baumgartner` D4, `Isis Hemprich` D1, `Maëlle Leiser` DU23-2, `Livia Schlegel` D4, `Daniela Duc (Fölmli)` D4) and 1 from dev (`Pawel Kalaga` H1) — all season=2025/26, guest_level=0. Surfaced when D4 admin saw Hanna listed twice on the roster.
- **Frontend defense-in-depth.** `RosterEditor.handleAdd`, `TeamDetail.handleApprove`, and `TeamDetail.handleApproveRequest` now look up `(member, team)` first and no-op (or update `guest_level` in the request flow) when a row already exists. The constraint catches genuine bugs rather than masking everyday UX races.

## v4.5.2 — 2026-05-06

### Closed: last Critical from the v4.5.1 audit

- **`sv_vm_check` cross-member dump.** New `GET /kscw/sv-licence/me` custom endpoint joins by `members.license_nr → sv_vm_check.association_id` with the original 11-field whitelist. Direct `sv_vm_check.read` for KSCW Member is now REVOKED — side-steps the Directus 11 `CASE WHEN 1` SQL-gen bug entirely. `ProfilePage` switched from `useCollection<VmCheck>` to `kscwApi('/sv-licence/me')`.

### Ops & dev experience

- `VAPID_PUBLIC_KEY` added to the dev container env (same gap as prod had pre-v4.5.1) and both containers recreated. Push working on both.
- New `/kscw/admin/migrations-status` admin endpoint + a "Migrations applied" card on `/admin/infra` — surfaces applied count, pending list, latest migration. Goes amber if dev/prod drift.
- `smoke-test.mjs`: token-only auth via `DIRECTUS_DEV_USER_TOKEN_MEMBER` / `DIRECTUS_PROD_USER_TOKEN_MEMBER` (from `.env.local`, URL-resolved); email/password fallback retired. Two new asserts: `sv_vm_check direct (must 403)` and `kscw/sv-licence/me`. 19/19 passing on dev.
- `setup-permissions.mjs` auto-loads `.env.local` and picks the right `DIRECTUS_DEV_TOKEN` / `DIRECTUS_PROD_TOKEN` by URL — no more inline env wrappers in npm scripts.
- New `npm run db:fresh-install:dev|prod`: `SCHEMA.sql | psql` → `db:migrate` → `db:setup-perms` → `db:smoke`. Single command for DR rebuild / fresh env.

## v4.5.1 — 2026-05-06

### Security

- **Deep audit + remediation across 6 surfaces.** ~58 findings; the high-impact items are listed below. Full audit log + open items in `SECURITY.md`; canonical permission map in `PERMISSIONS.md`.
- **Frontend.** Sentry Session Replay masks all text/inputs and denies network details for Directus (was capturing PII at 100% on error). OAuth callback rejects token URLs without a fresh `oauth_pending` sentinel from `loginWithOAuth` (closes the CSRF substitution path). Sponsor `website_url` and admin BugfixDashboard `pr_url` routed through `sanitizeUrl()`. `RichText` DOMPurify call gets explicit `ALLOWED_URI_REGEXP`. `public/sw.js` pins push-notification click URLs to our origin.
- **Push worker.** Bearer-secret comparison switched from `!==` to constant-time XOR-fold (`timingSafeEqualStr`) — closes the timing oracle on `AUTH_SECRET`.
- **Custom endpoints.** Newsletter Turnstile fails closed when `TURNSTILE_SECRET` is unset (was returning `true` → mailbomb relay). `/terminplanung/register` no longer returns the raw token in the response body. `/terminplanung/book-home` wrapped in a transaction with `SELECT … FOR UPDATE` and a cross-team check (`slot.kscw_team === opponent.kscw_team`) — closes both the TOCTOU race and cross-team slot sabotage. New shared `capPayload` (caps `/client-error` body to 500 chars) and `ipRateLimit` helpers; `team-invites/claim` rate-limited to 5/15min/IP. `web-push.js` removed hardcoded VAPID public-key fallback.
- **Custom hooks.** Announcement audience guard now blocks `audience_sport`-unset posts unless caller is full admin/superuser (a Sport Admin could omit the field and broadcast to the entire club). New filter on `members.items.update` strips the `role` field unless caller is admin/superuser (defense-in-depth on top of field-level perms — the role-sync hook escalates to Directus user role). Junction-delete pending Maps drained via try/finally + key snapshot. New `escapeEmailHtml`; admin-controlled `rejection_reason` and clubdesk-update `old_value`/`new_value` are now HTML-escaped before email interpolation.
- **Migration 043.** `tasks.read` scoped to own assignments. `feedback.read` scoped to own email. `teams.update` row-scoped for Coach + Team Responsible. `teams_sponsors.sponsors_id` FK with ON DELETE CASCADE (closes the deferred half of migration 037). `SET search_path = public` on all 8 messaging trigger functions. `bugfix_jobs` explicit REVOKE FROM anon, authenticated.

### Process

- **Permissions are now declarative.** `directus/scripts/setup-permissions.mjs` is the SINGLE source for Directus permissions, applied via `npm run db:setup-perms:<env>` on every deploy. Numbered SQL migrations are SCHEMA-ONLY going forward. The 4.4.4 / 042 incident class ("permission row never created on prod, surfaced four versions later") is now structurally impossible.
- **Migration tracker.** New `kscw_migrations(filename, sha256, applied_at, applied_by)` table + `apply-migrations.mjs` runner. Refuses to proceed if any applied migration's on-disk sha differs (tamper detection). Eliminates "was migration 009 ever applied to prod?" mysteries.
- **Smoke test.** `smoke-test.mjs` logs in as a non-admin Member, runs ~18 critical reads (`users/me`, `members/self`, `member_teams`, `teams`, `games`, `trainings`, `events`, `participations`, `absences`, `notifications`, `blocks`, `spielplaner_assignments`, `sv_vm_check`, `tasks`, `feedback`, `announcements`, `user_logs`, `web-push/vapid-public-key`), exits non-zero on any 4xx/5xx. Catches the silent Promise.all-failure pattern (4.4.4) on first deploy after the regression.
- **Single-command deploy.** `npm run db:deploy:dev|prod` runs migrate → setup-perms → smoke. Fresh-install path: `SCHEMA.sql` baseline (regenerated from prod via `npm run db:baseline:prod`) + `setup-permissions.mjs`.
- **Policy locked into CLAUDE.md, INFRA.md, SECURITY.md, PERMISSIONS.md.** Cross-referenced from every entry point. New `~/.claude/skills/kscw-security-audit/` skill encodes the 6-agent dispatch pattern for re-running the audit (with `SECURITY.md` as the dedup shield against re-flagging fixed items).

### Open

- `sv_vm_check.read` cross-member dump (Critical from the audit) remains open. Directus 11 emits invalid `CASE WHEN 1` SQL when a row filter is applied on this collection, which Postgres 12+ rejects. Fix path is a custom `/kscw/sv-licence/me` endpoint + revoke direct read. The 11-field whitelist (no email/birthday/name/phone) limits the surface; tracked in `SECURITY.md`.

## v4.5.0 — 2026-05-05

- Coach Dashboard expanded to /games (new tab, per-row drilldown, league-only toggle).
- Trainings + games dashboards: replaced season selector with persisted From/To range (defaults: 01.06 of current season → today, rolls forward annually).
- Bucket simplification: weekly + one-off absences now both count as "absent" (was: "excused"). Confirmed RSVP wins over a covering absence. Trend dots green/red.
- GameCard + EventCard feature parity with TrainingCard (always-visible note input, respond-by line, roster opener, edit/delete pencils — delete only for manually-created games).
- Migration 041 + setup-permissions update: three new team-row columns guarded by leaving them out of PUBLIC_TEAM_FIELDS; explicit Coach/TR read+update row added.

## [4.4.15] — 2026-05-05

### Fixed
- **Absence override leak: card-level + calendar RSVP buttons let users overwrite a covering absence.** v4.4.10's policy ("absence hard-overrides RSVP") was enforced in the three detail modals (`TrainingDetailModal`, `EventDetailModal`, `GameDetailModal` all early-return a passive "Excused" message when `hasAbsence`). It was NOT enforced on (a) inline card RSVP UIs `TrainingCard.TrainingParticipation`, `GameCard.GameCardParticipation`, `EventCard.EventCardParticipation` — these render Yes/Maybe/No pills directly on the list cards using prefetched participation data, never going through the detail modal — or (b) `CalendarEntryModal.tsx:143,163` which rendered `<ParticipationButton>` raw with no absence check. Concrete leak path: an auto-declined participation displays the red "No" pill (because `status='declined'`); the user clicks "Yes"; PATCH `participations/<id>` flips status to confirmed; migration 038's BEFORE UPDATE trigger `trg_participations_clear_auto_marker` is — by design — permissive on manual UPDATEs (clears `auto_declined_by` so the row detaches from the absence) so the override sticks. Fix is purely UI: new `useMyCoveringAbsence(activityType, activityDate)` hook (`src/hooks/useMyCoveringAbsence.ts`) wraps `useCollection<Absence>` filtered to the current user + the activity's date range, runs `absenceCoversActivity()` to apply the day-of-week + affects bitmap. The three card components and `HookedParticipationButton` now `if (hasAbsence) return <p>{t('absent')}</p>` mirroring the detail modals. Trigger and backend filter (`participations.items.create`) untouched — manual overrides via Directus admin or after deleting the absence still work.
- **PATCH `/items/trainings/{id}` returned 500 when editing the hall.** Postgres error `invalid input syntax for type integer: ""`. `TrainingForm.handleSubmit` (`src/modules/trainings/TrainingForm.tsx:284,291,293`) was sending `''` (empty string) for two nullable integer FKs — `hall_slot` (whenever the form was not in "auto" slot mode, regardless of whether you'd picked an actual hall) and `hall` (only when the "Other / custom name" radio was selected). Either path produced a write Postgres rejected. Both now resolve to `null`, which Directus accepts for nullable FK columns.

## [4.4.14] — 2026-05-03

### Fixed
- **"My next appointments" home agenda — Monday training rows still rendered green when the user was unavailable.** v4.4.12 only got half the way there. The fix correctly composite-keyed the input filter and the internal `partByKey` lookup in `useBulkParticipationStatuses`, but the *output* `Map<string, status>` still used `activity.id` as the key and the comment at lines 73-77 even rationalized that as safe ("callers do `statusMap.get(tr.id)`"). It is not safe — `HomePage`'s `NextAppointments` passes a mixed list of trainings + games + events to the hook, and the per-iteration `map.set(activity.id, …)` lets the last write win. Concrete repro on prod (member 8, H3): trainings id 1, 2, 3, 4 are the four upcoming Mondays — all `declined` (two manual, two auto-declined by weekly absence #51 covering Mon+Fri). Events id 1 (Generalversammlung), 2 (Trainingsweekend), 3 (Photoday), 4 (Photoday Day 2) are all `confirmed`. The hook iterated trainings first, set `map.set('1','declined')` … then iterated events and overwrote with `map.set('1','confirmed')`. The training row read `'1'`, got `'confirmed'`, painted green. Friday rows (training id 334, 335, 336) had no event collisions so they correctly rendered red. Wednesday rows (training id 15, 16, 17) genuinely were `confirmed` so they were correctly green for the right reason. Output map now keyed by composite `${type}:${id}`; a new `getStatus(type, id)` accessor is returned alongside the raw map; all seven `participationStatuses.get(…)` call sites in `HomePage.tsx` now go through it.
- **"Coach present" badge missing on most home-page trainings even when the coach was confirmed.** Same screenshot, secondary symptom. The badge appeared on Mon 04/05 and Wed 06/05 but not on Wed 13/05 / Wed 20/05 — yet member 8 (a coach for H3 via `teams_coaches`) was `confirmed` on all three Wednesdays. Root cause: the trainings fetch in `HomePage.tsx` used `fields: ['*', 'team.*', 'hall.*', 'coach.*']`. Directus's `team.*` only expands scalar fields and M2O foreign keys — `team.captain` (M2O int) was populated, but `team.coach` and `team.team_responsible` (both M2M) came back `undefined`. So `teamCoachIds(team)` returned only `[String(captain)]` and the player-coach detection in `ParticipationSummary` (`playerData.filter(p => p.status === 'confirmed' && coachMemberIds.includes(p.member))`) only ever matched the captain. On the two Wednesdays where the captain (member 19) wasn't confirmed, the badge silently disappeared even though a real coach was present. Added `team.coach.members_id`, `team.team_responsible.members_id` to the trainings fetch, and the equivalent `kscw_team.coach.members_id` / `kscw_team.team_responsible.members_id` to all four games fetches (next-all, next-mine, results-all, results-mine).

## [4.4.13] — 2026-05-03

### Fixed
- **SVRZ scheduling sync (`svrz_sync` cron) was failing daily at 04:30 UTC with "CSRF token extraction failed for /sportmanager.indoorvolleyball/playingscheduleresponsibleaddressviewer/index".** Misleading error message — the page was actually returning **403 Forbidden** and `csrfFromPage()` only checked for the regex match, not the HTTP status, so the 403 error template silently surfaced as a CSRF failure. Root cause: after `POST /sportmanager.security/authentication/authenticate` and a `GET /` dashboard hit, the Volleymanager session is authenticated but has **no sub-app scope** — the only indoor page reachable is `/sportmanager.indoorvolleyball/game/index`. Every other indoor page (writer, player, team, club, playing-schedule address-viewer) returns 403. The browser invisibly enters the volleyball sub-app via `/sportmanager.volleyball/main/dashboard` after login, which sets the server-side context that grants access to indoor sub-apps. Fix: add that fourth step to `vmLogin()`. Verified live against the production VPS: all previously-403 paths now return 200 with valid CSRF tokens. Same fix protects `vm-sync-check.mjs` (monthly cron, also touches `/indoorwriter/index` — would have crashed at the next monthly run on June 1). Also hardened `csrfFromPage()` to throw with the HTTP status when the response is non-OK, so future SVRZ drift surfaces as a one-line diagnostic instead of a CSRF red herring.

## [4.4.12] — 2026-05-03

### Fixed
- **Training row strip rendered "confirmed" green even when the user had a `declined` participation + covering absence.** Concrete repro on prod (member 8, training id 4 on 2026-05-25): `participations.status='declined'` plus a `weekly` absence covering Mondays — the roster modal correctly showed "Unavailable", but the personal training row's left strip was green. Root cause in `useBulkParticipationStatuses`: the in-memory `partByActivity` lookup was keyed on `activity_id` alone, with no `activity_type`. The same member had `training:4 declined` AND `event:4 confirmed` in `participations`; the query also did not filter by `activity_type`, so both rows came back, and the second `Map.set('4', …)` overwrote the first depending on Directus return order — when `event:4 confirmed` won, every training/game/event sharing the numeric id `4` rendered green. Fixed by keying both the Directus filter (`activity_type._in [...]`) and the JS `Map` on the composite `${type}:${id}` key.
- **Roster modal "last month" sub-label now sentence-cased.** `Intl.RelativeTimeFormat` emits lowercase ("last month", "vor einem monat"), which read awkwardly as a standalone label under a member's name. Capitalized in `RsvpTimestamp` via `String#charAt(0).toLocaleUpperCase()` (preserves locale-correct casing for non-ASCII).

## [4.4.11] — 2026-05-03

### Fixed
- **Email locale was DE/EN-only and broke on admin alias addresses.** Push got 5-locale support in 4.4.9 but emails still bucketed into just `de` and `en`, with members of `language=french/italian/swiss_german` silently routed to DE. Worse: alias addresses (`kontakt@kscw.ch`, `volleyball@kscw.ch`, `basketball@kscw.ch`, hardcoded `OWNER_EMAIL`) have no Directus user and no `members.email` row, so the bucketing helper defaulted them to DE — meaning forwarded copies arrived in German even when the underlying admin had `language=english`. Concrete repro: registering as `Livia Vuillemin (volleyball)` produced an English admin email to vb_admin Luca *and* a German copy via the OWNER_EMAIL CC, both reaching Luca's mailbox; he opened the German one. Same root cause for the `[KSCW] Datenanpassung` ClubDesk update email. Fix: `bucketEmailsByLocale` now returns `{de, gsw, en, fr, it}` and falls back to `members.email` when no `directus_users` row matches; `bucketMemberIdsByLocale` added for member-id callers; `EMAIL_LOCALES` exported. Translations added for the registration confirmation (volleyball / basketball / passive), admin notification, ClubDesk data-update mail, contact form, event invite, team-join request (in both `kscw-hooks` and `kscw-endpoints`), and `buildBroadcastEmail`. The `password-reset` email already had all five locales. Replaced the OWNER_EMAIL CC pattern in registration with a separate localized send (in the registering user's locale) so the alias receives a deterministic copy and never gets a duplicate German one of an English admin email. ClubDesk update mirrors the ADMIN_EMAIL into OWNER_EMAIL's resolved locale bucket for the same reason.

## [4.4.10] — 2026-05-03

### Fixed
- **Weekly unavailability did not override existing confirmed RSVPs.** If you had already RSVP'd ✓ to a Monday training and then created a weekly Monday unavailability, the participation row stayed `confirmed` — the personal training row's left strip rendered green via `useBulkParticipationStatuses` (which prefers an existing participation over an absence), while the roster modal labelled you "Declined (Absence)" via its absence overlay. Two views of the same data disagreed. Root cause: `autoDeclineForAbsence` in `kscw-hooks` did `INSERT … NOT EXISTS` (skipped any activity where a participation already existed) and there was no `participations.items.create` filter to catch the reverse case (RSVPing after the absence already existed). Policy decision: an absence hard-overrides the RSVP. Hook now UPDATE-then-INSERTs for trainings/games/events, and a new `filter('participations.items.create')` silently flips fresh RSVPs to `declined` + tags them with `auto_declined_by` when a covering absence exists. Migration 038 reshapes `trg_participations_clear_auto_marker` to mirror the trainings `auto_cancelled_by_closure` pattern (clear only when status changed AND marker unchanged) so the hook can write both fields in one UPDATE without losing the marker; manual-override semantics preserved (a user-driven status flip still detaches `auto_declined_by`). Backfilled 6 conflicting rows on prod.
- **Roster modal label and absence-coverage logic.** `ParticipationRosterModal.tsx` showed `Declined (Absence)` for any absence overlapping the activity date, regardless of `type`/`days_of_week`/`affects`. Switched the modal to use `absenceCoversActivity()` (already used by `useParticipation` and `useBulkParticipationStatuses`) so weekly absences only count on their declared days, and added `declinedUnavailable: 'Unavailable'` (en/de/fr/it/gsw) so weekly unavailabilities show "Unavailable" while one-off absences keep "Declined (Absence)".

## [4.4.9] — 2026-05-03

### Fixed
- **Push notifications were always sent in German regardless of `members.language`.** Every cron and event-driven push (`upcoming_activity`, `deadline_reminder`, team-join requests, scorer delegation accepted/declined, event invites, announcement fan-out, direct-message preview fallback) called `sendPushToMembers` once with a hardcoded German title + body. Web push payloads are baked at send time, so the recipient's in-app locale toggle could not localize them after delivery. New `directus/extensions/kscw-endpoints/src/push-i18n.js` provides `bucketMembersByLocale` (de / gsw / en / fr / it via `members.language`) and `tPush(locale, key, vars)` over an 11-key translation table. All eight call sites switched to `sendLocalizedPush`, dispatching one push per locale bucket. Announcement fan-out reuses its existing per-locale `translations` field (no new keys needed). Email templates were already DE/EN bucketed and were not changed.

## [4.4.8] — 2026-05-02

### Fixed
- **`user_logs` createRecord rejected with `Invalid query. Invalid numeric value.` for KSCW Members (WIEDISYNC-19, 36 users / 75 events).** The KSCW Member read policy on `user_logs` filtered `user._eq:$CURRENT_USER`, but `user_logs.user` is an integer FK to `members.id` while `$CURRENT_USER` resolves to the Directus user UUID. The INSERT succeeded; the post-insert SELECT through the RLS filter blew up parsing the UUID as integer. Patched permission filter on dev + prod to traverse the relation: `user.user._eq:$CURRENT_USER`.
- **`vm_sync` cron `spawnSync ETIMEDOUT`.** Monthly Volleymanager sync used `execSync` with a 120s timeout, blocking the Directus event loop the whole time and timing out on slower months. Converted to async `spawn` with a 10-min timeout, matching the SVRZ scheduling-sync pattern.
- **Sentry noise: `r.connection is undefined` from `@directus/sdk` (WIEDISYNC-3A).** SDK websocket re-auth race after the socket has already dropped. Realtime auto-reconnects; suppressed via `beforeSend` filter alongside the existing `No token for (re-)authenticating the websocket` suppressions.

## [4.4.7] — 2026-04-30

### Fixed
- **iOS Safari Invalid Date on bare `YYYY-MM-DD` columns.** All Zurich-zoned formatters in `src/utils/dateHelpers.ts` (`formatTime/Date/DateCompact/DateShort/Weekday/DateTimeCompact/RelativeTime`) used `input.replace(' ', 'T') + 'Z'` to coerce timestamps to UTC. For bare `date` columns (e.g. `trainings.date = '2026-05-07'`), the no-op replace + 'Z' produced `'2026-05-07Z'` — V8 silently parses it, JavaScriptCore (Safari/iOS) returns Invalid Date → formatters returned `""`. Symptom: weekday + date next to team chip on training cards rendered as "H3, " (just the comma). Replaced the inline parser with a shared `parseFlexible(input)` helper that anchors bare dates to `T00:00:00Z`.
- **Junction cascade pass 2 (migration 037).** Continuing migration 021. Five remaining M2M junctions had `ON DELETE SET NULL` on their integer FKs: `events_teams`, `events_members`, `hall_events_halls`, `hall_slots_teams`, `teams_sponsors`. Per the documented gotcha (`feedback_junction_cascade.md`), parent deletes leave orphan rows with NULL FKs that Directus serialises as the literal string `"null"` in `_in` filters → 400s on integer columns. Deleted existing orphans (5 in `events_teams`, 1 in `events_members`) and rebuilt the constraints as `CASCADE`. Applied dev + prod.

## [4.4.6] — 2026-04-30

### Fixed
- **Third-pass permission audit (migration 036).** KSCW Coach + Team Responsible `members.update` (fields=`position,number`) was NULL-filtered — coaches could edit number/position for any member via API. Scoped to members on a team I coach (Coach: `{member_teams:{team:{coach:{members_id:{user:{_eq:"$CURRENT_USER"}}}}}}`) / am responsible for (TR: `team_responsible` alias). KSCW Member reads on `event_sessions` + `events_members` scoped via parent event filter (mirrors `events.read` from 033). KSCW Coach reads + CUDs on `event_sessions` + `events_members` scoped via parent event = my-coached-team or my-created. Cleaned up duplicate `event_sessions`/`events_members`/`events_teams`/`hall_events_halls` permission rows left over from M2M re-creation. Out of scope: `member_teams`/`teams_coaches`/`teams_responsibles`/`teams_sponsors` — directory-level info legitimately readable across the club. Applied dev + prod.

## [4.4.5] — 2026-04-30

### Fixed
- **Second-pass permission audit (migration 035).** Removed public reads on `participations` / `events` / `events_teams` / `slot_claims` (the public website doesn't consume them; participations was a real privacy leak — every RSVP across the club was anonymously readable). KSCW Member reads on `polls` and `referee_expenses` scoped to teams I'm on (`{team:{members:{member:{user:{_eq:"$CURRENT_USER"}}}}}`). KSCW Coach reads on `participations` and `absences` scoped to teams I coach (mirrors the CUD scoping from migration 026). KSCW Coach polls CUD also scoped. Postgres-level: `REVOKE ALL ON event_signups FROM anon, authenticated` — defense in depth; PostgREST is stopped but the Supabase default grant was still in place. `tasks` left intentionally open: no `team` FK (only activity_type/activity_id strings), filter would need sub-query support that Directus doesn't have. Applied dev + prod.

## [4.4.4] — 2026-04-30

### Fixed
- **`spielplaner_assignments` had no member-side read perms.** Migration 031 created the collection but never inserted permission rows, so every non-admin user's `loadTeamContext` (`src/hooks/useAuth.tsx`) failed inside a `Promise.all`, leaving `memberTeamIds=[]`. Was masked by the wide-open reads in 4.4.1- — once 4.4.2/4.4.3 tightened reads to require team match, members started seeing no trainings/games/events and couldn't RSVP. Migration `034-spielplaner-assignments-read-perm.sql` grants self-scoped read (`{member:{user:{_eq:"$CURRENT_USER"}}}`) to every KSCW policy. Applied dev + prod.

## [4.4.3] — 2026-04-29

### Fixed
- **Member-scoped reads on absences, participations, events.** Continuing the audit in 4.4.2: `KSCW Member × {absences,participations,events} × read` all had `permissions = NULL`, so every member could read every other member's absence reasons, every RSVP across the club, and every event regardless of audience. Migration `033-member-read-team-scoping.sql` adds the `members.member_teams` o2m alias and scopes the rules: absences + participations to own + same-team-as-me; events to own + club-wide (`event_type ∈ {verein, tournament}`) + my-teams (via `events.teams`) + directly invited (via `events.invited_members`). Games left intentionally open (club-public schedule). Applied dev + prod.

## [4.4.2] — 2026-04-29

### Fixed
- **Trainings permission scoping.** `KSCW Member × trainings × read` had `permissions = NULL` (no row filter) — every member could fetch every team's trainings. Audit was triggered after Alex Leonhardt (member of H3 only) was seeing all 175 future trainings instead of his team's 11. Migration `032-trainings-team-scoping.sql` adds the `teams.members` o2m alias and scopes the rule to `{team:{members:{member:{user:{_eq:"$CURRENT_USER"}}}}}`. The `Public × trainings × read` row was also dropped — public never read trainings. Coach/Team Responsible/Sport Admin/Vorstand scopes preserved. Applied dev + prod.

## [4.4.1] — 2026-04-25

### Fixed
- **Set-score box alignment.** Per-set boxes in `GameCard` (games list) now use a fixed `inline-flex h-5 w-7` cell so single-digit scores ("8") render at the same width as double-digit ones ("25") — rows no longer jitter. `GameDetailModal`'s sets table also gets `table-layout: fixed` + `tabular-nums`. Same fix applied on kscw.ch (`global.css → .gm-sets`) for the public game modal.

## [4.4.0] — 2026-04-25

### Added
- **Tables convention.** New project-wide rule: any view of homogeneous data records uses shadcn `<Table>` (never card-stacks). Mobile compaction rules: names wrap to 2 lines, positions render as initials (S/O/M/D/L/G + BB equivalents), action toggles stack vertically on `<sm`, optional columns hide via `hidden sm:table-cell`. Reference impl: `RosterEditor`. Codified in `CLAUDE.md` + the `kscw-shadcn` skill, with explicit exceptions for event/activity cards (`GameCard`, `TrainingCard`, `EventCard`, `ScorerRow`), branded entity cards (`TeamCard`), and prose / release notes (`ChangelogPage`).
- **Absences page redesigned around two axes.** Two stacked button toggles (Absences | Unavailabilities × Mine | Team) replace the single 3-tab bar; new "Team Unavailabilities" view shows everyone's recurring weekly schedules in your team. Team scope is now visible to all team members (was coach/team-responsible only) — Directus permissions were already permissive, the gate was UI-only.

### Changed
- **9 list views converted to tables.** Roster editor, referee expenses, announcements, admin reports, audit log, registrations (Anmeldungen), absences (mine + team + weekly), Spielplanung list view, calendar unified list, news archive. Each gains proper column structure with mobile compaction; inline editing preserved everywhere it existed before.
- **Shared row components render `<TableRow>` directly.** `AbsenceCard` and `WeeklyUnavailabilityCard` now render single rows (not wrapping divs), so their parent pages wrap them in `<Table>` with consistent column layout. New `getPositionInitial()` helper in `memberPositions.ts`.

## [4.3.0] — 2026-04-24

### Added
- **Basketball Halle A+B combo booking.** New `games.additional_halls` JSON field (nullable, cast-json, tags interface) lets basketball home games block both KWI A and KWI B at once. The manual-game modal exposes a "KWI A + B (Basketball)" option at the top of the hall Select for basketball teams; the game detail drawer carries a one-click "Mark as KWI A + B" / "Back to single hall" toggle that patches the field in place (works on SVRZ-synced games too). Excel import recognises `A+B`, `KWI A+B`, `A + B` etc. for basketball rows.
- **Volleyball Saturday hall prefill.** When a Spielplaner creates a home game for a volleyball team on a Saturday, the hall field now prefills with a priority ladder: (1) the team's own Saturday training-slot hall, (2) KWI C, (3) KWI A, (4) KWI B — with a muted hint explaining why. The pick is only a prefill — admins can override freely.

### Changed
- **Conflict detection is now multi-hall-aware.** `hall_overlap` used to check exact-match halls only; it now checks any intersection between the candidate's hall set and each existing game's hall set. A basketball A+B game on Saturday 16:00 correctly blocks a volleyball-only game on KWI A or KWI B at the same time, and vice versa.
- **Hallenplan no longer hardcodes basketball → A+B by team sport.** The three internal helpers that used to infer the span from `team.sport === 'basketball'` now read `additional_halls`. A one-line backward-compat fallback keeps legacy basketball rows (no `additional_halls`) rendering the same span until they're re-saved — marked with a `TODO: remove after backfill` comment.

## [4.2.0] — 2026-04-23

### Added
- **Spielplanung sandbox mode.** Admins and Spielplaners can now create, edit, and delete manual games directly on the calendar. New `ManualGameModal` (shadcn Dialog) opens from the empty-day "+" affordance; edit/delete from the game detail drawer. Bulk Excel import for manual games with template download + per-row preview.
- **Scoped Spielplaner role.** New `spielplaner_assignments` collection lets admins grant per-team access without making someone a club-wide Spielplaner. Admin-only accordion on `/admin/spielplanung` to manage assignments.
- **Week view with drag-to-reschedule.** New Week option in the view toggle renders a 14:00–22:00 time rail with absolutely-positioned game blocks (2h 45min: 45min warm-up + 2h play). Manual games are draggable (`@dnd-kit` PointerSensor + TouchSensor); 15-min time snap; synchronous conflict guard against the loaded game set; toast on success / warning / error. SVRZ blocks are not draggable.
- **Conflict checking for manual games.** `same_team_same_day` and `hall_overlap` block creation/move with errors; same team within ±2 days surfaces as a soft warning.

### Changed
- **Richer month-view chips.** Time, home/away icon, opponent and colour-coded left border (emerald = home, blue = away). Manual games carry a dashed outline.
- **Unclamped month navigation + season dropdown.** Prev/next arrows cross season boundaries; a new season picker jumps between seasons directly.
- **Game detail drawer gained an edit mode** with SVRZ-field locking — official fields (date, time, hall, opponent, league, round, scores) are disabled against edit for SVRZ-synced games; only duty assignments stay editable. Manual games expose full edit + delete. A "Copy SVRZ details" button makes Volleymanager paste-back a one-click operation.
- **Route access.** Users with `is_spielplaner = true` or ≥1 row in `spielplaner_assignments` can access `/admin/spielplanung` (previously admin-only).

### Deferred
- SVRZ Volleymanager write-back (Phase 2, separate research spike). For now the drawer offers "Copy SVRZ details" for manual paste.

## [4.1.0] — 2026-04-23

- **SVRZ game-scheduling invites.** New admin-issued per-verein invite flow replaces self-service opponent onboarding on `/terminplanung`. Admin picks a KSCW team, clicks "Aus SVRZ importieren" → system proposes opponent clubs + Spielplanverantwortlicher contacts (primary source: per-game `getTeamContactInfosByGame`, fallback: club-level `svrz_spielplaner_contacts` feed). Admin edits/selects rows in a shadcn `Drawer`, clicks "Einladungen erstellen" → backend generates `crypto`-random tokens with 90-day TTL in `game_scheduling_opponents` (status `invited`), idempotent on `(kscw_team, season, email)`. One-click "Mail entwerfen" opens a pre-filled DE mailto via pure `buildInviteMailto`. Manual CSV paste (`parseInviteCsv`) handles opponents not in SVRZ. Full lifecycle: `invited` → `viewed` (first open transitions + sets `first_viewed_at`) → `booked` (after slot pick / away proposal), with reissue + revoke actions. Existing `/terminplanung/slots/:token` + `/book-home` + `/propose-away` now accept the new invite statuses.
- **Daily SVRZ sync.** Cron at 03:00 Zurich (`kscw-hooks/src/index.js`) + admin-triggered endpoint (`POST /kscw/admin/terminplanung/svrz-sync`) spawn `directus/scripts/svrz-scheduling-sync.mjs`, which pulls games + contacts from VolleyManager via paginated `/search` endpoints and upserts into two new Directus collections (`svrz_games`, `svrz_spielplaner_contacts`) by `svrz_persistence_id`. Shared auth extracted into `directus/scripts/vm-client.mjs`.
- **Schema.** `game_scheduling_opponents` extended with `season` (M2O → `game_scheduling_seasons`), `status` enum, `source` enum, `created_by_admin`, `first_viewed_at`, `expires_at`, `team_name`. `game_scheduling_seasons` gained `svrz_season_uuid`. KSCW Sport Admin policy has wildcard field perms, so new fields are auto-permitted.

## [4.0.6] — 2026-04-22

- **Delete individual notifications + clear-read bulk action.** Each row in the mobile `NotificationPanel` and desktop `SidebarNotifications` now has a trash icon that calls `deleteNotification(id)` (optimistic remove + rollback on 4xx). The header gained a "Gelesene löschen" / "Clear read" button next to "Alle gelesen" which only appears when there's at least one read notification — deletes all read ones in parallel via `clearAllRead()`. Unread are left alone so nothing urgent disappears. Member policy already had `delete` on own notifications (setup-permissions.mjs:411), so no Directus change needed. Strings added in all 5 locales.

## [4.0.5] — 2026-04-22

- **Report notification routing (desktop) + capitalised reason.** The desktop `SidebarNotifications.getNavigationPath` was missing the `new_report` / `activity_type === 'report'` case the mobile panel already had, so clicking "New report: spam" silently navigated to `/` instead of `/admin/reports`. Added the route + `member_join_request` → `/teams/:id` (also missing on desktop), plus Flag icon and `newReport` activity label in all 5 locales. Separately, the notification body's raw reason enum (`spam`, `harassment`, `inappropriate`, `other`) was interpolated verbatim into the message template; `renderMessage` now resolves each through `messaging:reportReason_*` before interpolation, so "Neue Meldung: spam" becomes "Neue Meldung: Spam". Applied in both `NotificationPanel` (mobile) and `SidebarNotifications` (desktop).

## [4.0.4] — 2026-04-20

- Mobile More sheet: `/inbox` moved to top of secondary list (was getting lost below `/events`).

## [4.0.3] — 2026-04-20

- **More sheet parity with desktop sidebar.** Added `/inbox` (messaging flag), `/news`, `/admin/announcements`, `/admin/reports`, `/admin/infra`, and `/options/messaging` in the Options accordion. Replaced hardcoded `v1.0.0` with imported `APP_VERSION`.
- **Full-row profile link in More sheet.** Whole picture + name + team-chips block is one `NavLink` to `/profile`; Logout stays as a separate button.
- **Desktop sidebar gained Status + What's New** so it matches mobile.
- **`/status` is now a health dashboard.** Green/amber/red banner + 4-row checklist (App server, Swiss Volley / Basketplan / GCal syncs) driven by `useInfraHealth()`. Recent fixes list preserved below.
- Changelog items use `text-justify hyphens-auto leading-relaxed`.

## [4.0.2] — 2026-04-20

- **Migration 030 — close 4 remaining `members.read` gaps.** Self-read row gains `is_spielplaner` (was hiding the Spielplaner menu for 7 members), `kscw_membership_active`, `beitragskategorie` (ProfileEditModal always showed "Passiv"). Cross-member row gains `kscw_membership_active` (fixes coach-only empty lists in scorer assignment + delegation), `shell`, `shell_expires` (shell badge in MemberRow). Applied dev + prod, both Directus containers restarted.

## [4.0.1] — 2026-04-20

- **Migration 029 — consent modal accept-loop.** The KSCW Member self-read permission on `members` never had `consent_decision`, `consent_prompted_at`, or the four `communications_*` / `push_preview_content` columns added when Plan 01 introduced them. `fetchMember()` fetches without `fields=`, so Directus stripped them → `user.consent_decision === undefined` → `resolveConsentState()` showed the modal forever. Same root cause silently broke the DM button, team-chat tab, and messaging settings toggles. Fix appends the six fields to the self-scoped row.

## [4.0.0] — 2026-04-20

- **Messaging live for all club members.** Staged-rollout gate (`VITE_FEATURE_MESSAGING_ALLOWLIST`) retired in favour of the global flag on CF Pages. Team chats, DMs, requests/blocks, reactions, edit/delete, polls, reports, nFADP export — all previously shipped in 3.11–3.12 behind the allowlist — are now available to everyone. Config flip + rebuild only; no code changes.
- 4.0 marks completion of the messaging milestone — the PocketBase → Directus rewrite's original scope is delivered.

## [3.17.1] — 2026-04-20

- "Coach da" badge now shows on game/training cards and home-appointment rows for player-coaches. `ParticipationSummary` needs `coachMemberIds` to detect coaches who RSVP as players; detail modals had it but list cards + homepage rows didn't. Added `teamCoachIds(team)` helper in `utils/relations.ts` (unions `team.coach` + `team.captain` + `team.team_responsible`) and wired it into `TrainingCard`, `GameCard`, and four home rows. Events kept `hideExtras` — multi-team events have ambiguous "coach present" semantics.

## [3.17.0] — 2026-04-20

- **Auto-cancel trainings on hall closure** — closure CUD hooks in `kscw-hooks` flip `trainings.cancelled=true` for matching future trainings; delete/shrink reverses the cancel. `auto_cancelled_by_closure` marker (auto-cleared by BEFORE UPDATE trigger on manual edits) prevents overwriting coach cancels.
- **Closure source priority** in `dedupeClosuresByPriority`: `school_holidays > admin > hauswart > gcal > auto`. Sportferien beats "Halle geschlossen" on the same hall + date.
- **Create-time auto-decline on events** (mirrors trainings/games). **Date-change re-eval** on trainings/games/events reverses stale auto-declines and inserts fresh ones for the new date. **Absence delete + shorten unwinds** its auto-declines; manual overrides preserved via `auto_declined_by` marker trigger.
- Migration 028 adds `participations.auto_declined_by` + `trainings.auto_cancelled_by_closure`.

## [3.16.7] — 2026-04-20

- Response-time on participation roster now shows for confirmed + maybe, not just declined. Directus `date_updated` is only written on UPDATE — first-time responses had `NULL`. Both player and staff rows fall back to `date_created`.

## [3.16.6] — 2026-04-20

- **Migration 026 — coach write scoping.** KSCW Coach had `{}` (fully open) row filters on CUD for trainings/games/events/event_sessions/slot_claims/task_templates/referee_expenses/scorer_delegations — a coach from team A could modify team B's data via raw `/items/*`. Scoped via the `teams.coach` M2M alias (20 rows updated).
- **Migration 027 — Sport Admin delete lock.** Dropped `members.delete` + `teams.delete` from Sport Admin (club-wide blast radius → full admins only); create + update preserved.
- **CSP `connect-src` tightened** — dropped `https://*.sentry.io` wildcards (events go through our tunnel worker).

## [3.16.5] — 2026-04-20

- **CRITICAL — Migration 023.** Empty-object row filters on KSCW Member for `messages`/`conversations`/`message_reactions`/`reports` let any authenticated member enumerate every DM + report via `/items/*`. Scoped via `conversation_members.member.user=$CURRENT_USER` (+ reporter/reported self-filter for reports).
- **Migration 024.** `email` + `phone` removed from cross-member `members.read`; self-read row keeps them.
- Rate limits: 5 reports/hour/member on POST `/kscw/messaging/reports`; broadcast per-sender global cap of 10/hour on top of the per-activity soft cap.
- Soft-delete now nulls `body` + `original_body`; moderation report snapshots pre-redaction.
- **Migration 025.** Dropped `status` from anonymous-create whitelist on `feedback`.
- Vite 8.0.2 → 8.0.9 + DOMPurify patched.

## [3.16.4] — 2026-04-20

- **Full i18n sweep.** `formatDate` / `formatDateCompact` / `formatTime` + Hallenplan month now follow `currentLocale()` (reads `i18n.language`). Admin pages (`ResultsTable`, `AuditLog`, `InfraHealth`, `DataHealth`, `ExplorePage`), profile + member birthdates, scorer helpers, `VolleyFeedbackPage` (now fully 5-locale). Stripped 48 German `defaultValue:` fallbacks; sorting uses `i18n.language` instead of hardcoded `'de'`.

## [3.16.3] — 2026-04-20

- Own RSVP now reflected on `/trainings` + `/games` cards — `useActivitiesWithParticipations` bypassed `stringifyIds`, so integer vs. string FK comparison failed; exported + applied the helper.
- "Show response time" toggle works again — `ParticipationRosterModal` read PocketBase's `participation.updated`, renamed to Directus's `date_updated`.

## [3.16.2] — 2026-04-20

- Weekday abbreviations on home appointments now follow app language (`formatWeekday` was hardcoded `de-CH`).

## [3.16.1] — 2026-04-20

- Consolidated ConversationPage loading — header + thread + composer now appear together behind a single spinner.
- Admin `new_report` notifications now route to `/admin/reports`.

## [3.16.0] — 2026-04-20

- Chat layout: other users on the right, own on the left (fixed numeric-vs-string sender comparison). "edited" tag is a clickable popover showing `messages.original_body` (migration 022). Reactions + ⋮ menu stay visible on mobile (`opacity-60` instead of hover-only). Realtime partial-field updates now merge instead of replace; edit action applies body/edited_at/original_body optimistically.

## [3.15.9] — 2026-04-20

- 2. Liga 2nd place now marked as barrage up (SVRZ Art. 102a.4). Talents/RTZ teams shift promotion/relegation markers to the next eligible non-talents team (Art. 102a.7).

## [3.15.8] — 2026-04-20

- Rankings side-banner colours aligned with SVRZ Art. 102a — every regional group gets 1st direct promotion, 2nd barrage up, 2nd-to-last barrage down, last direct relegation. Men's 4L is now the bottom league (men have no 5L).

## [3.15.7] — 2026-04-20

- Inbox race conditions — `fetchSeqRef` guards on `useConversation` / `useConversations` / `useConversationMembers`; `useConversation` clears on conv switch and merges realtime creates that arrived during the fetch. Sentry tunnel worker replaced bare `catch {}` with branch-specific logged reasons.

## [3.15.6] — 2026-04-20

- `/games` 400 `Invalid numeric value.` — orphan `teams_coaches` / `teams_responsibles` rows with `teams_id=NULL` leaked `"null"` strings into the `kscw_team: {_in: …}` filter. Fixed in `useAuth.tsx` + migration 021 deletes 13 orphans and rebuilds FKs as `ON DELETE CASCADE`.

## [3.15.5] — 2026-04-20

- ConversationPage crash — `<Button asChild><Link>…</Link></Button>` passed `[null, <Link/>]` to Radix Slot → `React.Children.only` threw; `button.tsx` now skips the icon/loading fragment when `asChild`. CSP `connect-src` allows `cloudflareinsights.com`; added standard `mobile-web-app-capable` meta.

## [3.15.4] — 2026-04-20

- Single-round-trip `/games` + `/trainings` via new `POST /kscw/activities/:type/with-participations` (kills the ~1s empty-card flash on mobile). New `useActivitiesWithParticipations` hook; RBAC preserved via `req.accountability`.
- Games page splits Kommende + Resultate into "Meisterschaft" + "Cup" sections.

## [3.15.3] — 2026-04-20

- Event / Training / Game detail modal decluttering: `ParticipationSummary` uses the `bars` variant everywhere; `BroadcastButton` moved to modal header via new `Modal.headerAction` prop; roster button reduced to 44×44 icon-only.

## [3.15.2] — 2026-04-20

- **Migration 020 — Coach policy parity.** Added 12 perms (`teams.update`, `member_teams.create/update`, `team_requests.update`, `hall_slots.create/update` + `hall_slots_teams` CUD, `polls.create/update/delete`) to close 403s on UI-exposed paths (RosterEditor, TeamDetail, SlotEditor, PollsSection). Soft-rejects pending signups: `TeamDetail.handleReject` flips `kscw_membership_active` + `wiedisync_active` to `false` and clears `requested_team` instead of hard-deleting.

## [3.15.1] — 2026-04-19

- **Coach-event 403 fix.** M2M writes use junction-object format (`[{teams_id:3}]`); **migration 019** adds `events_teams` / `events_members` / `event_sessions` CUD to Coach + Admin policies.

## [3.15.0] — 2026-04-19

- **Datetime convention: proper UTC everywhere.** Migrated from wall-clock-labelled-UTC to proper `timestamptz` rendered via `Intl.DateTimeFormat({ timeZone: 'Europe/Zurich' })`. 9 new Intl-Zurich helpers in `dateHelpers.ts` (legacy formatters one-line-delegate). Backend email + iCal paths migrated. One-shot DB migration on 6 datetime columns with DST-aware round-trip helpers.

## [3.14.0] — 2026-04-19

- **Broadcast Plan 02 — in-app chat channel (event-only).** `inApp` channel creates a persistent `activity_chat` conversation per event and posts the broadcast as a message there. Participants (confirmed/tentative) auto-join via Postgres trigger on `participations`; declining auto-archives. Migrations 015–017. Honors `communications_team_chat_enabled`; banned users excluded.

## [3.13.0] — 2026-04-19

- **Broadcast v1.** Coaches/TRs/admins contact event/game/training audience via email + push (in-app deferred to 3.14). RBAC via teams, rate limit (3/hr + 20 min spacing), audit table. Generic `event_signups` replaces `mixed_tournament_signups`.

## [3.12.0] — 2026-04-19

- **Messaging v1 to prod (silent, allowlist-gated).** 4 SQL migrations, 32 team convos + 661 memberships backfilled. Hardening: revoked Supabase anon/authenticated grants on all 43 public tables; stopped all Supabase API containers except the DB.

## [3.11.x] — 2026-04-17

- **Vereinsnews.** Admin `/admin/announcements` + homepage News card + archive. `isSafeAppLink` rejects `javascript:` / `data:` CTAs; audience_teams/roles dropped from member read; mass-email confirm dialog.

## [3.10.0] — 2026-04-17

- **Admin Daten-Explorer `/admin/explore`** — hierarchical read-only browser, batched cache, fuzzy search, URL deep-link, sport-admin scoping.

## [3.9.x] — 2026-04-14 / 04-17

- Coach/TR inline participation editing in roster modal (3.9.0). Team page load-flash fix, team join-request notification hook, case-insensitive email lookup, team season normalisation + auto-rolling cron (3.9.1–3.9.4).

## [3.8.0] — 2026-04-10

- **Interactive guided tours.** 10 React Joyride tours, welcome modal, `/guide` menu, per-page "?" button.

## [3.6.0] — 2026-04-05

- **SV licence card** from `sv_vm_check`. Expanded VM sync (16 columns) with `vm_email` claim flow. Junction table PK fix + rename resolved 10 Sentry issues.

## [3.5.0] — 2026-04-05

- Shell-member detection (`shell=true` + `shell_expires`) with roster badge. `vm_email` claim flow during registration.

## [3.4.0 / 3.3.0 / 3.2.0] — 2026-04-04

- Hetzner VPS rollout (Supabase + Directus), DNS cutover, Web push via CF Worker, Sentry de.sentry.io/kscw/wiedisync wiring, 30+ KSCW endpoints, 9 Postgres triggers.

## [3.1.0] — 2026-03-31

- Error-log annotations (solved / important / open).

## [3.0.0] — 2026-03-29

- **Directus RBAC: 7 roles, 322 permissions, role-sync hook** — Admin, Coach, Sport Admin, Team Responsible, Vorstand, Member, public. Auto-admin new members with roles on approval.

## [2.7.0 – 2.9.0] — 2026-03-28 / 03-29

- Directus migration complete. Security hardening, branded emails (SMTP), web push, SSO via Directus auth, 9 Postgres triggers (slot claim validation, shell invites, coach approval guard, game-sync skip-without-away-team, etc.).

## [2.1.0 – 2.6.x] — 2026-03-24 / 03-26

- OTP login, team settings accordion, RSVP improvements, team photo zoom, referee expenses module, coach visibility on roster, RSVP timestamps.

## [2.0.x] — 2026-03-23

- Scoreboard tab, W/L splits, Hallenplan free-slot improvements, scorer delegation flow, API rules schema (coach/player dual-role on team-scoped tables).

## [1.1.0] — 2026-03-22

- PocketBase migrated from systemd to Coolify on VPS. Dockerfile, env-var secrets, CI job for hook lint, URLs consolidated on `kscw.ch`, Uptime Kuma at `status.kscw.ch`, Telegram alerts.

## [1.0.x] — 2026-03-19 / 03-20

- **Core platform launch.** React 19 + TS + Vite + Tailwind + PocketBase; CF Pages + Infomaniak VPS (CF Tunnel); 4 UI languages + Swiss German. Email + Google OAuth login, role approval, privacy + GDPR deletion. Games + Scoreboard + Calendar + Trainings + Participation + Absences + Events + Teams + Roster Editor + QR-code invite system + Hallenplan + Admin Mode + Notifications + Navigation + Admin Tools + Legal pages + Location autocomplete + Feedback/bug reporting. Member field renamed `active` → `kscw_membership_active`.
