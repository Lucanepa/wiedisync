# KSCWiedisync— Project Specification

## Overview

Unified web application for KSC Wiedikon volleyball club. One monorepo, one PocketBase backend, React + TypeScript frontend deployed on Cloudflare Pages.

## Infrastructure (ALREADY RUNNING)

| Component | URL / Location | Details |
|-----------|---------------|---------|
| **PocketBase API** | `https://kscw-api.lucanepa.com` | Docker on Synology DS923+, port 8091, via Cloudflare Tunnel |
| **PocketBase Admin** | `https://kscw-api.lucanepa.com/_/` | Admin UI (credentials already set) |
| **Frontend** | `https://kscw.lucanepa.com` | Cloudflare Pages (to be connected to this repo) |
| **ClubDesk** | `https://kscw.ch` | Verein website, embeds custom tools via iframe |
| **GitHub Repo** | `https://github.com/Lucanepa/kscw` | This repo |

### PocketBase Docker (Synology)
- Image: `spectado/pocketbase:latest`
- Internal port 80, mapped to host 8091
- Data: `/volume1/docker/pocketbase/pb_data`
- Hooks: `/volume1/docker/pocketbase/pb_hooks`
- Migrations: `/volume1/docker/pocketbase/pb_migrations`
- Exposed via Cloudflare Tunnel (tunnel name: `kscw`)

### Existing PocketBase Collections (from Schreibereinsätze)
Already contains scorer data with these collections:
- `scorer_matches` — game assignments (date, teams, scorer/täfeler assignments)
- `scorer_scorers` — people who can be assigned as scorers
- `scorer_places` — game locations/halls
- `scorer_edit_log` — edit tracking

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS
- **Backend**: PocketBase (SQLite, REST API, Realtime WebSocket, Auth, File storage)
- **Hosting**: Cloudflare Pages (frontend), Synology + Cloudflare Tunnel (backend)
- **Deployment**: `git push` → Cloudflare Pages auto-builds; PocketBase hooks/migrations manual rsync
- **Language**: German UI (Swiss German context), code in English

## Modules (8 total)

### 1. 🏆 Games & Results
**Source**: Migrated from `swiss_volley_data` repo
**Purpose**: Swiss Volley API data — next games, past results, rankings, league tables

Features:
- Auto-sync from Swiss Volley API (cron job / PocketBase hook)
- Per-team views with team chips (H1, H2, H3, D1, D2, D3, D4, HU23, DU23, Legends)
- Tabs: next games / last games / results / rankings
- Match detail modal with venue, referee info
- Embedded view for ClubDesk iframes (`/embed/games?team=h3`)

Swiss Volley Team IDs:
```
12747 → KSC Wiedikon H3
1394  → KSC Wiedikon D4
14040 → KSC Wiedikon DU23-2
7563  → KSC Wiedikon HU23-1
1393  → KSC Wiedikon D2
541   → KSC Wiedikon H2
6023  → KSC Wiedikon Legends
4689  → KSC Wiedikon D3
2743  → KSC Wiedikon H1
1395  → KSC Wiedikon D1
2301  → KSC Wiedikon DU23-1
```

### 2. 📋 Spielplanung
**Source**: Migrating from `kscw_spielplanung` repo (Google Sheets → PocketBase)
**Purpose**: Season planning calendar + list view

Features:
- Calendar view (September–May) with color-coded teams
- List view (by date / by team)
- Gym closure overlays
- Absence entries inline
- Filters: sport (VB/BB), team, type (home/away), absences toggle
- Cup match indicators (Swiss Volley Cup 🏆, Züri Cup 🥈)
- Spielsamstag highlighting

Google Sheets source (for one-time import):
- Spreadsheet ID: `16hr2bshVSHoQGZ73xGZiJpnhlBwu6Mn3I5YC4Z-ixXY`
- API Key: (stored in .env, not committed)
- Sheets: `Team_Matches`, `Gym Closed`, `Team_Preferences`, `Übersicht VB + BB`
- Columns: team, championship, opponent team, weekday, date, time, type, status, gym/halle, sport

### 3. 🏟️ Hallenplan (Gym Slots) — MAIN TOOL
**Source**: New (+ gym closure data from Spielplanung)
**Purpose**: Who uses which court when. Weekly recurring + one-off bookings.

Features:
- Week view with time slots per court
- Recurring bookings (trainings) + one-off (games, events)
- Team color-coded blocks
- Conflict detection & warnings
- Hauswart export → Google Calendar (iCal feed they subscribe to)
- Gym closure management (holidays, Putzaktion, etc.)
- Drag-and-drop slot editing for admins

### 4. 🎯 Trainings & Participation
**Source**: New
**Purpose**: Training sessions with attendance tracking

Features:
- Per-team training schedule (linked to Hallenplan recurring slots)
- Player confirmation: ✅ present / ❌ absent / ❓ unknown
- Absence reason (injury, vacation, work, etc.)
- Coach dashboard: attendance % per player, trends
- Season stats export

