import { useTranslation } from 'react-i18next'
import { ScrollText } from 'lucide-react'
import { Badge } from '../../components/ui/badge'

const APP_VERSION = '2.3.1'

interface ChangelogEntry {
  version: string
  date: string
  sections: { title: string; items: string[] }[]
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.3.1',
    date: '2026-03-24',
    sections: [
      {
        title: 'Bug Fixes',
        items: [
          'Coach visibility: coaches and team responsibles now see trainings, games, events, and participation for teams they manage (even without being a player)',
          'Team filter added to Events page for users with multiple teams',
          'Fixed 400 error on pending members query — created missing requested_team relation field on members collection',
          'Updated members API rule so coaches can view pending members requesting to join their team',
        ],
      },
    ],
  },
  {
    version: '2.3.0',
    date: '2026-03-24',
    sections: [
      {
        title: 'Features',
        items: [
          'Admin Dashboard: new overview page with KPI strip (members, teams, pending approvals, PB health, sync status) and collapsible sections for Members & Teams, Games & Season, Activity & Participation, and Infrastructure',
          'Query Workspace: enhanced SQL editor with saved queries, 10 pre-built query templates with parameters, visual point-and-click query builder, and chart visualization (bar, line, pie) for results',
          'Dashboard visible to all admins; Query and Tables tabs restricted to superadmins',
        ],
      },
    ],
  },
  {
    version: '2.2.0',
    date: '2026-03-24',
    sections: [
      {
        title: 'Features',
        items: [
          'RSVP response timestamps in Participation Roster — see when each team member responded (relative time: "vor 2 Std.", "gestern")',
          'New team toggle "Antwortzeit anzeigen" in team settings — coaches can enable/disable RSVP time visibility per team',
        ],
      },
    ],
  },
  {
    version: '2.1.1',
    date: '2026-03-24',
    sections: [
      {
        title: 'Bug Fixes',
        items: [
          'Re-enabled branded auth emails (password reset, verification, email change, login alert) after Coolify redeploy disabled the hook file',
          'Removed broken OTP email branding hook that silently blocked all OTP email sending — PB now sends default-styled OTP emails reliably',
        ],
      },
    ],
  },
  {
    version: '2.1.0',
    date: '2026-03-24',
    sections: [
      {
        title: 'Features',
        items: [
          'OTP-based authentication: all auth flows now use 8-digit email codes instead of token links',
          'New signup: email verified via OTP before registration',
          'Existing member activation: OTP replaces confusing "password reset" for ClubDesk imports',
          'Shell invite (QR join): set password inline after claiming invite',
          'Forgot password: inline OTP flow on login page',
          'Context-aware labels: "Activate Account", "Verify Email", "Reset Password", "Set Password"',
        ],
      },
    ],
  },
  {
    version: '2.0.1',
    date: '2026-03-24',
    sections: [
      {
        title: 'Bug Fixes',
        items: [
          'Feedback submissions now visible under "My Submissions" (missing timestamp field fixed)',
          'Participation counts no longer vanish briefly when opening game/training details',
        ],
      },
      {
        title: 'Features',
        items: [
          'Attach up to 5 screenshots per feedback submission (was 1)',
        ],
      },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-03-19',
    sections: [
      {
        title: 'Core Platform',
        items: [
          'React 19 + TypeScript + Vite + Tailwind CSS',
          'PocketBase backend with realtime subscriptions',
          'Cloudflare Pages + Infomaniak VPS (CF Tunnel)',
          '5 languages: DE, EN, FR, IT, Swiss German',
        ],
      },
      {
        title: 'Authentication',
        items: [
          'Email login, signup, password reset',
          'Google OAuth with onboarding',
          'Role approval system (pending → coach approved)',
          'Privacy settings and account deletion',
        ],
      },
      {
        title: 'Games & Scoreboard',
        items: [
          'Game cards with set scores and KSCW-perspective coloring',
          'Scoreboard with Absolute / Per Game toggle',
          'Embed page for external widgets',
        ],
      },
      {
        title: 'Calendar & Hallenplan',
        items: [
          'Monthly calendar grid with H/A colored boxes',
          'Absence tracking with clickable bars',
          'Hall slot management with virtual slots and claiming',
          'Sport field filtering, hide past days',
        ],
      },
      {
        title: 'Trainings & Participation',
        items: [
          'RSVP on all activities with realtime sync',
          'Participation notes and save confirmation',
          'Guest counter and player/coach split',
          'Recurring training selection',
        ],
      },
      {
        title: 'Teams & Roster',
        items: [
          'Team overview with photo cards',
          'Position management and roster editor',
          'Per-team guest levels (G1/G2/G3)',
          'External user invite system with QR codes',
          'Shell accounts → full member conversion',
        ],
      },
      {
        title: 'Admin Mode',
        items: [
          'Admin/member mode separation with toggle',
          'All modules respect admin mode',
          'Database browser, ClubDesk sync, game scheduling',
        ],
      },
      {
        title: 'Other Features',
        items: [
          'Scorer duty management and delegation',
          'In-app notification system',
          'Event management with Trainingsweekend type',
          'Location autocomplete (local halls + Nominatim)',
          'Feedback & bug reporting with GitHub integration',
          'Auto-deploy webhook for PocketBase hooks',
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
