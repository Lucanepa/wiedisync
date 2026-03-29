# Wiedisync

Internal platform for **KSC Wiedikon** — managing teams, games, trainings, and club operations for a volleyball and basketball club in Zurich, Switzerland.

**Live:** [wiedisync.kscw.ch](https://wiedisync.kscw.ch)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Backend | [Directus](https://directus.io) (Postgres REST API + Realtime) |
| Auth | Google OAuth via Directus |
| Testing | Playwright (E2E), Vitest (unit) |
| Hosting | Cloudflare Pages (frontend), Infomaniak VPS (backend) |
| i18n | i18next (German/English) |

## Features

- **Games** — Volleyball (Swiss Volley sync) and basketball (Basketplan sync) with scores, rankings, and participation tracking
- **Trainings** — Recurring schedules, RSVP, and email reminders
- **Hallenplan** — Hall booking overview with closures, slot claims, and Google Calendar sync
- **Schreibereinsaetze** — Scorer duty assignments with delegation and iCal export
- **Spielplanung** — Season scheduling and opponent game booking (Terminplanung) with conflict detection
- **Teams & Rosters** — Multi-sport roster management, player profiles, photos, and sponsor display
- **Notifications** — Web push (Cloudflare Workers), email reminders, activity alerts
- **Admin tools** — Native DB panel (SQL editor, table browser, schema viewer), ClubDesk CSV sync
- **Calendar** — Unified view with home/away colors and iCal feed generation
- **Feedback** — In-app feedback form with Turnstile CAPTCHA
- **Dark mode** — Full dark mode with semantic design tokens

## Project Structure

```
src/
  modules/        # Feature modules (games, trainings, teams, scorer, calendar, etc.)
  components/     # Shared UI components + shadcn/ui primitives
  hooks/          # React hooks (auth, PB queries, mutations, theme, etc.)
  utils/          # Helpers (dates, team colors, league tiers)
  i18n/           # Translation files
  lib/            # Library utilities
pb_hooks/         # PocketBase server-side hooks (sync, notifications, APIs)
e2e/              # Playwright E2E tests
scripts/          # Setup & utility scripts
workers/          # Cloudflare Workers (web push)
```

## Getting Started

```bash
cp .env.example .env    # Configure PocketBase URL
npm install
npm run dev             # Dev server at localhost:1234
npm run build           # Production build → dist/
```

## Testing

```bash
npm test                # Playwright E2E
npm run test:unit       # Vitest unit tests
```

## Deployment

- **Frontend:** Push to `prod` branch triggers Cloudflare Pages deploy
- **Backend:** Push to `pb_hooks/` triggers auto-deploy via webhook on VPS

## Related

- [KSCW Website](https://github.com/Lucanepa/kscw-website) — Public club website (Astro)
- [Directus API](https://directus.kscw.ch) — Backend API (PocketBase at api.kscw.ch kept as fallback)
