# KSCW Project

## Infrastructure
All infra details (IPs, URLs, ports, credentials, deploy commands) live in **INFRA.md**. Consult it before infra-related changes.

## Tech Stack
- Frontend: React 19 + TypeScript + Vite + TailwindCSS v4 + shadcn/ui
- UI: shadcn primitives in `src/components/ui/` (lowercase), KSCW wrappers in `src/components/` (PascalCase)
- Backend: Directus (Supabase Postgres, REST, Realtime, Auth) on Hetzner VPS
- Hosting: Cloudflare Pages (frontend), Hetzner + CF Tunnel (backend)
- Language: German UI (Swiss German context), code in English

## Data Format: TOON
Use `encode()` from `@toon-format/toon` when passing uniform object arrays to LLM prompts (~40% token savings vs JSON). Not for deeply nested/non-uniform data — use JSON-compact there. Syntax: `key: value`, `tags[3]: a,b,c`, `users[2]{id,name}:\n  1,Alice\n  2,Bob`. YAML-style indentation, quote strings with commas/spaces.

## Work Style
- **Parallel subagents**: Dispatch independent work (edits, research, checks) as parallel subagents, not sequentially.
- **NEVER commit plans/specs**: Plan + spec docs often contain credentials/tokens/internal URLs. Write to `.planning/` (gitignored) or keep in conversation. `docs/superpowers/plans/` + `docs/superpowers/specs/` are gitignored.
- **NEVER mass-email real users for testing**: Use `/events/test-email` or a single test member (e.g. ID 8). Never call notify with `send_email: true` on an all-roles/large-audience event.

