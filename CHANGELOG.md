# Changelog

All notable changes to Wiedisync are documented in this file.

## [3.16.4] — 2026-04-20

### Changed

- **Full i18n sweep of hardcoded German/Swiss dates + labels.** Extension of the 3.16.2 `formatWeekday` fix to every other user-visible `de-CH` / hardcoded-German site across the app.
  - `src/utils/dateHelpers.ts`: `formatDate`, `formatDateCompact`, `formatTime` (+ their `…Zurich` originals) now accept an optional locale and default to `currentLocale()` (exported); `en-GB` is used for EN users to keep dd/mm + 24h expectations.
  - Localized: Hallenplan `DayNavigation` month abbreviation (was hardcoded `en-US`), `ProfilePage` birthdate, `MemberRow` birthdate, `StatusPage` public page dates, admin `ResultsTable`, `AuditLogPage`, `InfraHealthPage` (last-check + slow-query call counts), `DataHealthPage`, `ExplorePage` refreshed-at, and scorer helpers (`TeamOverview`, `ScorerRow`, `DelegationRequestBanner`) which now fall through to `fr` / `it` instead of always using `en-GB`.
  - `VolleyFeedbackPage` was bilingual only (`lang === 'de' ? … : en`) — now fully i18n with 20 new `vf*` keys added to all 5 `admin` locale bundles.
  - Stripped German `defaultValue: '...'` fallbacks from 48 `t()` calls across `DeleteAccountModal`, `GroupDmMenu`, `NewMessageDialog`, `BlockMemberDialog`, and `AnnouncementsPage` — these fell back to German labels for non-German users when the key was actually missing. Raw literal `'Speichern'` in `SpielsamstageEditor` replaced with `t('common:save')`.
  - Added missing keys: `common.create` (all 5 locales), `announcements.linkInvalid` + `announcements.confirmMassEmail` (all 5 locales).
  - Sorting: `localeCompare` / `Intl.Collator` in `RefereeExpenseSection`, `useAttendanceStats`, `AssignmentEditor`, `DelegationModal`, scorer `TeamOverview` now use `i18n.language` instead of always `'de'`.

## [3.16.3] — 2026-04-20

### Fixed

- **Own RSVP not reflected on `/trainings` and `/games` cards.** The Yes / Maybe / No buttons on the trainings + games lists rendered in the default grey "no response" state even when the current user had already responded — the colored left banner was also missing. `useActivitiesWithParticipations` (introduced in 3.15.4) calls `kscwApi` directly, which does not run responses through `stringifyIds` like the rest of the data layer does. Result: `p.member` came back as a Postgres integer (e.g. `8`) while `user.id` was `"8"` (string, normalised on its way in). The strict-equality `p.member === user.id` mapping in `TrainingsPage` and `GamesPage` therefore never matched, so `myParticipation` was always `undefined`. Fixed by exporting `stringifyIds` from `src/lib/api.ts` and applying it to both `items` and `participations` in `useActivitiesWithParticipations` — same convention as the standard REST path. The participation roster modal already worked because it goes through `useCollection`.
- **"Show response time" toggle had no effect.** `ParticipationRosterModal` read `participation.updated` / `sp.updated` — the PocketBase field name. After the Directus migration the field is `date_updated` (already returned by both the standard REST path and the `/with-participations` endpoint, where it's in `DEFAULT_PARTICIPATION_FIELDS`). The check `showRsvpTime && participation?.updated` was therefore always falsy, so the timestamp row never rendered regardless of the toggle. Renamed both call-sites to `participation.date_updated` / `sp.date_updated`.

## [3.16.2] — 2026-04-20

### Fixed

- **Weekday abbreviations now localized.** `formatWeekday()` in `src/utils/dateHelpers.ts` was hardcoded to `de-CH`, so EN/FR/IT users still saw "Mo / Di / Mi …" in the upcoming appointments list on `/` (`AppointmentTableRow`, `AppointmentRow`, `CompactTrainingRow`). Added a `currentLocale()` helper that reads `i18n.language` (gsw → de-CH, en → en-GB to keep dd/mm + 24h expectations); `formatWeekday` now resolves it automatically. Parent `HomePage` already uses `useTranslation`, so children re-render on language switch and pick up the new abbreviations without further changes. Date + time formats are still Swiss-format intentionally.

## [3.16.1] — 2026-04-20

### Fixed

- **Staggered load on the conversation page.** `ThreadView` used to render as each of its sub-hooks resolved independently — first `!conv` → "loading", then the thread appeared with the header title still set to `'—'` (display-names not yet back), then the peer avatar + thread header title filled in after `useConversationMembers` resolved. Also `useConversation.isLoading` + `useConversationMembers.loading` both initialized to `false`, so the very first render briefly looked "ready with 0 messages / 0 members" before the mount-effect's `refetch()` flipped them true. Fix: initialize both to `true` (guard `useConversationMembers` with `!!conversationId` so disabled callers don't stick), and gate the entire `ThreadView` render on a consolidated `isReady = !isLoading && (!needsMembers || !membersLoading)` — single spinner up, full UI comes in at once.
- **Notification click does nothing for admin report alerts.** Admin `new_report` notifications (type `new_report`, activity_type `report`) weren't handled by `NotificationPanel.getNavigationPath`, so they fell through to `/`. Added an explicit case that routes to `/admin/reports`, where the resolve-or-dismiss UI lives. Also added `'new_report'` and `'report'` to the `Notification` type union so the compiler can guide future additions.

