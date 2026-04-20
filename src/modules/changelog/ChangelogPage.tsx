import { useTranslation } from 'react-i18next'
import { ScrollText } from 'lucide-react'
import { Badge } from '../../components/ui/badge'

const APP_VERSION = '3.15.6'

interface ChangelogEntry {
  version: string
  date: string
  sections: { title: string; items: string[] }[]
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '3.15.6',
    date: '2026-04-20',
    sections: [
      {
        title: 'Fix',
        items: [
          'Games page no longer fails to load. When a coach role was orphaned (team deleted, but the coach assignment left behind), the filter contained an invalid team reference and the server rejected the whole request. Now we skip orphaned assignments and cleaned up the leftover data.',
        ],
      },
    ],
  },
  {
    version: '3.15.5',
    date: '2026-04-20',
    sections: [
      {
        title: 'Fix',
        items: [
          'Conversation page no longer crashes when tapping the back button. The shadcn Button wrapper was injecting an extra (empty) slot child, which tripped a Radix assertion and blanked the page.',
          'Cloudflare analytics beacon now allowed by CSP (no more blocked-connection warnings in the console).',
          'Added the standards-compliant `mobile-web-app-capable` meta tag alongside the Apple-specific one (removes the browser deprecation warning).',
        ],
      },
    ],
  },
  {
    version: '3.15.4',
    date: '2026-04-20',
    sections: [
      {
        title: 'Performance',
        items: [
          'Games and trainings pages load in a single request. Previously the cards appeared empty for about a second on mobile while participations loaded separately — now everything arrives together.',
        ],
      },
      {
        title: 'Improved',
        items: [
          'Games page: upcoming and results now split into separate "Meisterschaft" and "Cup" sections, so cup games (Mobiliar Volley Cup, Züri Cup) no longer get mixed in with regular league games.',
        ],
      },
    ],
  },
  {
    version: '3.15.3',
    date: '2026-04-20',
    sections: [
      {
        title: 'Improved',
        items: [
          'Event, training, and game detail modals — cleaner mobile layout. The RSVP summary at the bottom now uses the same 3-bar visual as the cards, the broadcast (paper-plane) button moved to the top-right of the modal header, and the "Teilnahme" roster button is now a compact icon.',
        ],
      },
    ],
  },
  {
    version: '3.15.2',
    date: '2026-04-20',
    sections: [
      {
        title: 'Fix',
        items: [
          'Coaches now have all the permissions they need to manage their team: assign coach/team-responsible roles, change the team photo, accept or reject member requests, create polls, and edit their own Hallenplan slots. Previously some of these actions failed with a "No permission" error.',
          'Rejecting a pending member request no longer hard-deletes the account — it deactivates it instead (audit trail preserved).',
        ],
      },
    ],
  },
  {
    version: '3.15.1',
    date: '2026-04-19',
    sections: [
      {
        title: 'Fix',
        items: [
          'Coaches could not create events for their team — the save button threw a "No permission" error. Fixed: the event form now sends teams and invitees in the Directus junction format, and the role policies were missing create/update/delete permissions on the events_teams and events_members M2M tables.',
        ],
      },
    ],
  },
  {
    version: '3.15.0',
    date: '2026-04-19',
    sections: [
      {
        title: 'Under the hood',
        items: [
          'Internal datetime handling switched to proper UTC storage with Europe/Zurich rendering. Nothing changes in the times you see — but now the app, Directus admin, email notifications, and iCal calendar subscriptions all agree on the same Zurich-local hour, and DST transitions are handled precisely.',
        ],
      },
    ],
  },
  {
    version: '3.14.0',
    date: '2026-04-19',
    sections: [
      {
        title: 'New',
        items: [
          'Broadcast feature: additional "In-App Chat" channel for event broadcasts. When enabled, a persistent chat is created per event where coaches and admins can post and participants can reply directly. RSVPs automatically control chat membership: "Going"/"Maybe" adds you, "Declined" archives you.',
          'The broadcast success toast now shows an "Open chat" action that jumps straight to the event chat.',
          'Event chats follow the personal "Team chat" toggle: if you have globally disabled chat, event chats will not appear in your inbox (can be un-archived per chat).',
          'The in-app channel is available for events only — games and trainings remain on email + push.',
        ],
      },
    ],
  },
  {
    version: '3.13.0',
    date: '2026-04-19',
    sections: [
      {
        title: 'New',
        items: [
          'Broadcast feature: coaches, team responsibles, the board and admins can now write to all participants directly from the activity detail view (event, game, training) via email or push notification — with an audience filter (e.g. confirmed only) and a live recipient count.',
          'External signups (e.g. the Mixed-Tournament form on the website) are now bundled in a generic event_signups table — ready for future public signup forms. They can be included in event broadcasts.',
          'Broadcast audit trail: every send is logged with sender, recipient snapshot, channels, and delivery results (nFADP-compliant).',
          'Broadcast rate limit: max. 3 per activity per hour, minimum 20-minute gap — protects against accidental spam.',
        ],
      },
    ],
  },
  {
    version: '3.12.0',
    date: '2026-04-19',
    sections: [
      {
        title: 'New',
        items: [
          'Messaging feature is fully built and live on the server — team chats, direct messages, polls, reactions, reports, consent, data export, and push notifications. Activation for members happens in a next step (test group first, then everyone).',
          'Privacy policy: new "Messages" section at /datenschutz#nachrichten with details on stored data, retention periods (12 months / 30 days / 90 days), access, and rights.',
          'Test rollout mode: individual members can try the feature before the official release (admin-managed allowlist).',
        ],
      },
      {
        title: 'Security',
        items: [
          'Database access for the Supabase anon and authenticated roles has been revoked on all tables (defense-in-depth).',
          'Unused Supabase services (REST, Auth, Edge Functions, Studio, Storage, MinIO, etc.) have been shut down — smaller attack surface.',
          'Messaging: row-level permissions tightened — members only see their own blocks, message requests, and conversation memberships through the REST API.',
          'Admin hygiene: removed unused test accounts, reconciled drift between dev and prod, rotated a member\'s old static token.',
        ],
      },
    ],
  },
  {
    version: '3.11.3',
    date: '2026-04-17',
    sections: [
      {
        title: 'Fixes',
        items: [
          'Volleyball home games: the referee-expenses section no longer fires a permission error for logged-out or pending-approval visitors — the fetch now waits until the account is approved.',
        ],
      },
    ],
  },
  {
    version: '3.11.2',
    date: '2026-04-17',
    sections: [
      {
        title: 'Security',
        items: [
          'Vereinsnews: CTA links are now strictly validated — only https:// and in-app links are allowed.',
          'Vereinsnews: sending to ALL active members now shows a confirmation dialog to prevent accidental mass mails.',
        ],
      },
      {
        title: 'Fixes',
        items: [
          'Admin Vereinsnews: the list page loads again without errors.',
          'Events page: rare crash fixed and no more error noise for logged-out visitors.',
          'Admin Daten-Explorer: the scorer-delegations table displays correctly again.',
        ],
      },
    ],
  },
  {
    version: '3.11.1',
    date: '2026-04-17',
    sections: [
      {
        title: 'Fixes',
        items: [
          'Admin Daten-Explorer: teams now also show up for coaches, team responsibles and captains (new "Relationship" column). Sex, roles and participation status render localized.',
          'Admin Daten-Explorer: referee expenses load correctly again (amounts in CHF); removed events/trainings/games are clearly marked as "removed".',
        ],
      },
    ],
  },
  {
    version: '3.11.0',
    date: '2026-04-17',
    sections: [
      {
        title: 'New',
        items: [
          'Vereinsnews: admins can post club-wide announcements that appear in the homepage News card — with title, image, rich text (5 languages), optional link, pin-to-top, expiry, and audience targeting (all members or one sport).',
          'Optionally push and/or email the announcement to the audience — fired exactly once per post.',
          'Homepage News card merges announcements with notifications (pinned first, newest next). "Show all" opens a paginated archive.',
        ],
      },
    ],
  },
  {
    version: '3.10.0',
    date: '2026-04-17',
    sections: [
      {
        title: 'New (Admin)',
        items: [
          'Daten-Explorer: fast read-only browser across members, teams, events, trainings and games with global fuzzy search (⌘K / Ctrl+K).',
          'Click a team, event or member to see linked records (participations, absences, Schreibereinsätze, referee expenses) on demand.',
          'Deep-link and share any view via URL; breadcrumb and browser back/forward work naturally.',
          'Sport admins automatically see only their sport; club-wide events stay visible.',
        ],
      },
    ],
  },
  {
    version: '3.9.4',
    date: '2026-04-17',
    sections: [
      {
        title: 'Fixes',
        items: [
          'All teams now use the same season format. A yearly auto-rollover keeps the season picker in sync — the finished season disappears, a new future one is added.',
        ],
      },
    ],
  },
  {
    version: '3.9.3',
    date: '2026-04-17',
    sections: [
      {
        title: 'Fixes',
        items: [
          'Coaches and team responsibles are now also notified (email, in-app, push) when a member requests to join their team — previously only new signups triggered notifications.',
        ],
      },
    ],
  },
  {
    version: '3.9.2',
    date: '2026-04-17',
    sections: [
      {
        title: 'Fixes',
        items: [
          'Signing up with an existing email now redirects to the login page with a clear "account already exists" notice.',
          'Emails are now treated case-insensitively everywhere — signup, login and password reset work regardless of casing.',
        ],
      },
    ],
  },
  {
    version: '3.9.1',
    date: '2026-04-17',
    sections: [
      {
        title: 'Fixes',
        items: [
          'Removed a brief flash of empty roster/absence/participation views when opening a team page.',
        ],
      },
    ],
  },
  {
    version: '3.9.0',
    date: '2026-04-14',
    sections: [
      {
        title: 'New',
        items: [
          'Coaches and team responsibles can now change other members\' participation directly in the roster (trainings and games) — pencil icon next to the status opens the selector.',
          'Members can override their own "auto-declined due to absence" status.',
        ],
      },
    ],
  },
  {
    version: '3.8.0',
    date: '2026-04-10',
    sections: [
      {
        title: 'Guided Tours',
        items: [
          '10 step-by-step tours for the main features: trainings, games, events, absences, scorer duty and Hallenplan.',
          'Welcome dialog for new members with an optional intro tour.',
          '"?" button on every page opens the matching tour.',
          'Role-based: players, coaches and admins only see tours relevant to them.',
          'Available in German, English, French, Italian and Swiss German.',
        ],
      },
    ],
  },
  {
    version: '3.6.0',
    date: '2026-04-05',
    sections: [
      {
        title: 'Profile',
        items: [
          'Swiss Volley licence card: category, number, LAS, foreigner badge, Federation of Origin, federation and activation status — loaded live from Volleymanager.',
          'Absence cards show type and detail at the top, date on a separate line below.',
        ],
      },
    ],
  },
  {
    version: '3.5.0',
    date: '2026-04-05',
    sections: [
      {
        title: 'Volleymanager Sync',
        items: [
          'Extended sync: nationality, LAS, foreigner status, federation and double-licence info.',
          'All players are now synced (not just active licences).',
          'Email matching: members automatically inherit their Volleymanager email on signup.',
        ],
      },
    ],
  },
  {
    version: '3.4.0',
    date: '2026-04-04',
    sections: [
      {
        title: 'Infrastructure',
        items: [
          'Server migration to new hosting — better performance, more storage, uptime monitoring with email alerts.',
        ],
      },
    ],
  },
  {
    version: '3.2.0',
    date: '2026-04-04',
    sections: [
      {
        title: 'Security',
        items: [
          'Major hardening pass: injection protection across signup and contact form, HTML escaping in emails, rate limiting for password reset.',
          'Coach emails are no longer publicly visible — the contact form still forwards server-side.',
        ],
      },
    ],
  },
  {
    version: '3.0.0',
    date: '2026-03-29',
    sections: [
      {
        title: 'Backend Upgrade',
        items: [
          'Full migration to a new backend stack — all data, files, users and passwords transferred. Faster responses and lower memory use.',
          'Google login now works through the official OAuth flow.',
          'Branded email templates for password reset, invitations, OTP codes and scorer reminders.',
          'Web push notifications on new infrastructure.',
          'Automatic daily game and ranking sync with Swiss Volley and Basketplan.',
        ],
      },
    ],
  },
  {
    version: '2.7.2',
    date: '2026-03-29',
    sections: [
      {
        title: 'New',
        items: [
          'Google login: you can now sign in with your Google account.',
        ],
      },
      {
        title: 'Fixes',
        items: [
          'Hallenplan crash when a slot had no team assigned.',
          'Games, sponsors and training data loading reliably again.',
          'Incomplete games (missing opponent, date or time) are no longer shown.',
        ],
      },
    ],
  },
  {
    version: '2.7.1',
    date: '2026-03-29',
    sections: [
      {
        title: 'Fixes',
        items: [
          'Scorer-duty page loads cleanly again; sorting on recently created records across scorer, polls, feedback and scheduling fixed.',
          'Training and game filters now also include records with no status set.',
          'Login session extended from 15 minutes to 1 hour.',
        ],
      },
    ],
  },
  {
    version: '2.6.0',
    date: '2026-03-26',
    sections: [
      {
        title: 'New',
        items: [
          'Team settings redesigned: accordion with Features, Game Defaults and Training Defaults, iOS-style toggles.',
          'Color-coded RSVP confirmations: save toast matches the response color (green = yes, red = no, yellow = maybe).',
          '"Maybe" auto-decline: optionally convert tentative responses to "No" once the RSVP deadline passes (per team).',
          'Team defaults: coaches can set default min players, RSVP deadline, note requirement and auto-cancel per team — applied to new games and trainings.',
        ],
      },
    ],
  },
  {
    version: '2.5.0',
    date: '2026-03-26',
    sections: [
      {
        title: 'New',
        items: [
          'Team photo zoom: coaches can zoom in/out when cropping the team photo — KSCW brand bands appear on the sides when zoomed out.',
        ],
      },
    ],
  },
  {
    version: '2.4.1',
    date: '2026-03-26',
    sections: [
      {
        title: 'New',
        items: [
          'Referee expenses: coaches can record who paid the referees for volleyball home games directly in the game detail (payer, amount, notes).',
          'New admin page "Referee Expenses" with team/season filters and CSV export.',
        ],
      },
    ],
  },
  {
    version: '2.4.0',
    date: '2026-03-25',
    sections: [
      {
        title: 'New',
        items: [
          'Participation warnings: red/yellow triangles on game, training and event cards when participation is insufficient — click for details.',
          'Game roster check: RED warning below 6 field players (VB) or 5 players (BB) confirmed; YELLOW when no coach confirmed. Libero-aware for volleyball.',
          'Training auto-cancel: optional toggle that cancels at the RSVP deadline if not enough confirmations, freeing the hall slot.',
          'Pre-deadline alerts: email + in-app notification 1 day before the deadline if the roster or training minimum is not yet met.',
        ],
      },
    ],
  },
  {
    version: '2.3.1',
    date: '2026-03-24',
    sections: [
      {
        title: 'Fixes',
        items: [
          'Coaches and team responsibles now see trainings, games, events and participation for the teams they manage — even if they are not players themselves.',
          'Team filter added to the Events page for members in multiple teams.',
          'Coaches can now also see pending members who requested to join their team.',
        ],
      },
    ],
  },
  {
    version: '2.3.0',
    date: '2026-03-24',
    sections: [
      {
        title: 'Admin Dashboard',
        items: [
          'New overview page with KPIs (members, teams, pending approvals, sync status) and collapsible sections.',
          'Query Workspace: SQL editor with saved queries, 10 pre-built templates with parameters, visual query builder and chart output (bar, line, pie).',
          'Dashboard visible to all admins; Query and Tables tabs restricted to superadmins.',
        ],
      },
    ],
  },
  {
    version: '2.2.0',
    date: '2026-03-24',
    sections: [
      {
        title: 'New',
        items: [
          'RSVP response timestamps in the Participation Roster: see when each team member responded ("2 hrs ago", "yesterday").',
          'Per-team toggle "Show response time" in team settings.',
        ],
      },
    ],
  },
  {
    version: '2.1.0',
    date: '2026-03-24',
    sections: [
      {
        title: 'OTP Authentication',
        items: [
          'All auth flows now use 8-digit email codes instead of token links.',
          'Signup: email is verified via OTP before registration.',
          'Activation of existing members (ClubDesk import) via OTP instead of the confusing "password reset" flow.',
          'Shell invite (QR join): set password inline after claiming the invite.',
          'Forgot password: inline OTP flow on the login page.',
        ],
      },
    ],
  },
  {
    version: '2.0.1',
    date: '2026-03-24',
    sections: [
      {
        title: 'Fixes',
        items: [
          'Feedback submissions are visible again under "My Submissions".',
          'Participation counts no longer flicker briefly when opening game/training details.',
        ],
      },
      {
        title: 'New',
        items: [
          'Attach up to 5 screenshots per feedback submission (was 1).',
        ],
      },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-03-19',
    sections: [
      {
        title: 'Launch',
        items: [
          'Wiedisync goes live: real-time web app for KSC Wiedikon on Cloudflare hosting, available in German, English, French, Italian and Swiss German.',
        ],
      },
      {
        title: 'Authentication',
        items: [
          'Email login, signup and password reset; Google OAuth with onboarding; role approval; privacy settings and account deletion.',
        ],
      },
      {
        title: 'Games & Scoreboard',
        items: [
          'Game cards with set scores and KSCW-perspective coloring, scoreboard with Total / Per-Game toggle, embed page for external widgets.',
        ],
      },
      {
        title: 'Calendar & Hallenplan',
        items: [
          'Monthly calendar with home/away colored boxes, clickable absence bars, hall slot management with virtual slots and claiming.',
        ],
      },
      {
        title: 'Trainings & Participation',
        items: [
          'RSVP on all activities with realtime sync, participation notes, guest counter and recurring training selection.',
        ],
      },
      {
        title: 'Teams & Roster',
        items: [
          'Team overview with photo cards, position management, per-team guest levels (G1/G2/G3), external user invite via QR code, shell-account upgrade.',
        ],
      },
      {
        title: 'Admin',
        items: [
          'Admin/member mode separation, database browser, ClubDesk sync, game scheduling.',
        ],
      },
      {
        title: 'Other Features',
        items: [
          'Schreiberdienst (scorer duty) management and delegation, in-app notifications, events (including Trainingsweekend), location autocomplete, feedback & bug reporting.',
        ],
      },
    ],
  },
]

export { APP_VERSION }

export default function ChangelogPage() {
  const { t } = useTranslation('nav')

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <ScrollText className="h-6 w-6 text-brand-600 dark:text-gold-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('changelog')}</h1>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Wiedisync v{APP_VERSION}</p>
      </div>

      <div className="space-y-8">
        {CHANGELOG.map((entry) => (
          <div key={entry.version}>
            <div className="mb-4 flex items-center gap-3">
              <Badge variant="default" className="font-mono">v{entry.version}</Badge>
              <span className="text-sm text-gray-500 dark:text-gray-400">{entry.date}</span>
            </div>

            <div className="space-y-4">
              {entry.sections.map((section) => (
                <div key={section.title}>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {section.title}
                  </h3>
                  <ul className="space-y-1">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500 dark:bg-gold-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
