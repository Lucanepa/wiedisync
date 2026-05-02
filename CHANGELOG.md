# Changelog

All notable changes to Wiedisync are documented in this file. Recent releases carry more detail; older entries are one-liners — see `git log` for the full text.

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
