# Security baseline — KSCW (`wiedisync`)

Living doc for the security posture of the KSCW platform. Audited findings, fixes, gotchas, and rules. Update on every audit pass.

> **Reporting:** mail `kontakt@kscw.ch`. Do NOT open a public issue with exploit details. Production lives at `wiedisync.kscw.ch` + `directus.kscw.ch` (Hetzner via Cloudflare Tunnel).

---

## Trust boundaries

| Surface | Origin | Auth | Notes |
|---|---|---|---|
| `wiedisync.kscw.ch` (React) | CF Pages, prod branch | Directus access token (localStorage / sessionStorage based on remember-me) | Talks only to `directus.kscw.ch`. CF Pages env vars carry only `VITE_*` (public). |
| `wiedisync.pages.dev` (React dev) | CF Pages, dev branch | Same | Talks to `directus-dev.kscw.ch`. |
| `directus.kscw.ch` (Directus) | Hetzner VPS via CF Tunnel | Built-in Directus auth (cookies + bearer). Custom endpoints inherit `req.accountability`. | All custom routes under `/kscw/*`. |
| `kscw-push.lucanepa.workers.dev` (CF Worker) | Cloudflare Workers | Shared bearer secret from Directus → worker (constant-time compared since 2026-05-06). | VAPID keys in worker secret store; Directus side reads `VAPID_PUBLIC_KEY` env. |
| `kscw.ch` (ClubDesk) | External | Out of our scope | Don't change DNS until explicitly confirmed. |

Direct VPS exposure (Hetzner ports 8055/8056) is **not** publicly reachable — only via CF Tunnel. If that ever changes, `X-Forwarded-For`-based rate limiters collapse simultaneously (every limiter in `kscw-endpoints` uses it as fallback).

---

## What's gitignored vs. tracked

