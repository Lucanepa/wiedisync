# KSCW Project

## Infrastructure
All infra details (IPs, URLs, ports, credentials, deploy commands) live in **INFRA.md**. Consult it before infra-related changes.

## Tech Stack
- Frontend: React 19 + TypeScript + Vite + TailwindCSS v4 + shadcn/ui
- UI: shadcn primitives in `src/components/ui/` (lowercase), KSCW wrappers in `src/components/` (PascalCase)
- Backend: Directus (Supabase Postgres, REST, Realtime, Auth) on Hetzner VPS
- Hosting: Cloudflare Pages (frontend), Hetzner + CF Tunnel (backend)
- Language: **English-first**, multilingual UI (DE / EN / FR / GSW / IT). Locale defaults to browser language; unrecognised browsers fall back to English. Write new i18n strings in English first, then translate to DE at minimum. Code identifiers in English.

## Data Format: TOON
Use `encode()` from `@toon-format/toon` when passing uniform object arrays to LLM prompts (~40% token savings vs JSON). Not for deeply nested/non-uniform data — use JSON-compact there. Syntax: `key: value`, `tags[3]: a,b,c`, `users[2]{id,name}:\n  1,Alice\n  2,Bob`. YAML-style indentation, quote strings with commas/spaces.

## Work Style
- **Parallel subagents**: Dispatch independent work (edits, research, checks) as parallel subagents, not sequentially.
- **NEVER commit plans/specs**: Plan + spec docs often contain credentials/tokens/internal URLs. Write to `.planning/` (gitignored) or keep in conversation. `docs/superpowers/plans/` + `docs/superpowers/specs/` are gitignored.
- **NEVER mass-email real users for testing**: Use `/events/test-email` or a single test member (e.g. ID 8). Never call notify with `send_email: true` on an all-roles/large-audience event.

## Key Patterns
- **shadcn/ui**: Load `/kscw-shadcn` skill for KSCW conventions, `/tailwind-v4-shadcn` for general TW v4 + shadcn. Migration spec: `docs/superpowers/specs/2026-03-15-shadcn-migration-design.md`
- **Lists → tables, always**: Any view of homogeneous **data** records (rosters, members, expenses, audit logs, registrations, absences, scheduled games in admin views, sponsors, error logs, etc.) MUST use `<Table>` from `src/components/ui/table.tsx` — never card-stacks or `space-y-*` row lists. Mobile compaction rules: (a) names wrap to 2 lines (last name / first name), no truncation; (b) positions render as initials via `getPositionInitial()` (S/O/M/D/L/G + BB equivalents), full label in `title`; (c) action toggles (K/G/captain/etc.) stack vertically (`flex-col`) on `<sm`, horizontal on `≥sm`; (d) optional columns (photos, secondary metadata) hide via `hidden sm:table-cell`; (e) row min-height ≥44px on mobile. Exceptions: (1) calendar grids, kanban boards, chat threads; (2) **event/activity cards** (`GameCard`, `TrainingCard`, `EventCard`, `ScorerRow`) — rich cards with logos/scores/RSVP CTAs; (3) **branded entity cards** (`TeamCard`) — team photo + brand color is the primary visual; (4) **prose / release notes** (`ChangelogPage`) — versioned narrative copy with bulleted change lists, not tabular records. The data-list rule applies when each row is a *record* you want to scan/edit; the card rule applies when each row is an *event/entity/release* you want to act on or read. Reference impl: `src/modules/teams/RosterEditor.tsx`.
- **Mobile-first**: Responsive, touch targets ≥44px, test small screens before desktop.
- **Dark mode**: Use shadcn semantic tokens (`bg-background`, `text-foreground`, `bg-primary`) — auto-switch. For non-semantic colors, add explicit `dark:` variants.
- **Native `<select>` dark mode**: `<option>` inherits the `<select>` background, not Tailwind dark styles. Every `<select>` MUST have `dark:bg-gray-800` (or equivalent) — `bg-transparent` alone renders white dropdowns in dark mode.
- **Hallenplan virtual slots**: Games/trainings/GCal events render as `HallSlot`-shaped objects at display time via `_virtual`, merged with real `hall_slots`. Never stored. See `INFRA.md → Hallenplan Virtual Slots`.
- **Data integrity**: Postgres triggers enforce validation (slot claims, shell invites, coach approval, game sync skips rows without `away_team`). See `directus/scripts/001-postgres-triggers.sql`.
- **Error logging**: ALL frontend + backend errors → persistent JSONL via `GET /kscw/admin/error-logs`. Frontend also to Sentry (de.sentry.io, org "kscw"). Load `/kscw-error-logs` skill. Check logs FIRST when debugging.
- **Troubleshooting**: When you solve an error, document it in `INFRA.md → Troubleshooting & Gotchas`. Check that section FIRST.
- **M2M junction objects in forms**: Extract related IDs from junction objects. Never pass raw expanded junction objects to `string[]` UI. Pattern: `.map((j: any) => String(typeof j === 'object' ? (j.related_field?.id ?? j.related_field ?? j) : j))`.
- **M2M writes to Directus**: Flat ID arrays trigger junction-PK lookup (403s for non-admin); use junction-object format: `[{ teams_id: 3 }]`. Grant junction CRUD + base CRUD as a pair.
- **Promise.all in context loading**: One failed query fails all. Verify each collection exists in Directus (via `GET /relations`) before querying after M2M recreations.
- `.env` is gitignored — CF Pages env vars handle prod config.