## [3.16.0] — 2026-04-20

### Chat

- **Other users' messages now render on the right; your own stay on the left.** Reverses the prior layout where both sides appeared on the left — caused by `m.sender === currentMemberId` failing when one side was a number and the other a string (Postgres/Directus returned the FK as a number). Fixed the comparison in `ConversationThread` with `String(...)` coercion and flipped the alignment + popover directions in `MessageBubble` + `MessageActions`.
- **Edit history on "edited" tag.** Messages can still be edited at any time, but the "edited" tag is now a clickable button that reveals the original body in a popover. Column `messages.original_body` added (migration 022) — the PATCH endpoint snapshots the pre-edit body on first edit only, so the original (not the last) version stays visible. `MessageBubble` renders a lightweight popover anchored left/right to match the bubble side.

### Fixed

- **Reaction button + ⋮ actions now visible on mobile.** Both used `opacity-0 group-hover:opacity-100`, which never fires on touch devices — so reactions looked broken and message actions (edit/delete/report) were unreachable. Switched to `opacity-60 hover:opacity-100` so they stay visible, slightly dimmed. Fixed in `ReactionBar.tsx` + `MessageActions.tsx`.
- **Editing a message now updates the bubble immediately.** Directus realtime `update` events deliver *only the changed fields*, so `setMessages(prev.map(m => m.id === e.record.id ? e.record : m))` replaced the row with a partial object, dropping `sender`/`created_at`/etc. Fix: merge (`{...m, ...e.record}`) instead of replace. Additionally, `useConversation` now exposes an `editMessage` action that performs the PATCH and applies `body`/`edited_at`/`original_body` optimistically, so the UI updates even if realtime lags or is dropped. `EditMessageInline` now surfaces save errors under the textarea (previously swallowed by a bare `catch {}`).
- **Reactions now reconcile even when realtime misses the event.** `useReactions.toggle` applies an optimistic change (so the tap feels instant) and triggers a `refetch()` afterwards, so the bar always ends up in sync with the server.

### Schema

- `messages.original_body text NULL` — applied on dev (`directus_kscw_dev`) and prod (`postgres`) via migration 022.

## [3.15.9] — 2026-04-20

### Fixed

- **2. Liga rankings now mark the 2nd place as barrage up (blue).** Completes the SVRZ Art. 102a alignment from 3.15.8 — Art. 102a.4 grants every regional group's 2nd place a barrage match, and 2L was still missing the blue marker. 1L left unchanged (Final-Four mechanics, Art. 168–170, are not standard 102a).
- **Talents (RTZ) teams now shift promotion/relegation markers to the next eligible team.** Per Art. 102a.7 talents teams cannot promote or relegate, so they never get a marker themselves — but previously they still occupied the "1st" or "last" slot in the colour logic, hiding the marker from the team that actually qualifies. `getPromotionColor` now computes each team's effective position among non-talents teams, so e.g. if 1st is Talents the 2nd-placed non-talents team gets green, and if last is Talents the 2nd-to-last non-talents team gets red. Fixed in `src/utils/leaguePromotion.ts` + `RankingsTable.tsx`.

## [3.15.8] — 2026-04-20

### Fixed

- **Rankings side-banner colours now follow SVRZ Art. 102a.** Per the Volleyballreglement 25/26 every regional group (2L–5L) has 1st = direct promotion, 2nd = barrage up, 2nd-to-last = barrage down, last = direct relegation. The previous mapping was missing orange for the 2nd-to-last in 3L and blue for the 2nd in 4L/5L, so teams in a barrage spot were rendered as if they were safe. Also made men's 4L the bottom league (men have no 5L per the reglement's referee/scorer tables), so men's 4L last place no longer shows red. Fixed in `src/utils/leaguePromotion.ts`.

## [3.15.7] — 2026-04-20

### Fixed

