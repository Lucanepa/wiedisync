# Changelog

All notable changes to Wiedisync are documented in this file.

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