## Directus Admin
- **Admin UI**: `https://directus.kscw.ch/admin` (prod), `https://directus-dev.kscw.ch/admin` (dev)
- **Schema changes**: Make on dev, sync to prod via `npm run schema:pull` / `npm run schema:push`. See `INFRA.md → Schema Sync`.
- **Extensions**: Endpoints in `directus/extensions/kscw-endpoints/`, hooks in `directus/extensions/kscw-hooks/`. Deploy by restarting container.
- **Postgres triggers**: `directus/scripts/001-postgres-triggers.sql`. Apply via `psql` on `coolify-db`.
- **Deleting collections/records**: Confirm with user first.
- **M2M fields MUST be created via the admin UI** — API-created M2M relations show "relationship hasn't been configured correctly". Flow: (1) nuke junction + PG table + field, (2) create via Settings → Data Model → Add Field → Many to Many in browser, (3) restore data via API. UI auto-generates junction names (e.g. `teams_members_3`) — rename via SQL after + update Directus metadata. Check names via `/relations` API.
- **Junction names (prod)**: `hall_slots_teams`, `teams_coaches`, `teams_responsibles`, `teams_sponsors`, `events_teams`, `hall_events_halls`. `captain` is M2O on `teams` (not a junction).

## SSH to VPS
- `ssh hetzner` (alias in `~/.ssh/config`)
- Containers: `directus-kscw` (8055), `directus-kscw-dev` (8056)
- Restart: `ssh hetzner "sudo docker restart directus-kscw"`
- Logs: `ssh hetzner "sudo docker logs --tail 30 directus-kscw"`
- See `INFRA.md → Hetzner VPS Management`.

## Domains
- `kscw.ch` — ClubDesk (external). **Do NOT change until explicitly confirmed.**
- `wiedisync.kscw.ch` — React prod, CF Pages `wiedisync` (`prod` branch) → `directus.kscw.ch`
- `wiedisync.pages.dev` — React dev, CF Pages (`dev` branch) → `directus-dev.kscw.ch` (auto-detected in `src/lib/api.ts`)
- `directus.kscw.ch` / `directus-dev.kscw.ch` — Directus API prod/dev (plain Docker on Hetzner, not Coolify)
- `kscw-website.pages.dev` — Public static site. **Deploy to dev/preview only** until further notice.
- `kscw-push.lucanepa.workers.dev` — Web push CF Worker

See `INFRA.md → Domains & Hosting Overview` for full map.

## Branches & Dev-First Workflow
- `prod` → production (`wiedisync.kscw.ch` / `directus.kscw.ch`)
- `dev` → preview (`wiedisync.pages.dev` / `directus-dev.kscw.ch`)

**All changes go through `dev` first.** Never push to `prod` unless explicitly told. Flow:
1. Commit on `dev`
2. Frontend deploys automatically on push
3. Backend: `npm run ext:deploy:dev` (rsyncs `directus/extensions/` to VPS + restarts; not Coolify-managed)
4. Test on `wiedisync.pages.dev` → `directus-dev.kscw.ch`
5. With user approval, merge `dev` → `prod` and push
6. `npm run ext:deploy:prod` for backend extensions

