# Changelog

All notable changes to Wiedisync are documented in this file.

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
- Role approval system (pending → approved flow)
- Superadmin / admin / member role hierarchy
- Privacy settings and GDPR-compliant account deletion
- Claimed vs unclaimed account distinction (`member_active`)

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
