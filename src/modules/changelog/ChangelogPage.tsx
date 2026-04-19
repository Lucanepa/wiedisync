import { useTranslation } from 'react-i18next'
import { ScrollText } from 'lucide-react'
import { Badge } from '../../components/ui/badge'

const APP_VERSION = '3.15.1'

interface ChangelogEntry {
  version: string
  date: string
  sections: { title: string; items: string[] }[]
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '3.15.1',
    date: '2026-04-19',
    sections: [
      {
        title: 'Fix',
        items: [
          'Trainer:innen konnten keine Events für ihr Team erstellen — der Speichern-Button warf „Keine Berechtigung". Behoben: das Event-Formular schickt Teams/Eingeladene jetzt im Directus-Junction-Format, und den Rollen-Policies fehlten Create/Update/Delete-Rechte auf den M2M-Tabellen events_teams und events_members.',
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
        title: 'Neu',
        items: [
          'Kontaktieren-Funktion: zusätzlicher Kanal „In-App-Chat" für Event-Broadcasts. Bei aktivierter Option wird pro Event ein persistenter Chat erstellt, in dem Trainer:innen & Admins schreiben und Teilnehmende direkt antworten können. RSVPs steuern automatisch, wer den Chat sieht: bei „Dabei"/„Vielleicht" wird man hinzugefügt, bei „Abgesagt" archiviert.',
          'Der Broadcast-Erfolgs-Toast zeigt neu eine „Chat öffnen"-Aktion, die direkt in den Event-Chat springt.',
          'Event-Chats folgen dem persönlichen „Team-Chat"-Schalter: wer Chat global ausgeschaltet hat, sieht Event-Chats nicht im Posteingang (können pro Chat wieder sichtbar gemacht werden).',
          'In-App-Kanal ist nur für Events verfügbar — für Spiele und Trainings bleibt es bei E-Mail + Push.',
        ],
      },
    ],
  },
  {
    version: '3.13.0',
    date: '2026-04-19',
    sections: [
      {
        title: 'Neu',
        items: [
          'Kontaktieren-Funktion: Trainer:innen, Team-Verantwortliche, Vorstand und Admins können jetzt direkt aus der Anlass-Detailansicht (Event, Spiel, Training) per E-Mail oder Push-Benachrichtigung an alle Teilnehmenden schreiben — mit Audience-Filter (z. B. nur Bestätigte) und Live-Empfängerzahl.',
          'Externe Anmeldungen (z. B. Mixed-Turnier-Form auf der Website) sind nun in einer generischen Tabelle event_signups gebündelt — bereit für künftige öffentliche Anmeldeformulare. Sie können bei Event-Broadcasts mit einbezogen werden.',
          'Audit-Trail für Broadcasts: jede Aussendung wird mit Sender, Empfänger-Snapshot, Kanälen und Zustellungs-Ergebnissen protokolliert (nFADP-konform).',
          'Rate-Limit für Broadcasts: max. 3 pro Anlass pro Stunde, mind. 20 Min. Abstand — schützt vor versehentlichem Spam.',
        ],
      },
    ],
  },
  {
    version: '3.12.0',
    date: '2026-04-19',
    sections: [
      {
        title: 'Neu',
        items: [
          'Nachrichten-Feature ist komplett gebaut und auf dem Server live — Team-Chats, Direktnachrichten, Umfragen, Reaktionen, Meldungen, Einverständnis, Datenexport und Push-Benachrichtigungen. Aktivierung für Mitglieder erfolgt in einem nächsten Schritt (Test-Gruppe zuerst, dann alle).',
          'Datenschutzerklärung: neuer Abschnitt „Nachrichten" unter /datenschutz#nachrichten mit Details zu gespeicherten Daten, Aufbewahrungsfristen (12 Monate / 30 Tage / 90 Tage), Zugriff und Rechten.',
          'Test-Rollout-Modus: einzelne Mitglieder können das Feature vor der offiziellen Freigabe testen (Admin-gesteuerte Allowlist).',
        ],
      },
      {
        title: 'Sicherheit',
        items: [
          'Datenbank-Zugriff für die Supabase-anon- und -authenticated-Rollen auf allen Tabellen gesperrt (Defense-in-Depth).',
          'Nicht genutzte Supabase-Dienste (REST, Auth, Edge Functions, Studio, Storage, MinIO u. a.) abgeschaltet — weniger Angriffsfläche.',
          'Nachrichten: Berechtigungen auf Zeilenebene verschärft — Mitglieder sehen nur ihre eigenen Blocks, Nachrichtenanfragen und Konversations-Mitgliedschaften über die REST-API.',
          'Admin-Hygiene: nicht genutzte Test-Accounts entfernt, Drift zwischen Dev und Prod ausgeglichen, alter Static-Token eines Members rotiert.',
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