### 5. 👤 Absences
**Source**: New (integrated into Spielplanung + Trainings)
**Purpose**: Centralized absence management

Features:
- Date range absences (e.g. 2-week vacation)
- Single-event absences
- Reason categories: injury, vacation, work, personal, other
- Auto-reflects in: Spielplanung view, training attendance, game availability
- Per-team absence overview for coaches

### 6. 📝 Schreibereinsätze (Scorer Assignments)
**Source**: Existing `kscw_schreibereinsaetze` repo — ALREADY ON POCKETBASE
**Purpose**: Scorer/Täfeler duty assignments per game

Features (already built, needs React port):
- Game list with duty team assignments
- Scorer + Täfeler name assignment per game
- Admin panel with filters (date, team, duty type, open duties)
- Coaches view for team-specific duties
- Edit log tracking
- Embedded views for ClubDesk

### 7. 📅 Calendar
**Source**: Migrated from `kscw_kalendar` repo
**Purpose**: Unified calendar showing everything

Features:
- Aggregated view of all modules (games, trainings, closures, events)
- Google Calendar iCal feed (outbound → Hauswart subscribes)
- Color-coded by type
- User-created events (GV, Trainerlager, social events)
- Month / week / list views
- Export .ics per team

Current iCal source: `calendar.google.com/calendar/ical/cdnom1h6cu6b0753l110q9nh50f4sdg7@import.calendar.google.com/public/basic.ics`
Now served via PocketBase iCal hook.

### 8. 👥 Teams & Members
**Source**: New (+ content from `kscw_h3`, `coaching_kscw`)
**Purpose**: Team pages, rosters, player profiles, participation stats

Features:
- Team roster with player details
- Player profile: photo, number, position
- Participation stats (games, trainings, attendance %)
- Coach tools: lineup builder, scouting notes
- Season history

## Data Model (PocketBase Collections)

### teams (base)
```
id (auto), name (text, e.g. "H3"), full_name (text, "KSC Wiedikon Herren 3"),
sv_team_id (text, "12747"), sport (select: volleyball|basketball),
league (text), season (text, "2025/26"), color (text, hex),
coach (relation → members), active (bool)
```

### members (auth)
```
id (auto), email (email, PB auth), name (text), first_name (text),
last_name (text), phone (text), license_nr (text), number (int, jersey),
position (select: setter|outside|middle|opposite|libero|coach|other),
photo (file), role (select: player|coach|vorstand|admin), active (bool)
```

### member_teams (base)
```
id (auto), member (relation → members), team (relation → teams),
season (text), role (select: player|coach|captain|assistant)
```

### halls (base)
```
id (auto), name (text, e.g. "Turnhalle Küngenmatt"), address (text),
city (text), courts (int), notes (text), maps_url (url)
```

### hall_slots (base)
```
id (auto), hall (relation → halls), team (relation → teams),
day_of_week (int, 0=Mon..6=Sun), start_time (text, HH:mm),
end_time (text, HH:mm), slot_type (select: training|game|event|other),
recurring (bool), valid_from (date), valid_until (date),
label (text), notes (text)
```

### hall_closures (base)
```
id (auto), hall (relation → halls), start_date (date), end_date (date),
reason (text), source (select: hauswart|admin|auto)
```

### games (base)
```
id (auto), sv_game_id (text), home_team (text), away_team (text),
kscw_team (relation → teams, nullable), hall (relation → halls),
date (date), time (text), league (text), round (text), season (text),
type (select: home|away), status (select: scheduled|live|completed|postponed),
home_score (int), away_score (int), sets_json (json),
scorer_team (text), scorer_person (text),
taefeler_team (text), taefeler_person (text),
duty_confirmed (bool), source (select: swiss_volley|manual)
```

### sv_rankings (base)
```
id (auto), sv_team_id (text), league (text), rank (int),
played (int), won (int), lost (int), sets_won (int), sets_lost (int),
points_won (int), points_lost (int), points (int),
season (text), updated_at (date)
```

### trainings (base)
```
id (auto), team (relation → teams), hall_slot (relation → hall_slots),
date (date), start_time (text), end_time (text),
hall (relation → halls), coach (relation → members),
notes (text), cancelled (bool), cancel_reason (text)
```

### training_attendance (base)
```
id (auto), training (relation → trainings), member (relation → members),
status (select: present|absent|late|excused),
absence (relation → absences, nullable),
noted_by (relation → members)
```

### absences (base)
```
id (auto), member (relation → members), start_date (date), end_date (date),
reason (select: injury|vacation|work|personal|other), reason_detail (text),
affects (json, e.g. ["trainings","games","all"]), approved (bool),
created_at (autodate)
```

### events (base)
```
id (auto), title (text), description (text),
event_type (select: verein|social|meeting|tournament|other),
start_date (date), end_date (date), all_day (bool),
location (text), teams (relation → teams, multi),
created_by (relation → members)
```

## External APIs