## Key Patterns
- **shadcn/ui**: Load `/kscw-shadcn` skill for KSCW conventions, `/tailwind-v4-shadcn` for general TW v4 + shadcn. Migration spec: `docs/superpowers/specs/2026-03-15-shadcn-migration-design.md`
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
3. **Before finishing**: Ask "Should this commit be added to the changelog and version bumped?" If yes: update `CHANGELOG.md`, bump `package.json` (semver), and update `APP_VERSION` + `CHANGELOG` array in `src/modules/changelog/ChangelogPage.tsx` (in-app via Options → What's New). **Always write ChangelogPage entries in English** (UI is German, but this is the rule). `CHANGELOG.md` is also English.

## Changelog
<!-- Keep entries to one line. For full details see git log. -->
- **2026-04-20** v3.16.0 — Chat: other users now on the right, own on the left (fixed `m.sender === currentMemberId` numeric-vs-string bug + flipped alignment); "edited" tag is a clickable popover showing the original body (new `messages.original_body` col, migration 022). Fix: `opacity-0 group-hover:opacity-100` made reactions + ⋮ menu invisible on mobile → `opacity-60`; Directus realtime `update` events carry partial fields so replacing the row dropped `sender`/`created_at` → merge instead; `useConversation.editMessage` optimistically applies `body`/`edited_at`/`original_body` so edits show immediately even if realtime lags; `EditMessageInline` surfaces errors under the textarea instead of silent `catch {}`.
- **2026-04-20** v3.15.7 — Fix: inbox stale-fetch races + Sentry tunnel opaque 400s. `useConversation`/`useConversations`/`useConversationMembers` now have monotonic `fetchSeqRef` guards; `useConversation` clears messages on conv switch and merges realtime creates that arrived during the initial fetch. Worker `sentry-tunnel` replaced bare `catch {}` with branch-specific reasons + `wrangler tail` logging. Worker redeployed.
- **2026-04-20** v3.15.6 — Fix: `/games` 400 `Invalid numeric value.` Orphan junction rows (`teams_coaches`/`teams_responsibles` with `teams_id = NULL`) leaked `String(null)` = `"null"` into the `kscw_team: { _in: [...] }` filter; Directus 11.17 `castToNumber` throws on non-numeric `_in` elements for integer columns. Fixed in `useAuth.tsx` (filter null FKs before `String(...)`) + migration `021-junction-cascade.sql` deletes 13 orphans and rebuilds FKs `ON DELETE CASCADE`. Applied prod + dev.
- **2026-04-20** v3.15.5 — Fix: `<Button asChild>` crash on ConversationPage (`Slot` received `[null, <Link/>]` from the icon/loading fragment → `React.Children.only` threw → ErrorBoundary blanked `/inbox/:id`). `button.tsx` now skips the fragment when `asChild`. Also: CSP `connect-src` allows `cloudflareinsights.com` (RUM beacon), added standard `mobile-web-app-capable` meta next to Apple one.
- **2026-04-20** v3.15.4 — Perf: `/games` + `/trainings` single round-trip via new `POST /kscw/activities/:type/with-participations` endpoint (kills the ~1s empty-card flash on mobile from the old games→participations waterfall). New `useActivitiesWithParticipations` hook; RBAC preserved via `req.accountability` on both server-side reads.
- **2026-04-20** v3.15.3 — Event/Training/Game modal decluttering: `ParticipationSummary` uses `bars` variant everywhere (replaces text "4 Confirmed / 0 Maybe / 5 Declined" + Game's `compact`); `BroadcastButton` moved to modal header (upper-right) via new `Modal.headerAction` prop + Game custom header; roster button reduced to icon-only 44×44 tap target.
- **2026-04-20** — Coach policy parity (migration 020): added 12 perms (`teams.update`, `member_teams.create/update`, `team_requests.update`, `hall_slots.create/update` + `hall_slots_teams` CUD, `polls.create/update/delete`) to close 403s on write paths the coach UI already exposes (RosterEditor, TeamDetail, SlotEditor, PollsSection). Also soft-rejects pending signups: `TeamDetail.handleReject` now flips `kscw_membership_active=false`, `wiedisync_active=false`, clears `requested_team` instead of hard-deleting — avoids granting coaches `members.delete`. Applied to dev + prod, both containers restarted, parity verified.
- **2026-04-19** v3.15.1 — Coach-event 403 fix: M2M writes use junction-object format (`[{teams_id:3}]`); added `events_teams`/`events_members`/`event_sessions` CRUD to Coach + Admin policies (migration 019). Also: switched all datetimes to proper UTC rendered via Intl Zurich (9 new `dateHelpers.ts` helpers, DST-safe); one-shot DB migration on 6 datetime columns (events/trainings/games/announcements).
- **2026-04-19** v3.14.0 — Broadcast Plan 02: event-only in-app chat channel on `/broadcast`, creates `activity_chat` conversations with participations-sync + event-delete-cleanup triggers (migrations 015–017).
- **2026-04-19** v3.13.0 — Broadcast v1: coaches/TRs/admins can contact event/game/training audience via email + push (in-app deferred to 3.14). RBAC via teams, rate-limit (3/hr + 20min), audit table. Also: generic `event_signups` replaces `mixed_tournament_signups`.
- **2026-04-19** v3.12.0 — Messaging v1 to prod (silent, `VITE_FEATURE_MESSAGING_ALLOWLIST` gated). 4 SQL migrations, 32 team convos + 661 memberships backfilled. Hardening: revoked Supabase anon/authenticated grants on all 43 public tables; stopped all Supabase API containers except DB.
- **2026-04-18** Plans 02–05 — Team chat, DMs/requests/blocks, reactions/edit-delete/reports/polls, retention + nFADP export + push + consent modal + settings page. All behind feature flag, dev-only.
- **2026-04-17** Plan 01 — Messaging foundation: 7 collections, 7 member fields, 2 poll fields, 20 FK rules, 5 triggers, sentinel user, RBAC, 501-stub endpoints.
- **2026-04-17** v3.11.0–v3.11.2 — Vereinsnews: admin `/admin/announcements` + homepage News card + archive. Hardening: `isSafeAppLink` rejects `javascript:`/`data:` CTAs; dropped audience_teams/roles from member read; mass-email confirm dialog.
- **2026-04-17** v3.10.0 / v3.11.1 — Admin Daten-Explorer `/admin/explore`: hierarchical read-only browser, batched cache, fuzzy search, URL deep-link, sport-admin scoping. Fixes: Teams section unions coach/TR/captain rows; capitalization; orphan participation rendering; referee-expenses schema.
- **2026-04-17** v3.9.1–v3.9.4 — Team page load flash fix; team join-request notification hook; case-insensitive email lookup; team season normalisation + auto-rolling cron.
- **2026-04-14** v3.9.0 — Coach/TR inline participation editing in roster modal.
- **2026-04-10** v3.8.0 — Interactive guided tours (10 React Joyride tours, welcome modal, `/guide` menu, per-page "?").
- **2026-04-06** v3.7.0 — Bugfix dashboard: admin triggers Claude Code fixes via GH Actions; public `/status` page.
- **2026-04-05** v3.5.0–v3.6.0 — SV licence card from `sv_vm_check`; expanded VM sync (16 columns); `vm_email` claim during registration. Junction table PK fix + rename (10 Sentry issues resolved).
- **2026-03-31** v3.1.0 — Error log annotations (solved/important/open).
- **2026-03-30** v2.10.0 — Directus RBAC: 7 roles, 322 permissions, role-sync hook.
- **2026-03-29** v2.7–v2.9 — Directus migration complete: security hardening, branded emails, web push, 9 Postgres triggers, 30+ endpoints, Sentry, SSO.

### Earlier milestones
- **2026-03-26** Team settings accordion, RSVP improvements, team photo zoom, referee expenses
- **2026-03-24** OTP auth (v2.1.0), coach visibility, RSVP timestamps
- **2026-03-12** Scoreboard tab, W/L splits, hallenplan free-slot, web push, scorer delegation
- **2026-03-10** Google OAuth, sport-scoped roles, basketball sync, game scheduling
- **2026-03-06** Hallenplan (virtual slots, closures, claims), RSVP, notifications
- **2026-03-01** Core platform: teams/members, Schreibereinsätze, admin tools, E2E, security
