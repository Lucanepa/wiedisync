# Rename: kscw → wiedisync

**Date:** 2026-03-17
**Status:** Approved

## Goal

Rename the project from "kscw" to "wiedisync" to clearly separate the app platform repo from the kscw-website repo.

## Scope

### In scope

1. **GitHub repo**: `Lucanepa/kscw` → `Lucanepa/wiedisync` (GitHub auto-redirects old URLs)
2. **Local directory**: `~/Desktop/Github/kscw` → `~/Desktop/Github/wiedisync`
3. **Git remote**: Update origin URL to match new repo name
4. **package.json**: `"name": "kscw"` → `"name": "wiedisync"`, then `npm install` to regenerate package-lock.json
5. **index.html**:
   - `<title>KSCWiedisync</title>` → `<title>Wiedisync</title>`
   - Favicon href: `/kscw_logo_vektoren.svg` → `/wiedisync_logo.svg`
6. **localStorage keys** (clean rename, no migration — users get one-time reset):
   - `kscw-remember-me` → `wiedisync-remember-me`
   - `kscw-lang` → `wiedisync-lang`
   - `kscw-theme` → `wiedisync-theme`
   - `kscw-sport` → `wiedisync-sport`
   - `kscw-admin-mode` → `wiedisync-admin-mode`
   - `kscw-privacy-noticed` → `wiedisync-privacy-noticed`
   - `kscw-sql-history` → `wiedisync-sql-history`
7. **Asset files** (rename + update ALL references everywhere):
   - `public/kscw_blau.png` → `public/wiedisync_blau.png`
   - `public/kscw_weiss.png` → `public/wiedisync_weiss.png`
   - `public/kscw_logo_vektoren.svg` → `public/wiedisync_logo.svg`
   - References in: `index.html`, `public/manifest.json`, `public/sw.js`, `src/components/Layout.tsx`, `src/components/LoadingSpinner.tsx`, and any other src/ files
8. **Alt text / UI labels**: `alt="KSCW"` → `alt="Wiedisync"` in Layout.tsx
9. **Service worker** (`public/sw.js`):
   - Asset paths (`/kscw_blau.png` → `/wiedisync_blau.png`)
   - Notification tag: `kscw-notification` → `wiedisync-notification`
10. **iCal exports**:
    - `src/modules/calendar/ICalModal.tsx`: download filename `kscw-kalender.ics` → `wiedisync-kalender.ics`
    - `src/utils/icalGenerator.ts`: default filename `kscw.ics` → `wiedisync.ics`
    - Note: `UID:${entry.id}@kscw.ch` intentionally unchanged (changing UIDs causes calendar clients to duplicate events, and `kscw.ch` is a domain)
11. **E2E tests**: Update localStorage key refs and alt text selectors in:
    - `e2e/tests/member/admin-mode.spec.ts`
    - `e2e/tests/public/dark-mode.spec.ts`
    - `e2e/tests/public/readability.spec.ts`

### Out of scope (not changing)

- Domain names (`kscw.lucanepa.com`, `kscw-api.lucanepa.com`)
- Cloudflare Pages project name (may need manual repo reconnection after GitHub rename)
- CF Worker name (`kscw-push`) and `workers/push/wrangler.toml`
- PocketBase service names (`pocketbase-kscw`), collection prefixes, field names (`kscw_team`)
- CF tunnel names
- Club name "KSC Wiedikon" wherever it appears
- Component names referencing the club (e.g., `KscwScoreboard` — refers to club, not app)
- CLAUDE.md / INFRA.md / CONTINGENCY.md infrastructure references (old GitHub URL auto-redirects)
- Skill names (`/kscw-conventions`, `/kscw-shadcn`)
- Memory file references in `.claude/`
- iCal UID domain (`@kscw.ch`) — changing would duplicate calendar events

### Post-rename manual step

- Cloudflare Pages: reconnect repo in CF dashboard from `Lucanepa/kscw` → `Lucanepa/wiedisync`

## Implementation Order

1. Rename asset files in `public/` (git mv)
2. Update all asset references across: `index.html`, `public/manifest.json`, `public/sw.js`, `src/components/Layout.tsx`, `src/components/LoadingSpinner.tsx`, and any other files
3. Update localStorage key prefixes across all src/ and e2e/ files
4. Update package.json name + `npm install`
5. Update index.html title
6. Update alt text in Layout.tsx
7. Update iCal filenames
8. Update notification tag in sw.js
9. Update E2E test selectors
10. Verify: grep for stale `kscw_blau`, `kscw_weiss`, `kscw_logo_vektoren` refs
11. Commit all changes
12. Rename GitHub repo via API
13. Rename local directory
14. Update git remote URL