### Swiss Volley API
- Data synced daily via PocketBase hook (pb_hooks/sv_sync.pb.js)
- Fetches games + rankings for each KSCW team ID
- Upserts into `games` + `sv_rankings` collections
- Frontend reads from PocketBase only (never directly from SV API)

### Google Calendar (iCal)
- OUTBOUND: PocketBase hook generates .ics feeds
  - `/api/ical/master.ics` (all events)
  - `/api/ical/h3.ics`, `/api/ical/d1.ics` etc. (per team)
  - Hauswart subscribes in Google Calendar
- INBOUND: Optionally read Hauswart's public iCal for gym closures

### ClubDesk Embeds
- ClubDesk pages embed custom tools via iframe:
  ```html
  <iframe src="https://kscw.lucanepa.com/embed/games?team=h3">
  ```
- Embed routes strip nav/shell, show content only
- CORS on PocketBase must allow: `kscw.lucanepa.com`, `kscw.ch`

## Repo Structure

```
kscw/
├── README.md
├── package.json               # Vite + React + TS + Tailwind
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── .env                       # VITE_PB_URL=https://kscw-api.lucanepa.com
├── .env.example
├── public/
│   └── favicon.ico
├── src/
│   ├── main.tsx
│   ├── App.tsx                # Router + layout + nav
│   ├── pb.ts                  # PocketBase client singleton
│   ├── components/            # Shared UI
│   │   ├── Layout.tsx
│   │   ├── TeamChip.tsx
│   │   ├── CalendarGrid.tsx
│   │   ├── WeekView.tsx
│   │   ├── DataTable.tsx
│   │   ├── Modal.tsx
│   │   └── StatusBadge.tsx
│   ├── hooks/
│   │   ├── usePB.ts           # PocketBase CRUD helpers
│   │   ├── useRealtime.ts     # Realtime subscriptions
│   │   ├── useAuth.ts         # Auth context + role checks
│   │   └── useTeamFilter.ts
│   ├── types/
│   │   ├── index.ts           # All collection types
│   │   └── swiss-volley.ts
│   ├── modules/
│   │   ├── games/
│   │   ├── spielplanung/
│   │   ├── hallenplan/        # MAIN TOOL
│   │   ├── trainings/
│   │   ├── absences/
│   │   ├── scorer/
│   │   ├── calendar/
│   │   └── teams/
│   └── utils/
│       ├── teamColors.ts
│       ├── dateHelpers.ts
│       ├── svApi.ts
│       └── icalGenerator.ts
├── pb_hooks/                  # PocketBase server-side JS hooks
│   ├── sv_sync.pb.js
│   ├── ical_feed.pb.js
│   ├── absence_propagate.pb.js
│   └── conflict_check.pb.js
├── pb_migrations/             # PocketBase schema migrations
├── scripts/
│   ├── deploy-hooks.sh        # rsync hooks to Synology
│   ├── backup.sh
│   ├── import-sheets.ts       # One-time Google Sheets import
│   └── import-data.ts         # One-time data import
└── wrangler.toml              # Cloudflare Pages config (if needed)
```

## Deployment

### Frontend (automatic)
```
git push → GitHub → Cloudflare Pages auto-build
Build command: npm run build
Output directory: dist
Environment variable: VITE_PB_URL=https://kscw-api.lucanepa.com
```

### PocketBase hooks/migrations (manual)
```bash
rsync -avz pb_hooks/ synology:/volume1/docker/pocketbase/pb_hooks/
rsync -avz pb_migrations/ synology:/volume1/docker/pocketbase/pb_migrations/
ssh synology "sudo docker restart pocketbase-kscw"
```

## CORS Configuration
PocketBase Settings → Application → Allowed origins:
- `https://kscw.lucanepa.com`
- `https://kscw.ch`
- `http://localhost:5173` (dev)

## Implementation Priority
1. **Foundation**: Scaffold repo, Vite + React + TailwindCSS, PocketBase client, auth, layout shell, routing
2. **Hallenplan** (main tool): Hall slots week view, recurring bookings, closure management
3. **Games & Results**: Swiss Volley data sync, game list, rankings
4. **Schreibereinsätze**: Port existing scorer UI to React
5. **Spielplanung**: Calendar + list views, import from Google Sheets
6. **Trainings + Absences**: Attendance tracking, absence management
7. **Calendar**: Unified view, iCal feed generation
8. **Teams & Members**: Rosters, profiles, stats

## Existing Code Reference
These repos contain logic to port (all will be deleted after migration):
- `kscw_schreibereinsaetze` — PocketBase scorer app (vanilla JS + HTML)
- `kscw_spielplanung` — Google Sheets calendar (vanilla JS + HTML)
- `swiss_volley_data` — Swiss Volley API consumer (jQuery, legacy)
- `kscw_kalendar` — Calendar with Google iCal proxy (legacy)
- `kscw_matcher` — Match scheduling tool (legacy)
- `kscw_h3` — Team page for H3 (static HTML)
- `coaching_kscw` — Coaching tool with AI integration (Groq/OpenRouter)