Already in `.gitignore` (don't commit):

- `.env`, `.env.*` (`.env.example` is the only tracked env file)
- `.env.test` (line 28 — local-only test creds; passwords share value `thamykscw_1972`. Rotate if leaked.)
- `INFRA.md` — contains VPS IPs / SMTP creds / token formats
- `CONTINGENCY.md`
- `directus/.env`, `directus/uploads/`, `directus/node_modules/`
- `.planning/` and `docs/superpowers/{plans,specs}/` (plan/spec docs leak credentials in practice)
- `playwright-report/`, `test-results/`, `e2e/.auth/`

Tracked (must stay clean of secrets):

- `directus/extensions/**` — only `process.env.X` reads, no fallback values to live keys.
- `workers/push/src/**` — same. VAPID + AUTH secrets via `wrangler secret`.
- `src/**` — only `VITE_*` env variables (public by design).

> **Rule:** if you find yourself adding a `|| 'fallback-value'` to a secret env read, push it back. Web push regressed on this once (`VAPID_PUBLIC_KEY` had a hardcoded fallback) — fixed 2026-05-06.

---

## Hardening completed (audit log)

Treat this as a deduplication shield: if a future audit finds something on this list, it's either a regression or a misunderstanding — verify before re-flagging.

### 2026-05-12 — Deep audit + remediation (v4.8.3)

Deep audit run post-v4.8.1 (LEADER-per-user backfill) and v4.8.2 (LEADER read scope for trainings/events). Six parallel research agents over the same six surfaces. Eight Fix-this-week findings closed.

**Custom endpoints (`directus/extensions/kscw-endpoints/src/`)**
- `event-notify.js` `POST /kscw/events/:id/notify` — previously unauthenticated. Now requires `req.accountability.user` AND callers must be Directus admin, KSCW sport-admin role, the event creator, or a coach/TR of one of the event's teams. Closes a mass push/email amplification vector exploitable by any anonymous HTTP client.
- `audit.js` `requireSuperuser()` — replaced the `directus_roles.name = 'Superuser'` string match (bypassable by renaming any role) with `req.accountability.admin === true`. The stable policy-derived admin flag is the right gate; the role name is mutable.
- `registration.js` admin notification email — `reg.bemerkungen` now routed through `escHtml()` from `email-template.js`. Public registrants can no longer inject HTML/script into the email body delivered to admin clients. `escHtml` exported from `email-template.js` so other endpoints can reuse it.
- `web-push.js` `/subscribe` — new `validatePushEndpoint()` rejects non-https, malformed URLs, private/loopback/link-local hosts (IPv4 + IPv6), and any host outside an allow-list of known browser push providers (FCM, APNs, Mozilla autopush, WNS). Closes the SSRF path where an authenticated member could coerce the CF push Worker to issue outbound requests to attacker-chosen hosts.

**Custom hooks (`directus/extensions/kscw-hooks/src/index.js`)**
- Team-join-request email body (5 locales) — `member.first_name`, `member.last_name`, and `teamName` are now routed through `escapeEmailHtml()` before interpolation into the `intro` HTML. Closes a stored-HTML injection path via member registration names.

**Frontend (`src/`)**
- `OAuthCallbackPage.tsx` + `useAuth.tsx loginWithOAuth` — `oauth_pending` sentinel TTL tightened from 5 min → 2 min, and a `state=<nonce>` query param is now embedded into the redirect URL handed to Directus. If Directus preserves our query string when appending `?access_token=…` (which most OAuth provider integrations do), the callback verifies the round-tripped state against the stored nonce — full CSRF binding. If Directus strips it, the shorter TTL still narrows the residual window (documented as a known residual gap below).

**Permissions (`directus/scripts/setup-permissions.mjs`) — LEADER policy scope tightening**
- `members.read` — was unfiltered full-row read across the entire club. Replaced with a `COACH_TEAM_MEMBERS`-scoped row + a new `LEADER_TEAM_MEMBER_FIELDS` field whitelist (all of `MEMBER_OWN_READABLE` minus `ahv_nummer`). Coaches see contact info (email/phone/address/birthdate) only for members on teams they coach or TR. Out-of-team members continue to be readable via the MEMBER policy's existing `MEMBER_VISIBLE_FIELDS` whitelist (no PII).
- `games.update` — was unfiltered. Now scoped to coach/TR of the game's `kscw_team` via the standard M2M filter pattern.
- `trainings.update` — was unfiltered. Now uses the same `COACH_OR_TR_OF_TEAM` filter already applied to `trainings.read`/`delete`.
- `events.update` — was unfiltered. Now mirrors the existing `events.delete` filter (creator OR coach/TR of an invited team).
- `participations.read` + `participations.update` — was unfiltered full-club RSVP dump. Now scoped via `participation.member.member_teams.team.{coach|team_responsible}`.
- `absences.read` — was unfiltered full-club absence dump. Same scope as participations.
- `user_logs.read` — REMOVED entirely from LEADER. The audit log endpoint at `/kscw/admin/audit` is the only sanctioned access path and is admin-only.

**SQL — migration 050**
- `trg_participations_guest_block` — was checking `guest_level > 0` across the member's ANY team. Now joins to `games.kscw_team` and checks only the row for the game's team. Closes a correctness defect that silently 400'd legit RSVPs for any senior who guest-played for a youth team.

**Smoke test (`directus/scripts/smoke-test.mjs`)**
- New optional Coach-token pass: reads `DIRECTUS_DEV_USER_TOKEN_COACH` / `DIRECTUS_PROD_USER_TOKEN_COACH` from `.env.local`. Asserts `participations.read` returns only rows whose member is reachable via the coach's teams, and `user_logs` direct read 403s. Skipped silently if no coach token is present, so existing deploys don't break.

**Residual gaps documented**
- OAuth nonce round-trip depends on Directus preserving our `state` query param through the OAuth provider redirect. If Directus strips it the TTL (now 2 min) is the only defence. Full backend support for `state` belongs in a separate enhancement.

### 2026-05-06 (continued) — v4.5.2 closes the last Critical

**Custom endpoints (`directus/extensions/kscw-endpoints/src/`)**
- New `sv-licence.js` — `GET /kscw/sv-licence/me` joins by `members.license_nr → sv_vm_check.association_id` and returns the 11-field whitelist for the caller's own row only. Replaces direct collection access.
- New `migrations-status.js` — admin-only `GET /kscw/admin/migrations-status` exposes `{applied, pending, latest, latest_applied_at}` for the InfraHealth dashboard. Drift detection without giving up the admin token.

**Frontend (`src/`)**
- `ProfilePage.tsx` switched to `kscwApi('/sv-licence/me')`. No remaining direct `sv_vm_check` reads from non-admin code paths.
- `InfraHealthPage.tsx` shows the migration tracker card.

**Permissions (`directus/scripts/setup-permissions.mjs`)**
- KSCW Member's `sv_vm_check.read` row removed entirely. Direct `GET /items/sv_vm_check` returns 403 for Members. Sport Admin retains CRUD.
- Auto-loads `.env.local` and resolves `DIRECTUS_DEV_TOKEN` / `DIRECTUS_PROD_TOKEN` by URL — no env-wrapper noise on `npm run db:setup-perms:*`.

**Smoke test (`directus/scripts/smoke-test.mjs`)**
- Token-only auth. New asserts: `sv_vm_check direct (must 403)` + `kscw/sv-licence/me`. Re-granting Member read on the collection now turns the next deploy red.

**Ops**
- Web push `VAPID_PUBLIC_KEY` set on **both** dev + prod containers; missing-on-dev gap closed (`docker run` recreate, since `docker restart` doesn't reload env-file).
- Live admin password reconciled against `/opt/directus-kscw{,-dev}/.env` on both VPS instances. No more "fresh container start could divert the bootstrap user" risk.
- `npm run db:fresh-install:dev|prod` script added (`SCHEMA.sql → migrate → setup-perms → smoke`). Single command for clean-DB rebuild.
- `.playwright-mcp/` added to `.gitignore` (browser-snapshot scratch dumps, not for the repo).

### 2026-05-06 — Deep audit + remediation

**Frontend (`src/`)**
- Sentry Session Replay now masks all text + inputs and denies network details for `directus.kscw.ch` (`src/lib/sentry.ts`).
- OAuth callback rejects token params unless an `oauth_pending` sentinel was set by `loginWithOAuth` within the last 5 min (`src/modules/auth/OAuthCallbackPage.tsx`, `src/hooks/useAuth.tsx`).
- Sponsor `website_url` and BugfixDashboard `pr_url` routed through `sanitizeUrl()` (`src/utils/sanitizeUrl.ts`).
- `RichText` DOMPurify call has explicit `ALLOWED_URI_REGEXP` for http(s) + same-origin only.
- `public/sw.js` pins notification-click URLs to our origin.

**Push worker (`workers/push/`)**
- Bearer-secret comparison switched from `!==` to constant-time XOR-fold (`timingSafeEqualStr` helper).

**Custom endpoints (`directus/extensions/kscw-endpoints/src/`)**
- `newsletter.js` `verifyTurnstile` now fails closed when `TURNSTILE_SECRET` is unset (was returning `true`).
- `game-scheduling.js` no longer returns the raw token in the `/register` response body — only emailed.
- `game-scheduling.js` `book-home` wrapped in a transaction with `SELECT … FOR UPDATE` and a cross-team check (`slot.kscw_team === opponent.kscw_team`). Closes both the TOCTOU race and the cross-team sabotage path.
- `index.js` exposes shared helpers `capPayload(payload, max=500)` and `ipRateLimit(map, req, n, ms)`.
- `index.js` `client-error` payload is now capped via `capPayload` (was uncapped → disk fill via 30 req/min).
- `index.js` `team-invites/claim` rate-limited to 5 attempts / 15 min / IP.
- `web-push.js` — removed hardcoded `VAPID_PUBLIC_KEY` fallback; endpoint returns 503 if env unset.

**Custom hooks (`directus/extensions/kscw-hooks/src/index.js`)**
- Announcement audience guard now also blocks `audience_sport`-unset posts unless caller is full admin / superuser. Sport-scoped admins can no longer bypass scope by omitting the field.
- Filter on `members.items.update` strips the `role` field unless caller is admin / superuser. Defense in depth on top of Directus field-level perms.
- Junction-delete pending Maps drained via try/finally + key snapshot — error in `syncMemberRole` no longer leaks orphaned entries.
- `escapeEmailHtml` helper introduced; admin-controlled `rejection_reason` now escaped before email interpolation.
- `clubdesk-update.js` `buildChangesTable` HTML-escapes member-supplied `old_value` / `new_value` before interpolating into the admin email.

**SQL — migration 043**
- `sv_vm_check.read` row-scoped to own member (was unfiltered → cross-member SV licence dump).
- `tasks.read` scoped to assigned/claimed-by self.
- `feedback.read` scoped to own submissions.
- `teams.update` row-scoped for KSCW Coach + KSCW Team Responsible.
- `teams_sponsors.sponsors_id` FK with ON DELETE CASCADE (closes the deferred half of migration 037).
- `member_teams.read` field set narrowed to `id, member, team, season` (drops `guest_level` from cross-team reads).
- `SET search_path = public` added to all 8 messaging trigger functions (`fn_messaging_*`, `messaging_protect_sentinel`).
- `bugfix_jobs` explicit `REVOKE ALL FROM anon, authenticated`.

**Consolidation**
- `directus/scripts/setup-permissions.mjs` rebuilt to match the post-043 live state. Header banner documents the dual-source (script + migrations) policy.

---

## Open / accepted / out-of-scope

| Item | Status | Why |
|---|---|---|
| Broadcast TOCTOU on `sent_at` rate-check | Accepted soft-limit | Code comment in `broadcast-helpers.js:364` explicitly accepts the race; the audit table catches abuse. Re-evaluate if abuse is observed. |
| `iCal` feeds (`/kscw/ical/*`) public | Accepted | Designed for calendar embedding. No member PII. |
| In-memory `X-Forwarded-For` rate limiters | Accepted | Only safe behind CF Tunnel — documented in this file. If VPS ports ever go public, all limiters collapse simultaneously and need replacing with a Postgres / Redis store. |
| `Math.max(rs)`-style PKCS8 key wrapping in `workers/push/src/index.ts` | Accepted | Documented inline; used to handle WebCrypto's lack of raw P-256 import. Audited 2026-04-04. |
| Notification triggers fan out without re-checking caller identity | Accepted | Triggers run after Directus RBAC has already gated the parent INSERT/UPDATE. If we ever grant `games`/`trainings`/`events` direct DML to a non-admin role at the PG level, this assumption breaks. |
| `tasks` schema lacks `team` FK | Accepted (43 fixed read-side) | Migration 035 noted the design gap. Read scope now uses assignee FKs which is the right substitute; create a migration that adds `team` if cross-team queries are ever needed. |

---

## Recurring gotchas

These have bitten before and will bite again:

1. **`setup-permissions.mjs` vs. SQL migrations.** Bidirectional contract: every permission change goes into both. The script is the snapshot, migrations are the journal. Fresh installs run only the script, so silent rollbacks are real (see `feedback_prod_is_canonical.md` memory).

2. **M2M junction permissions.** Flat-id payloads trigger junction-PK lookup (403 for non-admin); use `[{ teams_id: 3 }]` shape. Grant junction CRUD AND base CRUD as a pair. Without both, frontend operations hit 403 silently because `Promise.all` in `loadTeamContext` swallows individual failures.

3. **`$CURRENT_USER` is a UUID; Directus FKs to `members` are integers.** Naive `{ user: { _eq: '$CURRENT_USER' } }` filters on int FKs throw "Invalid numeric value". Always traverse through `members.user` (see `OWN_DU` in `setup-permissions.mjs`).

4. **`_neq` excludes NULLs in Directus.** Use `_or` with `_null: true` if you want NULL rows to match.

5. **Junction tables with `ON DELETE SET NULL`.** Directus serialises the resulting `null` integer as the literal string `"null"` in `_in` filters → 400 errors. All junctions should be `ON DELETE CASCADE`. Migrations 021 + 037 + 043 cover the known set.

6. **Hooks running as admin on user-controlled payloads.** Action hooks that use `database` or `services` with `accountability: null` bypass Directus RBAC entirely. Always re-verify the caller identity before privileged side effects (role-sync, broadcast fanout, dateStr-in-raw-SQL).

7. **Email/HTML interpolation.** Any human-controlled string ending up in an `html:` mail body needs HTML escaping. Helpers: `escapeEmailHtml` in `kscw-hooks/src/index.js`, `escHtml` in `clubdesk-update.js`. Don't add new email templates without one.

8. **Tokenized public flows.** Standard pattern: 16+ bytes of `crypto.randomBytes`, single-use enforced atomically (transaction + `FOR UPDATE`), expiry, revoke endpoint, audit log on issuance. Cross-resource ownership check on every consume.

9. **CSP `style-src 'unsafe-inline'`.** Required by Tailwind v4. Documented gap. Rules out CSS-based exfil mitigations from CSP — be vigilant about user-controlled style attributes.

10. **Sentry replay capture rate is 100% on error.** Always set `maskAllText: true` + `maskAllInputs: true` if any new replay integration is added.

11. **Push notifications need both ends to share VAPID public key.** Worker reads it from `wrangler secret` and Directus reads from `process.env.VAPID_PUBLIC_KEY`. A split-brain (e.g. via the formerly-hardcoded fallback) makes every push silently fail.

---

## Audit cadence

Run the deep audit after any of:

- A milestone bump in `package.json` (`*.0.0` or `*.X.0`).
- A new role / policy addition.
- Any custom endpoint going from auth-required to public (or vice versa).
- A new third-party integration.

The audit pattern is captured as a Claude Code skill — invoke `/kscw-security-audit` (lives in `~/.claude/skills/`). The skill dispatches 6 parallel agents over the same surfaces this doc covers.

After each audit, append a `### YYYY-MM-DD — Deep audit + remediation` block above and check off / move items between "Hardening completed" and "Open / accepted".

---

## Continuous verification (process — not findings)

The deep audit catches drift; these always-on guards stop new drift from reaching prod:

1. **Permissions are declarative.** `directus/scripts/setup-permissions.mjs` is the only place where role × collection × action rows live. Numbered SQL migrations are SCHEMA ONLY (DDL, triggers, RLS, FKs, grants, data backfills). The 4.4.4 / 042 incidents were both "permission row never created on prod" — that class of bug is structurally impossible when the script runs on every deploy.

2. **`npm run db:deploy:<env>` is the canonical deploy.** It runs three phases:
   - `db:migrate:<env>` — applies pending numbered migrations (tracker-aware, sha-verified, idempotent).
   - `db:setup-perms:<env>` — reconciles Directus permission rows from the script.
   - `db:smoke:<env>` — logs in as a non-admin Member, exercises every collection touched by `loadTeamContext` + the home page, exits non-zero on any 4xx/5xx. Catches the silent-Promise.all-failure pattern (the 4.4.4 incident) on first deploy after the regression.

3. **Migration tracker = the apply-once contract.** `kscw_migrations(filename, sha256, applied_at, applied_by)` records every applied migration. The runner refuses to proceed if any row's stored sha differs from the on-disk file. This kills "was migration 009 ever applied to prod?" mysteries (which is exactly what migration 042 was guessing about).

4. **Fresh-install path is one file + one script.** `directus/scripts/SCHEMA.sql` (regenerated from prod via `npm run db:baseline:prod`) + `setup-permissions.mjs`. Numbered migrations stay as the historical journal but aren't part of the bootstrap.

See `CLAUDE.md → "Migration & Permission Policy"` for the rules and `INFRA.md → "Database Deploy Workflow"` for the runbook.