## Session Workflow
1. **Start**: Read `CLAUDE.md` + `INFRA.md` before doing anything.
2. **End**: Append a short line to Changelog (date + summary). Overwrite stale/redundant entries.
3. **Before finishing**: Ask "Should this commit be added to the changelog and version bumped?" If yes: update `CHANGELOG.md`, bump `package.json` (semver), and update `APP_VERSION` + `CHANGELOG` array in `src/modules/changelog/ChangelogPage.tsx` (in-app via Options → What's New). `ChangelogPage` entries and `CHANGELOG.md` are both in English (consistent with the English-first convention).

## Changelog
<!-- Keep entries one line. For full details see CHANGELOG.md or git log. -->
- **2026-05-03** v4.4.12 — Training row strip now matches actual RSVP status. `useBulkParticipationStatuses` keyed its lookup map by `activity_id` alone with no `activity_type` filter on the Directus query — so a member with `training:4 declined` AND `event:4 confirmed` saw the second row overwrite the first, painting the training row green. Both the filter and the JS `Map` are now keyed on composite `${type}:${id}`. Also capitalized the relative-time sub-label in the roster modal (`Intl.RelativeTimeFormat` emits lowercase).
- **2026-05-03** v4.4.11 — Email i18n parity with push. `bucketEmailsByLocale` expanded to 5 buckets (de/gsw/en/fr/it) + `members.email` fallback so admin aliases without a Directus user resolve. Translated registration (vb/bb/passive + admin notif), ClubDesk update, contact form, event invite, team-join request, and `buildBroadcastEmail`. OWNER_EMAIL CC pattern in registration replaced with a separate localized send in the registering user's locale (was producing duplicate German copies via the kontakt@kscw.ch forwarding alias even when the actual admin had language=english). password-reset already had 5 locales.
- **2026-05-03** v4.4.10 — Migration 038 — weekly unavailability now hard-overrides existing confirmed RSVPs. `autoDeclineForAbsence` switched from `INSERT…NOT EXISTS` to UPDATE-then-INSERT for trainings/games/events; new `participations.items.create` filter flips fresh RSVPs to `declined` if a covering absence exists. `trg_participations_clear_auto_marker` reshaped (mirrors `auto_cancelled_by_closure` pattern) so the hook can write status + marker in one UPDATE without losing the marker; manual overrides still detach via the trigger. Backfill caught 6 stuck `confirmed` rows on prod. Roster modal now uses `absenceCoversActivity()` (respects `days_of_week` + `affects`) and labels weekly type as "Unavailable" (new `declinedUnavailable` key in 5 locales) vs "Declined (Absence)" for one-off absences.
- **2026-05-03** v4.4.9 — Push notifications i18n. All cron + event-driven pushes (upcoming_activity, deadline_reminder, team-join request, scorer delegation accepted/declined, event invite, announcement fanout, DM generic fallback) were hardcoded German. New `push-i18n.js` (`bucketMembersByLocale` + `tPush` over 5 locales DE/GSW/EN/FR/IT). Announcement fanout uses its existing per-locale `translations` field. Emails unchanged (already DE/EN bucketed).
- **2026-05-02** v4.4.8 — `user_logs` RLS fixed (KSCW Member filter compared int FK to UUID `$CURRENT_USER` → `Invalid numeric value`); vm_sync cron switched from blocking 120s `execSync` to async `spawn` with 10-min budget; SDK websocket re-auth race silenced in Sentry.
- **2026-04-30** v4.4.7 — Migration 037 — junction cascade pass 2 (`events_teams`, `events_members`, `hall_events_halls`, `hall_slots_teams`, `teams_sponsors` SET NULL → CASCADE; orphan cleanup) + iOS Safari `Invalid Date` fix in `dateHelpers.ts` (bare YYYY-MM-DD anchored to T00:00:00Z; V8 parsed `2026-05-07Z` but JavaScriptCore rejected → empty weekday/date on training cards).
- **2026-04-30** v4.4.6 — Migration 036 — third-pass audit. Coach/TR `members.update` scoped to my-team members; Member + Coach reads on `event_sessions`/`events_members` scoped via parent-event filter; deduped leftover M2M-recreation permission rows.
- **2026-04-30** v4.4.5 — Migration 035 — second-pass audit. Removed public reads on `participations`/`events`/`events_teams`/`slot_claims`; scoped Member reads on `polls`/`referee_expenses`; scoped Coach reads on `participations`/`absences`; revoked `event_signups` PG grant from anon/authenticated.
- **2026-04-30** v4.4.4 — Migration 034 — grants self-scoped `spielplaner_assignments.read` to all KSCW policies. Was missing since 031, masked by wide-open reads, surfaced once 032/033 tightened them — every member's `loadTeamContext` was silently failing.
- **2026-04-29** v4.4.3 — Migration 033 — `KSCW Member` reads on `absences` / `participations` / `events` scoped (own + same-team for the first two; own + club-wide + invited-team / -member for events). Adds `members.member_teams` o2m alias.
- **2026-04-29** v4.4.2 — Migration 032 — `trainings.read` scoped to user's teams (KSCW Member rule was unfiltered) + public read removed; adds `teams.members` o2m alias.
- **2026-04-23** v4.2.0 — Spielplanung sandbox mode: manual game CRUD on calendar (create/edit/delete + bulk Excel import), scoped Spielplaner role (`spielplaner_assignments`), Week view with drag-to-reschedule on manual games (15-min snap + conflict guard), richer chips + detail drawer, season nav unclamped, SVRZ field locking.
- **2026-04-23** v4.1.0 — SVRZ game-scheduling invites: admin-issued per-verein tokenized links (3-tier contact match from SVRZ game + club feeds), manual CSV paste fallback, invite lifecycle (invited → viewed → booked) with reissue/revoke, schema extended on `game_scheduling_opponents`.
- **2026-04-20** v4.0.4 — Mobile More sheet: `/inbox` first in secondary list (was getting lost below `/events`).
- **2026-04-20** v4.0.3 — Mobile/desktop nav parity: More sheet + SidebarOptions aligned; `/status` is a friendly health dashboard; changelog justified.
- **2026-04-20** v4.0.2 — Migration 030 — 4 more `members.read` gaps (Spielplaner menu / coach scorer-assignment / shell badge / Aktiv-Passiv + Beitragskategorie display).
- **2026-04-20** v4.0.1 — Migration 029 — consent modal accept-loop (6 messaging/consent fields stripped from self-read).
- **2026-04-20** v4.0.0 — Messaging live for all members (flag flip). Milestone complete.
- **2026-04-20** v3.17.x — "Coach da" badge on list cards + home rows; hall-closure auto-cancel trainings + full absence unwind (migration 028).
- **2026-04-20** v3.16.x — Security sweep (migrations 023–027): messaging RBAC scoping, PII removal, report rate-limit, Sport Admin delete lock, coach write scoping; full i18n sweep; participation + chat fixes.
- **2026-04-20** v3.15.x — `/games`+`/trainings` single round-trip endpoint; coach policy parity (migration 020); junction cascade (migration 021); proper UTC datetime via Intl Zurich; inbox races fixed; SVRZ Art. 102a rankings colours.
- **2026-04-19** v3.12.0–3.14.0 — Messaging v1 allowlist-gated; Broadcast v1 (email+push) + Plan 02 (in-app event chat); Supabase anon/authenticated revoked on all public tables.
- **2026-04-17/18** Plans 01–05 — Messaging foundation + team chat + DMs + requests/blocks + reactions/edit-delete/reports/polls + retention/nFADP export/push/consent/settings. Vereinsnews + Daten-Explorer shipped.
- **2026-04-10 → 04-14** v3.8.0–3.9.x — React Joyride guided tours; coach/TR inline participation editing; team page load-flash fix.
- **2026-04-05 → 04-06** v3.5.0–3.7.0 — SV licence card from `sv_vm_check` (16-col VM sync); bugfix dashboard + public `/status`.
- **2026-03-29 → 03-31** v2.7–3.1 — Directus migration complete: 7 roles, 322 perms, role-sync hook, branded emails, web push, 9 PG triggers, 30+ endpoints, Sentry, SSO.
- **2026-03-19 → 03-26** v1.0–2.6 — Core platform on PocketBase: teams/members, Schreibereinsätze, Hallenplan (virtual slots), RSVP + notifications, Google OAuth, sport-scoped roles, scoreboard, scorer delegation, team settings accordion, referee expenses.
