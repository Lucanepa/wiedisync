import { useTranslation } from 'react-i18next'
import { ScrollText } from 'lucide-react'
import { Badge } from '../../components/ui/badge'

const APP_VERSION = '4.4.1'

interface ChangelogEntry {
  version: string
  date: string
  sections: { title: string; items: string[] }[]
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '4.4.1',
    date: '2026-04-25',
    sections: [
      {
        title: 'Set-score boxes align cleanly',
        items: [
          'Per-set boxes in the games list and the game detail modal now share a fixed width — single-digit results (e.g. "8") no longer make the row jitter against double-digit results.',
          'Same fix applied on kscw.ch (public game modal).',
        ],
      },
    ],
  },
  {
    version: '4.4.0',
    date: '2026-04-25',
    sections: [
      {
        title: 'Tables everywhere data lives',
        items: [
          '9 list pages were converted to proper tables: roster editor, announcements, audit log, registrations, referee expenses, admin reports, absences (mine + team + weekly), Spielplanung list, calendar unified list, news archive.',
          'Each table compacts gracefully on mobile — names wrap to two lines instead of truncating, position labels collapse to initials (S/O/M/D/L/G), optional columns hide on small screens, and action buttons stack vertically so everything stays tappable.',
          'Cards are kept where they earn their keep — game/training/event cards (RSVP, scores, opponent logos), team cards (team photo + brand color), and the changelog itself are explicit exceptions to the new rule.',
        ],
      },
      {
        title: 'Absences page reorganised',
        items: [
          'New two-axis toggle: Absences | Unavailabilities × Mine | Team. The two button rows replace the previous single 3-tab bar — same visual style, four sections.',
          'New "Team Unavailabilities" view shows everyone\'s recurring weekly schedules in your team — useful for spotting clashes without messaging around.',
          'Team scope is now visible to every team member, not just coaches/team responsibles. The backend permission was already open; only the UI was gating it.',
        ],
      },
    ],
  },
  {
    version: '4.3.0',
    date: '2026-04-24',
    sections: [
      {
        title: 'Basketball Halle A+B combo booking',
        items: [
          'Basketball home games can now block both KWI A and KWI B at once. The manual-game modal shows a "KWI A + B (Basketball)" option at the top of the hall picker for basketball teams.',
          'Excel import recognises A+B / KWI A+B / A + B in the Hall column for basketball rows.',
          'Game detail drawer has a one-click "Mark as KWI A + B" / "Back to single hall" toggle — works on SVRZ-synced games too.',
          'Conflict detection is now multi-hall-aware: a basketball A+B game correctly blocks a volleyball-only game on either KWI A or KWI B at the same time.',
        ],
      },
      {
        title: 'Volleyball Saturday hall prefill',
        items: [
          'When creating a home game for a volleyball team on a Saturday, the hall field prefills with a priority ladder: (1) the team’s own Saturday training slot, (2) KWI C, (3) KWI A, (4) KWI B.',
          'A muted hint explains the choice. The pick is a prefill only — admins can override it freely.',
        ],
      },
      {
        title: 'Under the hood',
        items: [
          'New `games.additional_halls` JSON field (nullable, cast-json, tags interface) on the games collection.',
          'Hallenplan no longer infers basketball spans from `team.sport` — spans now come from `additional_halls`. A backward-compat fallback keeps legacy basketball rows rendering correctly until they’re re-saved.',
        ],
      },
    ],
  },
  {
    version: '4.2.0',
    date: '2026-04-23',
    sections: [
      {
        title: 'Spielplanung sandbox mode',
        items: [
          'Admins and Spielplaners can now create, edit, and delete manual games directly on the calendar. Empty-day "+" affordance opens a modal with the date prefilled; edit/delete happens from the game detail drawer.',
          'Bulk Excel import for manual games — download the template, fill in one game per row, upload to preview and import.',
          'New scoped Spielplaner role via a `spielplaner_assignments` collection. Admins can grant per-team access without making someone a club-wide Spielplaner (admin-only accordion on the page).',
        ],
      },
      {
        title: 'Week view with drag-to-reschedule',
        items: [
          'New "Week" option in the view toggle shows the 14:00–22:00 time rail with game blocks sized to the full 2h 45min window (45min warm-up + 2h play).',
          'Manual games are draggable — drop on a different day or time to reschedule. 15-minute time snap; conflicts (same team same day, hall overlap) block the move with an error toast; same-team within ±2 days shows a soft warning.',
          'Touch drag works on phone browsers. SVRZ-synced games are not draggable.',
          'Desktop only — mobile keeps the existing by-date / by-team list views.',
        ],
      },
      {
        title: 'Calendar refinements',
        items: [
          'Richer month-view chips show time, home/away icon, opponent, with a colour-coded left border (emerald = home, blue = away). Manual games carry a dashed outline.',
          'Month navigation no longer clamps to the current Swiss Volley season — prev/next arrows cross season boundaries freely, and a new season picker jumps between seasons directly.',
          'Game detail drawer gained edit mode with SVRZ-field locking — official fields are disabled against edit for SVRZ-synced games; only duty assignments stay editable. "Copy SVRZ details" makes Volleymanager paste-back a one-click operation.',
        ],
      },
    ],
  },
  {
    version: '4.1.0',
    date: '2026-04-23',
    sections: [
      {
        title: 'SVRZ game-scheduling invites',
        items: [
          'Spielplan admins can now issue tokenized links to specific opponent clubs instead of relying on self-registration — each link opens the slot picker directly without a captcha.',
          'New "Aus SVRZ importieren" button auto-populates the opponent list from the synced SVRZ game feed and pulls Spielplanverantwortlicher contacts via the per-game endpoint (with a club-level fallback feed for clubs without per-game entries).',
          'Manual CSV paste is available alongside SVRZ import for opponents not in the feed.',
          'One-click "Mail entwerfen" opens a pre-filled mailto with a DE invitation body, tokenized link, and expiry date.',
          'Full invite lifecycle: invited → viewed (on first open) → booked (after a slot pick), with reissue + revoke actions.',
          'Daily SVRZ sync keeps games and club contacts fresh; admins can also trigger a manual sync from the panel.',
        ],
      },
    ],
  },
  {
    version: '4.0.6',
    date: '2026-04-22',
    sections: [
      {
        title: 'Notifications',
        items: [
          'You can now delete individual notifications — a small trash icon appears on each row in both the mobile panel and the desktop sidebar.',
          'New "Clear read" button in the header wipes all already-read notifications in one click. Unread ones are left alone, so nothing urgent gets thrown away accidentally.',
          'Available in all five languages (DE / GSW / EN / FR / IT).',
        ],
      },
    ],
  },
  {
    version: '4.0.5',
    date: '2026-04-22',
    sections: [
      {
        title: 'Moderation notifications',
        items: [
          'Tapping a "New report" notification in the desktop sidebar now opens /admin/reports instead of silently routing to the homepage. The desktop panel was missing the route handler that the mobile panel already had.',
          'The reason label inside the notification ("Neue Meldung: spam") is now properly translated and capitalised ("Neue Meldung: Spam" / "Belästigung" / "Unangemessen" / "Sonstiges") in all five languages. Was rendering the raw enum value.',
          'Desktop sidebar also gained the correct activity label ("Meldung" instead of the generic "Aktivität" fallback) and a Flag icon for report notifications.',
        ],
      },
    ],
  },
  {
    version: '4.0.4',
    date: '2026-04-20',
    sections: [
      {
        title: 'Navigation',
        items: [
          'Inbox (Messaging) now sits at the top of the mobile More sheet secondary list, above Events. It was getting lost below the other entries.',
        ],
      },
    ],
  },
  {
    version: '4.0.3',
    date: '2026-04-20',
    sections: [
      {
        title: 'Navigation',
        items: [
          'Mobile More sheet now mirrors the desktop sidebar. Inbox, News, Announcements, Moderation Reports, Infra Health and the Messaging Settings row were missing — they are now all there. The "What\'s New" row finally shows the real version number instead of a hardcoded v1.0.0.',
          'Tapping anywhere on the user row in the More sheet now opens your profile. Only the red "Logout" button on the right still logs you out.',
          'Desktop sidebar gained the Status and What\'s New entries the mobile menu already had, so the two layouts now expose the same options.',
        ],
      },
      {
        title: 'Status page',
        items: [
          'The public /status page now opens with an at-a-glance health banner — green "Alle Systeme laufen" when everything is fine, amber/red when the API is slow, a sync is stale, or a service is down. The recent-fixes list is kept below so you can still see what changed this week.',
        ],
      },
      {
        title: 'Changelog',
        items: [
          'Changelog entries are now justified with automatic hyphenation — blocks of German text look much tidier on narrow screens.',
        ],
      },
    ],
  },
  {
    version: '4.0.2',
    date: '2026-04-20',
    sections: [
      {
        title: 'Fixed',
        items: [
          'Follow-up to the 4.0.1 consent fix: audited every other field the frontend reads from member records and closed more silent gaps. The Spielplaner menu now appears for members flagged as Spielplaner (not only for admins). Coaches now see the full roster when assigning scorers or delegating games — previously the list rendered empty because the active-membership flag wasn\'t exposed. Your own profile now correctly shows "Aktiv" / "Passiv" and your Beitragskategorie. Shell-member badges (amber border) now render on team rosters for everyone.',
        ],
      },
    ],
  },
  {
    version: '4.0.1',
    date: '2026-04-20',
    sections: [
      {
        title: 'Fixed',
        items: [
          'Critical fix for the messaging consent modal. Members could tap "Accept" but the dialog kept reappearing after every page reload, effectively blocking them from reaching the rest of the app. The backend was recording the decision correctly — the member record just didn\'t expose the consent fields to the owner, so the frontend never saw that consent had been granted. Now fixed for everyone.',
        ],
      },
    ],
  },
  {
    version: '4.0.0',
    date: '2026-04-20',
    sections: [
      {
        title: 'Added',
        items: [
          'Messaging is now available to everyone in the club. Team chats, direct messages, reactions, edits, polls and reports are no longer behind the test-group allowlist. Staged rollout is over — the platform now doubles as the club\'s primary communication channel.',
        ],
      },
    ],
  },
  {
    version: '3.17.1',
    date: '2026-04-20',
    sections: [
      {
        title: 'Fixed',
        items: [
          'The "Coach da" indicator now appears on game and training cards and on the homepage appointment rows when a player-coach has confirmed — not only when someone explicitly responded as staff. Detail modals already worked; the list views have been brought in line.',
        ],
      },
    ],
  },
  {
    version: '3.17.0',
    date: '2026-04-20',
    sections: [
      {
        title: 'Added',
        items: [
          'Trainings are now automatically cancelled when a hall closure covers their date. Delete or shorten the closure and the trainings are restored — unless a coach manually re-cancelled them in the meantime, in which case the manual decision is preserved.',
          'Hallenplan now deduplicates overlapping closures: Sportferien beats "Halle geschlossen", and a Ferien closure hides any lower-priority closure covering the same date. No more doubled-up labels.',
          'New events now auto-decline for members already on absence (previously only trainings and games did this at create time; events waited for the nightly sweep).',
          'When a training, game, or event is rescheduled, participation is re-evaluated against existing absences: stale auto-declines for the old date are reversed, and new ones for the new date are added if the member is still absent.',
          'Deleting or shortening an absence now reverses the auto-declined participations it had created. Manual overrides (members who changed their own answer) are kept untouched.',
        ],
      },
      {
        title: 'Technical',
        items: [
          'Migration 028 adds two marker columns: `participations.auto_declined_by` (→ absences.id) and `trainings.auto_cancelled_by_closure` (→ hall_closures.id). BEFORE UPDATE triggers auto-clear the markers on manual edits so reversals never touch user-owned rows.',
        ],
      },
    ],
  },
  {
    version: '3.16.7',
    date: '2026-04-20',
    sections: [
      {
        title: 'Fixed',
        items: [
          'Response-time on the participation roster now shows for confirmed and maybe responses too, not just declined. Previously it only appeared when someone had changed their answer at least once.',
        ],
      },
    ],
  },
  {
    version: '3.16.6',
    date: '2026-04-20',
    sections: [
      {
        title: 'Security',
        items: [
          'Coaches can now only modify data belonging to the teams they coach. Previously a coach could edit or delete trainings, games, events, hall slot claims, task templates, referee expenses and scorer delegations for any team in the club.',
          'Sport Admins can no longer delete member accounts or teams. They can still edit and create (intake workflows are preserved); only full KSC Wiedikon admins can delete.',
          'Tightened the Content-Security-Policy: removed wildcard Sentry subdomains from the allowlist since error reports go through our own tunnel worker. No user-facing change; reduces the blast radius of a hypothetical Sentry subdomain compromise.',
        ],
      },
    ],
  },
  {
    version: '3.16.5',
    date: '2026-04-20',
    sections: [
      {
        title: 'Security',
        items: [
          'Messages, conversations, and reports are now strictly scoped: only the people involved can read them. Previously, any logged-in member could call the raw data API and read every message and report in the system. Fixed server-side.',
          'Other members\' email and phone are no longer exposed through the raw data API. You still see your own contact details, and the app still fetches what it needs through the proper endpoints.',
          'Rate-limited message reports (max 5 per hour per member) to prevent spam flooding the moderation inbox.',
          'Deleted messages now clear their body on the server — not just hide it — so the content can\'t be retrieved through other data-API paths.',
          'Broadcast sends now have a per-sender global cap (max 10 broadcasts per sender per hour) on top of the existing per-activity limit.',
          'Anonymous feedback can no longer pre-set the "status" field when submitting (prevented suppression of complaints).',
          'Updated Vite and DOMPurify to patched versions (CVE fixes).',
        ],
      },
    ],
  },
  {
    version: '3.16.4',
    date: '2026-04-20',
    sections: [
      {
        title: 'Languages',
        items: [
          'Dates, times, birthdates and member-row timestamps now all follow your selected app language instead of always being German/Swiss. Profile, team rosters, public status page, admin audit log, data-health + infra-health dashboards, explore page, results table and Hallenplan month abbreviations are all localized.',
          'Volley-feedback admin dashboard was bilingual only (de / en). It is now fully translated into de, en, fr, it, and gsw.',
          'Cancel / Save / Delete / Create buttons and confirm dialogs across club news editor, delete-account, group chat menu, new-message dialog, block-member dialog and Spielsamstag editor no longer fall back to German labels for non-German users.',
          'Roster and scorer-assignment sorting now uses your language\'s alphabet rules (e.g. ö / è / ä sort correctly) instead of always German.',
        ],
      },
    ],
  },
  {
    version: '3.16.3',
    date: '2026-04-20',
    sections: [
      {
        title: 'Fix',
        items: [
          'Your own Yes / Maybe / No on the trainings and games lists is highlighted again. The buttons used to render in the default grey state and the colored left banner was missing, even when you had already responded.',
          'The "Show response time" toggle in team settings now actually shows when each member responded in the participation roster.',
        ],
      },
    ],
  },
  {
    version: '3.16.2',
    date: '2026-04-20',
    sections: [
      {
        title: 'Fix',
        items: [
          'Weekday abbreviations in the upcoming appointments list (Mo / Di / Mi …) now follow your selected app language instead of being locked to German. English, French, and Italian users will see the right abbreviations.',
        ],
      },
    ],
  },
  {
    version: '3.16.1',
    date: '2026-04-20',
    sections: [
      {
        title: 'Fix',
        items: [
          'Opening a chat no longer loads in stages — the header (peer name + avatar), the thread, and the composer now all appear together after a single spinner, instead of the header filling in after the messages.',
          'Admin notifications for new reports ("New report: spam", etc.) now open the admin report page when tapped. Previously they navigated to the home screen because the notification type was not routed.',
        ],
      },
    ],
  },
  {
    version: '3.16.0',
    date: '2026-04-20',
    sections: [
      {
        title: 'Chat',
        items: [
          'The other person\'s messages now appear on the right. Your own messages stay on the left.',
          'Tap the "edited" tag on any edited message to see the original version. Your message can still be edited any time.',
        ],
      },
      {
        title: 'Fix',
        items: [
          'Reaction button (SmilePlus) and message actions menu (⋮) are now visible on mobile — previously hover-only, so touch devices could not reach them.',
          'Editing a message now updates immediately instead of appearing to do nothing. Errors during save are now shown under the textarea instead of being swallowed.',
          'Own vs other-user detection now coerces IDs, so your messages are correctly distinguished even when the backend returns numeric IDs.',
        ],
      },
    ],
  },
  {
    version: '3.15.9',
    date: '2026-04-20',
    sections: [
      {
        title: 'Fix',
        items: [
          '2. Liga rankings now show the 2nd place with the blue barrage-up marker, completing the SVRZ regulation alignment started in 3.15.8.',
          'Talents (RTZ) teams no longer hide promotion or relegation markers from eligible teams. Since talents cannot promote or relegate, the green/red/orange/blue markers now fall on the next eligible team — e.g. if a talents team is in 1st place, the 2nd-placed team gets the green promotion marker instead.',
        ],
      },
    ],
  },
  {
    version: '3.15.8',
    date: '2026-04-20',
    sections: [
      {
        title: 'Fix',
        items: [
          'Rankings side-banner colours now match the SVRZ regulation. Every regional league shows the 2nd place (barrage up) in blue and the 2nd-to-last (barrage down) in orange — previously these were missing in 3. Liga and 4. Liga, so barrage teams looked safe.',
          'Men\'s 4. Liga is the bottom men\'s league and no longer shows a relegation marker on the last place (there is no 5. Liga for Herren).',
        ],
      },
    ],
  },
  {
    version: '3.15.7',
    date: '2026-04-20',
    sections: [
      {
        title: 'Fix',
        items: [
          'Inbox: switching between conversations no longer briefly shows the previous conversation\'s messages, and messages that arrive in the moment the thread opens are no longer dropped when the initial load finishes.',
          'Inbox list and member list behave the same way — the result of a stale fetch can no longer overwrite a newer one.',
          'Sentry error tunnel now reports a specific reason when it rejects an event (gzip decode, empty body, missing DSN, …) instead of a generic 400, so future tunnel regressions are diagnosable.',
        ],
      },
    ],
  },
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
                      <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500 dark:bg-gold-400" />
                        <span className="text-justify hyphens-auto">{item}</span>
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