- **Inbox race conditions.** Three fetch/realtime races in `src/modules/messaging/hooks/`:
  1. `useConversation.refetch` had no stale-response guard — switching conversations A→B while A was slow could let A's response land after B's and overwrite B's thread.
  2. The same resolver replaced the `messages` array with the server snapshot, dropping any realtime `create` events that had already appended during the in-flight fetch.
  3. `useConversations.refetch` and `useConversationMembers.refetch` had the same stale-response shape (less visible, but present).
  Fix: added a monotonic `fetchSeqRef` to each hook; late resolvers short-circuit when their seq no longer matches. `useConversation` also now synchronously clears messages on conv switch (so the old thread doesn't flash) and merges realtime extras with the server list instead of overwriting.
- **Sentry tunnel opaque 400s.** `workers/sentry-tunnel/src/index.ts` had a single bare `catch {}` returning `Bad envelope` for everything — including the real cause of the 400 the user reported from `button-*.js`. Replaced with distinct, logged reasons (`gzip-decode-failed`, `empty-body`, `header-json-invalid`, `no-dsn`, `invalid-dsn-url`, `unexpected`) so `wrangler tail` surfaces which branch is firing next time. Worker redeployed.

## [3.15.6] — 2026-04-20

### Fixed

- **Games page 400 `Invalid numeric value.`** Orphan coach/TR junction rows (`teams_coaches` / `teams_responsibles`) with `teams_id = NULL` leaked `String(null)` = `"null"` into the frontend's `kscw_team: { _in: [...] }` filter. Directus 11.17 `castToNumber` throws on any non-numeric element of `_in` for an integer-typed column, so the whole `POST /kscw/activities/game/with-participations` request failed. Previously masked by the old waterfall (which silently swallowed the games fetch error and rendered empty cards); the v3.15.4 consolidation surfaced it as a hard crash. Fixed in `src/hooks/useAuth.tsx`: drop null team FKs before `String(...)` on coach/TR/member_teams/captain arrays, and guard the two downstream `memberTeams` loops.

### Infrastructure

- **Junction tables now `ON DELETE CASCADE`.** `teams_coaches` + `teams_responsibles` FKs on both `teams_id` and `members_id` were `ON DELETE SET NULL`, which left 13 zombie rows (7 + 6) when a team was deleted over the project lifetime. Migration `directus/scripts/021-junction-cascade.sql` deletes the orphans, rebuilds the FKs with `CASCADE`, renames the constraints off the legacy `teams_members_3/4_*` names, and syncs `directus_relations.one_deselect_action` to `delete`. Applied to prod + dev. Snapshot updated.

## [3.15.5] — 2026-04-20

### Fixed

- **ConversationPage crash on load.** `<Button asChild><Link>…</Link></Button>` passed `[null, <Link/>]` to Radix's `Slot`, which trips `React.Children.only` in `SlotClone` (at `@radix-ui/react-slot/dist/index.mjs:56`). The blank-screen fallback on `/inbox/:conversationId` was caused by the ErrorBoundary catching this. Fixed in `src/components/ui/button.tsx`: when `asChild` is true, skip the icon/loading fragment entirely and pass `children` as the single Slot child. Icon/loading with `asChild` was never meaningful anyway (Slot only renders the child element). Same pattern fixes `MessagingDisabledBanner` and `MessagingSettingsCard` which also use `<Button asChild>`.

### Changed

- **CSP `connect-src` allows `https://cloudflareinsights.com`.** Cloudflare's RUM beacon (injected by CF Pages) was being blocked — harmless but noisy in the console. `script-src` already allowed `static.cloudflareinsights.com` for the script itself; added the beacon endpoint to `public/_headers`.
- **`mobile-web-app-capable` meta tag added.** The Apple-specific `apple-mobile-web-app-capable` is deprecated in favor of the standardized name; added the standard one alongside the Apple one in `index.html` to silence Chrome's warning.

---

## [3.15.4] — 2026-04-20

### Performance

- **Games + Trainings: single round-trip load (no more empty-card flash on mobile).** `/games` and `/trainings` previously fetched activities first, then derived IDs and issued a second request for participations — ~500ms–1s of cards rendering without RSVP bars on mobile. Collapsed into one request via new endpoint `POST /kscw/activities/:type/with-participations` (`type` ∈ `game`|`training`), which runs both reads server-side under the requester's Directus accountability (RBAC parity with `/items/games`). Frontend exposes it as `useActivitiesWithParticipations` in `src/lib/query.tsx`, replacing the two chained `useCollection` calls on each page.

### Changed

- **Games page — separate League vs Cup sections.** On `/games`, both the Kommende (upcoming) and Resultate (results) tabs now split games into two stacked sections: "Meisterschaft" (regular championship) and "Cup" (Mobiliar Volley Cup, Züri Cup, and any `Cup|Pokal|Turnier` league string). Section headings only appear when both categories have entries — single-category views look identical to before. Same sort order (ascending for upcoming, descending for results), team filter and sport toggle still apply to both sections. Implemented in `GamesPage.tsx` via `isCupGame()` regex on `game.league`; i18n keys `sectionLeague` + `sectionCup` added to de/en/fr/it/gsw.

---

## [3.15.3] — 2026-04-20

### Changed

- **Event / Training / Game detail modal — mobile decluttering.** The RSVP summary row at the bottom (previously "4 Confirmed / 0 Maybe / 5 Declined" text) now uses the same 3-rectangle `bars` variant shown on cards, so the visual language is consistent between list and detail views. The broadcast (paper-plane) button moved from the inline footer to the upper-right of the modal header. The "Teilnahme" roster button lost its text label and is now a 44×44 icon-only button (`aria-label` preserved). Applies on both mobile and desktop. Same treatment rolled into the Game detail modal (custom header), with `ParticipationSummary` switched from `compact` to `bars` and the duplicate footer broadcast button removed. `Modal.tsx` gained a `headerAction` prop used by the event + training modals to inject the broadcast button into the dialog/drawer header.

---

## [3.15.2] — 2026-04-20

### Fixed

- **Coach policy parity — closed remaining 403 gaps on team management.** Following the pattern of v3.15.1, the `KSCW Coach` policy was missing write perms on several collections the coach UI already exposes. Granted 12 perms via `directus/scripts/020-coach-policy-parity.sql` (idempotent, applied to dev + prod, both containers restarted): `teams.update` (RosterEditor role/team_picture writes, TeamDetail banner crop), `member_teams.create/update` (approve pending member, edit guest_level), `team_requests.update` (approve/reject join requests), `hall_slots.create/update` + `hall_slots_teams` CRUD (SlotEditor own-team writes), and `polls.create/update/delete` (PollsSection on team page).
- **Soft-reject pending member signups** — `TeamDetail.handleReject` no longer hard-deletes the member record. It now updates the member with `kscw_membership_active=false`, `wiedisync_active=false`, and `requested_team=null`, which drops them off the pending list (filter requires `requested_team=teamId`) while preserving the record for audit. Avoids granting coaches unrestricted `members.delete`.
- **Changelog convention** — All entries in `ChangelogPage.tsx` (and `CHANGELOG.md`) must be written in English, even though the app UI is German. Documented in both `CLAUDE.md` and `INFRA.md`.

---

## [3.15.1] — 2026-04-19

### Fixed

- **Coaches could not create events for their team** — save returned `403 FORBIDDEN "You don't have permission to access this."` whenever the event payload contained a non-empty `teams` (or `invited_members`) array. Two independent causes stacked on top of each other: (1) the frontend sent M2M relations as flat primary-key arrays (`teams: ["3"]`), which Directus 11 interprets as "link existing junction rows by PK" and 403s when the junction PK doesn't exist; (2) the `KSCW Coach` policy had CRUD on `events` but only `read` on the `events_teams` and `events_members` junction tables. Fixed the frontend (`EventForm`) to submit junction-object format (`teams: [{ teams_id: id }]`, `invited_members: [{ members_id: id }]`) for both create and update, and granted CRUD on both junction tables to the `KSCW Coach` and `Administrator` policies via `directus/scripts/019-events-junctions-permissions.sql` (idempotent). Applied to dev + prod DBs; prod Directus container restarted to refresh the permission cache.

---

## [3.15.0] — 2026-04-19

### Changed

- **Datetime convention: proper UTC everywhere** — migrated from "wall-clock-labelled-UTC" (Wiedisync `parseWallClock` stripped the offset; Directus admin converted it; the two disagreed) to proper UTC stored in `timestamptz` + rendered via `Intl.DateTimeFormat({ timeZone: 'Europe/Zurich', … })`. All five surfaces (Directus admin, Wiedisync UI, email, iCal, push) now agree on the Zurich-local hour for every event, training, game, and announcement. DST transitions are handled natively by the Intl layer.
- **Frontend** — 9 new Intl-Zurich helpers in `src/utils/dateHelpers.ts` (`formatTimeZurich`, `formatDateZurich`, `formatDateCompactZurich`, `formatDateShortZurich`, `formatWeekdayZurich`, `formatDateTimeCompactZurich`, `formatRelativeTimeZurich`, `toUtcIsoFromDatetimeLocal`, `toDatetimeLocalFromUtcIso`). The 7 legacy public formatters now one-line-delegate to them, so call sites kept their imports. 13 render-sites, 6 form writers (`EventForm`, `AnnouncementsPage`, `RecordEditModal`, `AwayProposalForm`, `TrainingForm`, `RecurringTrainingModal`), and 3 string-split hacks (`EventCard`, `TrainingCard`, `TrainingDetailModal`) migrated. `parseWallClock` and `toApiDatetime` removed.
- **Round-trip helpers are DST-aware** — `toUtcIsoFromDatetimeLocal` computes the Europe/Zurich offset twice (guess instant + corrected instant) and uses the corrected-instant offset when they differ, so spring-forward gaps and fall-back ambiguity resolve to the same values browsers produce for `new Date('2026-03-29T02:30')` in a Zurich locale.
- **Backend** — `directus/extensions/kscw-endpoints/src/email-template.js` (`formatDateCH`, `weekday`, `buildBroadcastEmail` time extraction) and `ical-feed.js` events path (`toZurichICSLocal`) replaced `.getUTC*()` accessors and `String(ev.start_date).split(' ')[1]` hacks with `Intl.DateTimeFormat` on `Europe/Zurich`. Games path (reads TZ-naive `games.date` + `games.time` columns) untouched; same for `gcal-sync.js`, `bp-sync.js`, `sv-sync.js`.
- **One-shot DB migration** — `UPDATE <table> SET <col> = <col>::timestamp AT TIME ZONE 'Europe/Zurich' WHERE <col> IS NOT NULL` applied to both dev and prod across 6 columns (`events.start_date/end_date/respond_by`, `trainings.respond_by`, `games.respond_by`, `announcements.expires_at`). 14 non-midnight + 26 midnight row updates per environment. Midnight rows included so the `getDeadlineDate` Zurich h:m:s=00:00:00 end-of-day sentinel keeps working after the stored value becomes real UTC.

### Technical

- **Tests**: 18 new vitest cases for the Intl helpers (CEST, CET, DST spring-forward gap, DST fall-back ambiguity, Directus `YYYY-MM-DD HH:MM:SS` space format, bare `HH:MM` passthrough, null/invalid) + 7 for the rewritten `parseRespondByTime` + `getDeadlineDate`. 202/202 frontend + 25/25 backend broadcast-helpers green. `tsc -b --noEmit` + `vite build` clean.
- **Spec SQL direction was inverted** — `<col> AT TIME ZONE 'Europe/Zurich' AT TIME ZONE 'UTC'` shifts +2h (wrong direction); correct is `<col>::timestamp AT TIME ZONE 'Europe/Zurich'` which reinterprets the stored digits as Zurich-local and shifts -2h in CEST. Caught by the pre-migration dry-run.
- **Prod DB requires `supabase_admin`** — `events` (and likely other KSCW tables) are owned by `supabase_admin` with RLS enabled and zero grants to the `postgres` user. Migration path: `ssh hetzner "sudo docker exec -i supabase-db-vek42jyj0owoutoouq29aisq psql -U supabase_admin -d postgres"`.
- **Rollout timing** — rolled out mid-event (Mixed-Turnier 2026 active 12:30–16:00 Zurich) with user approval. The concurrent v3.14.0 broadcast-02 release had already merged the new Intl code to prod before the DB migration, so there was a brief window where prod served new-frontend-on-old-DB (displayed 14:30 instead of 12:30). Closed by applying the SQL UPDATE immediately after dry-run confirmation.

---

## [3.14.0] — 2026-04-19

### Added

- **Broadcast — In-App Chat channel (event-only)** — the broadcast dialog gains a third channel alongside email + push: `inApp`. When enabled, the endpoint finds-or-creates a persistent `activity_chat` conversation for the event and posts the broadcast as a message there. Participants (`confirmed` / `tentative`) auto-join via a Postgres trigger on `participations`; declining auto-archives the member's row (history preserved). The success toast shows an "Open chat" action that deep-links to `/inbox/:conversation_id`. Bidirectional: participants can reply in the thread (`POST /messaging/messages` accepts `activity_chat` type).
- **Event-only by design** — `inApp=true` is rejected with 400 `broadcast/inapp_events_only` for games/trainings (schema CHECK + endpoint guard). Per team feedback: activity chats only exist where commitment is event-level, not team-schedule-level.
- **Honors the global messaging opt-out** — users with `communications_team_chat_enabled=false` are auto-archived in new event chats (same rule as team chats). The broadcast sender is always force-unarchived so they see the thread they just sent. Banned users are excluded entirely.
- **Feature-flag gated in UI** — inApp checkbox stays disabled with "Bald verfügbar" tooltip unless `VITE_FEATURE_MESSAGING=true` or the sender is on the messaging allowlist. Backend endpoint runs independent of the flag.

### Changed

- **`conversations` schema**: new `activity_type` + `activity_id` columns, new shape CHECK enforcing exactly one of (team / DM pair / activity_chat), event-only activity_type CHECK, partial unique index `uq_conversations_one_per_activity` (one chat per event).
- **`conversation_members` sync**: new trigger `trg_participations_activity_chat_sync` on `participations` (INSERT / UPDATE / DELETE) keeps membership aligned with RSVP state. No-op when no activity_chat exists yet — broadcast endpoint is sole provisioner.
- **Event-delete cleanup**: new `trg_activity_chat_event_delete` AFTER DELETE on `events` removes the corresponding activity_chat conversation (FK CASCADE handles messages, members, reactions, polls, reports).

### Technical

- Migrations: `015-conversations-activity-chat.sql`, `016-participations-activity-chat-sync.sql`, `017-activity-chat-cleanup-triggers.sql` — all idempotent, applied to dev + prod.
- Tests: 25/25 unit (was 19 — 5 new for `findOrCreateActivityConversation`, 1 payload test replaced). 23/23 integration (13 Plan 01 + 10 Plan 02 — inApp happy path, training/game rejection, inbox surfacing, reply, 3 trigger paths, cleanup trigger, audit-row integrity).
- Audit row: `channels_sent.in_app` + `delivery_results.in_app { sent, failed, conversation_id, message_id }`.
- No push duplication: broadcast writes messages via `ItemsService` directly, bypassing the `POST /messaging/messages` route's `firePushForMessage` hook. When sender selects `push=true + inApp=true`, only the broadcast's own push fires (linking to `/events/:id`).

---

## [3.13.0] — 2026-04-19

### Added

- **Broadcast (Contact-All) feature** — coaches, team-responsibles, sport-admins, vorstand, and admins can send a one-click broadcast to all participants of an event, game, or training. New endpoint `POST /kscw/activities/:type/:id/broadcast` (+ `/preview` for live recipient count) supports email + push channels, selectable audience by participation status (confirmed / tentative / declined / waitlist / interested / invited), include-externals toggle for events, 2000-char message + optional subject (required for email). RBAC enforced server-side. Per-recipient locale-picked email via existing `buildEmailLayout` template. Push fan-out via existing `sendPushToMembers` worker. Frontend `<BroadcastButton />` (gated by `canBroadcast` predicate) wired into Event / Game / Training detail modals; opens shadcn Modal with channel checkboxes, status multi-select, externals toggle (event only), subject input (email only), 2000-char message textarea, and live "Empfänger: N (M Mitglieder · E Extern)" preview (300ms debounced). i18n: `broadcast` namespace in de/en/fr/gsw/it. Phase B (in-app chat channel) deferred until messaging feature flag flip is broader.

### Changed

- **Generic external signups** — replaced single-purpose `mixed_tournament_signups` table with `event_signups` (polymorphic via `event` FK + `form_slug` discriminator + `form_data` jsonb). Existing 8 prod / 5 dev rows migrated. `kscw-website` mixed-tournament form repointed to write `event_signups` with `event=5, form_slug='mixed_tournament_2026'`. Turnstile guard hook + `/public/mixed-tournament/non-member-count` endpoint cut over. Old `mixed_tournament_signups` table left in place as fallback (drop deferred). Future public signup forms (gala, summer camp, …) just pick a new `form_slug`.

### Audit

- **Broadcasts audit table** — every broadcast send writes a `broadcasts` row: sender, audience snapshot, recipient IDs (members + externals), channels used, message body, subject, delivery results (per-channel sent/failed). Indexed by `(activity_type, activity_id, sent_at)` for the rate-limit lookup (max 3/hour per activity, ≥20 min between broadcasts).

### Technical

- **`event_signups`** schema: `event` FK (nullable for standalone forms), `form_slug` discriminator, `name`, `email`, `sex`, `language`, `is_member`, `member` FK, `form_data` jsonb, `consent` jsonb, `date_created`, `date_updated`. Indexes on `event`, `form_slug`, `LOWER(email)`.
- **`broadcasts`** schema: `id`, `activity_type` (CHECK constraint: event|game|training), `activity_id`, `sender` FK, `channels_sent` jsonb, `audience_filter` jsonb, `recipient_count`, `recipient_ids` jsonb, `subject`, `message`, `delivery_results` jsonb, `sent_at`.
- **Tests**: 19 backend unit tests for helpers; 13 backend integration assertions against dev (happy path, preview, audience expand, externals, RBAC, rate-limit, validation, audit, 404, empty audience). 15 frontend `canBroadcast` predicate tests. Real test emails routed to `.kscw.test` reserved domain.

---

## [3.12.0] — 2026-04-19

### Added

- **Messaging v1** — full messaging system built and deployed to production backend: team chats, direct messages, polls, reactions, reports/moderation, nFADP consent flow, JSON data export (1×/day), push notifications (generic or preview). All 7 collections + Postgres triggers + RBAC + extension endpoints live on `directus.kscw.ch`. Feature is shipped silent (code present, UI hidden) — activation happens via a separate CF Pages env var flip, with per-member allowlist support for a staged rollout to a test group before the club-wide launch.
- **Privacy policy — Messaging section** — new section 9 "Nachrichten (Messaging)" at `/datenschutz#nachrichten` covering data stored, 12mo/30d/90d retention, access, rights, reports, and push notifications. All 5 locales (de/en/fr/gsw/it).
- **Staged rollout allowlist** — `messagingFeatureEnabled(memberId)` now reads a `VITE_FEATURE_MESSAGING_ALLOWLIST` env var (comma-separated member IDs) so the feature can be turned on for a small test group before the global `VITE_FEATURE_MESSAGING=true` flip. Global flag still wins.

### Security

- **Supabase anon/authenticated DB lockdown** — new migration `011-revoke-supabase-anon-all.sql` revokes ALL table, view, and sequence privileges from the Supabase `anon` and `authenticated` Postgres roles in the `public` schema, revokes `USAGE` on the schema, and strips default privileges for future objects. Closes a defense-in-depth gap where 43 prod tables (including all 7 messaging collections, `members`, `games`, `trainings`, `polls`) had CRUD + TRUNCATE grants to roles that were only ever meant for the Supabase REST gateway — which this project does not use.
- **Supabase API layer shut down** — stopped (with `--restart=no`) the Supabase containers that this project doesn't use: Kong, PostgREST, GoTrue, Edge Functions, Storage, MinIO, Studio, Meta, Vector, Analytics, Supavisor, imgproxy, realtime. Only `supabase-db` remains running (used by Directus as the Postgres engine). Reduces attack surface.
- **Messaging RBAC row-filter tightening** — member-role READ on `blocks`, `message_requests`, and `conversation_members` is now scoped to `$CURRENT_USER`-owned rows via row filters. Previously unfiltered — a member could enumerate others' block pairs and request memberships via raw `/items/*` calls. Hooks already filtered at fetch-time for correct UX; this closes the REST-layer gap. (Deferred Plan 01 task #47, now landed.)
- **Admin hygiene** — removed 2 leftover test directus_users + 3 test members (+ cascade-deleted messaging rows) from dev; eliminated dev/prod permission drift (both now at exactly 9 policies × matching perm counts); dropped unused `yob` column from `members` on both DBs; rotated one member-role static token that had been lingering.

---

## [3.11.2] — 2026-04-17

### Security

- **Vereinsnews — CTA link XSS guard** — `announcement.link` was rendered as `<a href>` with no scheme validation, so an admin (or a compromised admin account) could post `javascript:…` or `data:…` and execute script in every reader's browser. New `isSafeAppLink` util (allows `http(s)://` + same-origin `/path` only) now gates both the admin save (`AnnouncementsPage.handleSubmit`) and the reader render (`AnnouncementDetailModal`). Invalid links are rejected on save with a toast and silently hidden on render.
- **Vereinsnews — field whitelist tightened** — dropped `audience_teams` / `audience_roles` from the Member + Team Responsible read-permission whitelists on dev and prod. These v2 targeting arrays would have leaked admin intent (e.g. "for Vorstand only") to every logged-in member once role/team audiences go live. Applied via SQL `UPDATE directus_permissions` on both DBs and mirrored in `setup-permissions.mjs`.
- **Vereinsnews — mass-email confirmation gate** — publishing with `notify_email` + `audience_type='all'` now shows a `window.confirm` prompt before the save hits Directus. Guards against the 200-member mis-send trap already flagged in CLAUDE.md.

### Fixes

- **Anonymous 403 spam on `/events`** — `EventDetailModal`, `EventForm` and `ParticipationRosterModal` now gate the `event_sessions` / `absences` / staff-participation fetches on `!!user`, so logged-out visitors no longer flood the error log with "You don't have permission to access collection …".
- **Admin Daten-Explorer — scorer-delegations 403** — `useRelatedEntities` requested `original_scorer` / `delegated_to` (fields that don't exist on `scorer_delegations`). Query now uses the real schema: `from_member`, `to_member`, `status`, `role`, `date_created`. Rendering already expected these names.
- **Admin Vereinsnews 403** — the list query sorted by `-date_created`, a system field that was never created by `005-add-announcements.mjs` (every other KSCW collection has it). Directus returned 403 *"field does not exist"* for every admin load of `/admin/announcements`. Migration script now creates `date_created` + `date_updated` with the standard `date-created` / `date-updated` specials; re-ran against dev and prod. Admin list sort tiebreaker also switched from `-date_created` to `-id` as a belt-and-suspenders workaround.
- **Empty `client_error` payload floods** — `sendToErrorLog` in `src/lib/sentry.ts` now short-circuits when the entry has no `error` / `stack` / `type` / `responseBody`. The `/client-error` backend endpoint in `kscw-endpoints` also rejects empty payloads (defence in depth). Fixes ~26/day null-field log entries.
- **ParticipationRosterModal — memberIds dep stability** — extracted a `memberIdsKey` string so the absences `useCallback` + `useEffect` chain has a stable primitive dep, reducing a potential render-loop vector tied to today's "Maximum call stack size exceeded" crash on `/events`.

## [3.11.1] — 2026-04-17

### Fixes

- **Admin Daten-Explorer — Teams section for coaches/TRs/captains** — A member who is only a coach, team-responsible or captain (no `member_teams` row) previously showed "Teams 0". The cache now also fetches `teams_coaches` and `teams_responsibles` junctions and derives captain associations from `teams.captain` (M2O). All four relations are unioned into the Teams table, with a new **Beziehung** column labelling each row (Spieler:in / Trainer / Team-Verantwortlich / Captain). Sport-scope filtering for members also considers coach/TR/captain teams now.
- **Admin Daten-Explorer — capitalisation & localisation in member detail** — Subtitle `members · #11` now renders as the localized bucket name (`Mitglieder · #11`). Sex value resolves `m`/`f` to `Männlich`/`Weiblich`. Role array is capitalized (`User, Vorstand` instead of `user, vorstand`). Participation status cells use existing `explorerStatus_*` keys (`Zusagen`/`Absagen`/`Vielleicht`/`Warteliste`) instead of raw English.
- **Admin Daten-Explorer — orphaned participation rows** — Participations referencing an event / training / game outside the 90-day cache window (or deleted) were rendered as a bare `#6`. They now render as italic-muted `Event #6 (entfernt)` / `Training #6 (entfernt)` / `Spiel #6 (entfernt)` with the type made explicit.
- **Admin Daten-Explorer — referee-expenses 403** — The Schiedsrichter-Spesen section was 403-ing for every user because `useRelatedEntities` filtered on `referee` and requested `date` / `status` — none of which exist in the `referee_expenses` collection (schema: `paid_by_member`, `paid_by_other`, `amount`, `notes`, `game`, `team`, `recorded_by`). Query now filters on `paid_by_member` and reads the real fields. Table columns changed to **Datum / Betrag / Notizen**, amount formatted as `CHF x.xx`.
- **i18n** — Added `explorerSexMale`, `explorerSexFemale`, `explorerColRelation`, `explorerColNotes`, `explorerRelationPlayer`, `explorerActivityEvent`, `explorerActivityTraining`, `explorerActivityGame`, `explorerActivityRemoved` across de/en/fr/gsw/it.

## [3.11.0] — 2026-04-17

### Features

- **Vereinsnews** — new admin page (`/admin/announcements`) for posting club-wide announcements that surface in the homepage News card alongside notifications. Each post supports a hero image, per-locale title + rich-text body (de/en/fr/gsw/it via TipTap editor), an optional CTA link, pin-to-top, expiry date, and audience targeting (all members or one sport in v1; teams/roles schema-ready). Per-post toggles control whether publishing also fires a push notification and/or an email blast (each one fans out exactly once via `fanout_sent_at` guard). The homepage News card merges announcements with notifications, sorted with pinned posts first then newest first, capped at 3 with "Alle anzeigen" linking to a paginated `/news` archive. Tap a row to open the full detail modal.

## [3.10.0] — 2026-04-17

### Features

- **Daten-Explorer** (`/admin/explore`) — new admin page: a read-only hierarchical browser over Members, Teams, Events, Trainings and Games. Global fuzzy search with `⌘K` / `Ctrl+K`, URL deep-link (`?t=<type>&id=<id>`), in-panel breadcrumb, and lazy-loaded related sub-sections (participations, absences, Schreibereinsätze, referee expenses, scorer delegations). Sport admins (vb_admin / bb_admin only) are scoped to their sport; club-wide events remain visible. Every detail view has an "In Directus öffnen" escape hatch. Refresh button in header re-loads the cache without a full page reload. Full i18n in de/en/fr/gsw/it.

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
