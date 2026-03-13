import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PartyPopper } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { usePB } from '../../hooks/usePB'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/StatusBadge'
import TeamChip from '../../components/TeamChip'
import ParticipationButton from '../../components/ParticipationButton'
import VolleyballIcon from '../../components/VolleyballIcon'
import { getFileUrl } from '../../utils/pbFile'
import { coercePositions, getPositionI18nKey } from '../../utils/memberPositions'
import { formatDate, toISODate } from '../../utils/dateHelpers'
import ProfileEditModal from './ProfileEditModal'
import DeleteAccountModal from './DeleteAccountModal'
import type { MemberTeam, Team, Absence, Training, Game, Event, LicenceType } from '../../types'

const LICENCE_LABELS: Record<LicenceType, string> = {
  scorer_vb: 'licenceScorer',
  referee_vb: 'licenceReferee',
  otr1_bb: 'licenceOTR1',
  otr2_bb: 'licenceOTR2',
  otn_bb: 'licenceOTN',
  referee_bb: 'licenceRefereeBB',
}

type ExpandedMemberTeam = MemberTeam & { expand?: { team?: Team } }
type ExpandedTraining = Training & { expand?: { team?: Team } }
type ExpandedGame = Game & { expand?: { kscw_team?: Team } }

export default function ProfilePage() {
  const { user } = useAuth()
  const { t } = useTranslation('auth')
  const { t: tt } = useTranslation('teams')
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: memberTeams } = usePB<ExpandedMemberTeam>('member_teams', {
    filter: user ? `member="${user.id}"` : '',
    expand: 'team',
    perPage: 20,
  })

  const teamIds = memberTeams.map((mt) => mt.team)
  const today = toISODate(new Date())
  const fourWeeks = toISODate(new Date(Date.now() + 28 * 24 * 60 * 60 * 1000))

  const teamFilter = teamIds.length > 0
    ? teamIds.map((id) => `team="${id}"`).join(' || ')
    : 'team=""'

  const kscwTeamFilter = teamIds.length > 0
    ? teamIds.map((id) => `kscw_team="${id}"`).join(' || ')
    : 'kscw_team=""'

  const { data: upcomingTrainings } = usePB<ExpandedTraining>('trainings', {
    filter: `(${teamFilter}) && date>="${today}" && date<="${fourWeeks}" && cancelled=false`,
    sort: 'date,start_time',
    expand: 'team',
    perPage: 10,
  })

  const { data: upcomingGames } = usePB<ExpandedGame>('games', {
    filter: `(${kscwTeamFilter}) && date>="${today}" && date<="${fourWeeks}"`,
    sort: 'date,time',
    expand: 'kscw_team',
    perPage: 10,
  })

  const { data: upcomingEvents } = usePB<Event>('events', {
    filter: `start_date>="${today}" && start_date<="${fourWeeks}"`,
    sort: 'start_date',
    perPage: 10,
  })

  const { data: activeAbsences } = usePB<Absence>('absences', {
    filter: user ? `member="${user.id}" && end_date>="${today}"` : '',
    sort: 'start_date',
    perPage: 20,
  })

  if (!user) return <Navigate to="/login" replace />

  const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()
  const positions = coercePositions(user.position)

  return (
    <div>
      {/* Header card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        {/* Top: avatar + name + edit */}
        <div className="flex items-center gap-4">
          {user.photo ? (
            <img
              src={getFileUrl('members', user.id, user.photo)}
              alt={user.name}
              className="h-16 w-16 rounded-full object-cover ring-2 ring-brand-500/20 dark:ring-brand-400/30"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-lg font-bold text-brand-600 ring-2 ring-brand-500/20 dark:bg-brand-900/30 dark:text-brand-400 dark:ring-brand-400/30">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-gray-900 dark:text-gray-100">{user.name || `${user.first_name} ${user.last_name}`.trim() || '—'}</h1>
            {(user.number > 0 || positions.length > 0) && (
              <div className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {user.number > 0 && (
                  <p className="font-semibold text-gray-700 dark:text-gray-300">#{user.number}</p>
                )}
                {positions.length > 0 && (
                  <p>{positions.map((p) => (getPositionI18nKey(p) ? tt(getPositionI18nKey(p)!) : p)).join(', ')}</p>
                )}
              </div>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="shrink-0"
          >
            {t('editProfile')}
          </Button>
        </div>

        {/* Teams & Roles */}
        {(memberTeams.length > 0 || user.role.length > 0) && (
          <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700">
            {memberTeams.length > 0 && (
              <div className="flex flex-col">
                {memberTeams.map((mt, i) => {
                  const team = mt.expand?.team
                  const teamRoles: string[] = [tt('rolePlayer')]
                  if (team) {
                    if (team.coach?.includes(user.id)) teamRoles.push(tt('roleCoach'))
                    if (team.captain?.includes(user.id)) teamRoles.push(tt('roleCaptain'))
                    if (team.team_responsible?.includes(user.id)) teamRoles.push(tt('roleTeamResponsible'))
                  }
                  const isLast = i === memberTeams.length - 1
                  return (
                    <div key={mt.id} className="flex items-stretch">
                      {/* Vertical connector line */}
                      <div className="flex w-5 flex-col items-center">
                        <div className={`w-px flex-1 ${i === 0 ? 'bg-transparent' : 'bg-gray-300 dark:bg-gray-600'}`} />
                        <div className="h-2 w-2 shrink-0 rounded-full bg-gray-300 dark:bg-gray-500" />
                        <div className={`w-px flex-1 ${isLast ? 'bg-transparent' : 'bg-gray-300 dark:bg-gray-600'}`} />
                      </div>
                      {/* Horizontal connector + content */}
                      <div className="flex items-center gap-2.5 py-1.5">
                        <div className="w-4 border-t border-gray-300 dark:border-gray-600" />
                        <Link to={`/teams/${team?.name ?? mt.team}`} className="flex shrink-0">
                          <TeamChip team={team?.name ?? '?'} size="sm" />
                        </Link>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {teamRoles.join(' · ')}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {user.role.length > 0 && (
              <div className={`flex items-center gap-1.5 ${memberTeams.length > 0 ? 'mt-2 border-t border-gray-100 pt-2 dark:border-gray-700' : ''}`}>
                <span className="shrink-0 text-xs leading-none text-gray-500 dark:text-gray-400">{t('roles')}</span>
                {[...user.role].sort((a, b) => {
                  const order = ['user', 'coach', 'team_responsible', 'vb_admin', 'bb_admin', 'vorstand', 'admin', 'superuser', 'superadmin']
                  return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b))
                }).map((r) => <StatusBadge key={r} status={r} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contact Info */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('contact')}</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('contactPrivacyNotice')}</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('email')}</p>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{user.email || '—'}</p>
          </div>
          <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('phone')}</p>
              {user.hide_phone && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{t('hidden')}</span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{user.phone || '—'}</p>
          </div>
          <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('birthdate')}</p>
              {user.birthdate_visibility === 'hidden' && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{t('hidden')}</span>
              )}
              {user.birthdate_visibility === 'year_only' && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{t('yearOnly')}</span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
              {user.birthdate ? new Date(user.birthdate).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
            </p>
          </div>
          <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('licenseNr')}</p>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{user.license_nr || '—'}</p>
          </div>
          <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('licences')}</p>
            {user.licences?.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {user.licences.map((l) => (
                  <span key={l} className="inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                    {tt(LICENCE_LABELS[l])}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">—</p>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Activities */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('upcomingActivities')}</h2>
        <div className="mt-3 space-y-2">
          {upcomingTrainings.map((tr) => (
            <div key={tr.id} className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
              <svg className="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M16.05 10.966a5 2.5 0 0 1-8.1 0" />
                <path d="m16.923 14.049 4.48 2.04a1 1 0 0 1 .001 1.831l-8.574 3.9a2 2 0 0 1-1.66 0l-8.574-3.91a1 1 0 0 1 0-1.83l4.484-2.04" />
                <path d="M16.949 14.14a5 2.5 0 1 1-9.9 0L10.063 3.5a2 2 0 0 1 3.874 0z" />
                <path d="M9.194 6.57a5 2.5 0 0 0 5.61 0" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t('training')} {tr.expand?.team?.name ?? ''}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(tr.date)} · {tr.start_time}–{tr.end_time}
                </p>
              </div>
              <ParticipationButton
                activityType="training"
                activityId={tr.id}
                activityDate={tr.date}
                compact
              />
            </div>
          ))}
          {upcomingGames.map((g) => (
            <div key={g.id} className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
              <VolleyballIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {g.home_team} vs {g.away_team}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(g.date)} · {g.time}
                </p>
              </div>
              <ParticipationButton
                activityType="game"
                activityId={g.id}
                activityDate={g.date}
                compact
              />
            </div>
          ))}
          {upcomingEvents.map((ev) => (
            <div key={ev.id} className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
              <PartyPopper className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{ev.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(ev.start_date)}
                  {ev.start_date !== ev.end_date && ` — ${formatDate(ev.end_date)}`}
                </p>
              </div>
              <ParticipationButton
                activityType="event"
                activityId={ev.id}
                activityDate={ev.start_date}
                compact
              />
            </div>
          ))}
          {upcomingTrainings.length === 0 && upcomingGames.length === 0 && upcomingEvents.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('noUpcomingActivities')}</p>
          )}
        </div>
      </div>

      {/* Active Absences */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('activeAbsences')}</h2>
          <Link
            to="/absences"
            className="text-sm text-brand-600 hover:text-brand-800 dark:text-gold-400 dark:hover:text-gold-300"
          >
            {t('showAll')}
          </Link>
        </div>
        {activeAbsences.length > 0 ? (
          <div className="mt-3 space-y-2">
            {activeAbsences.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
                <StatusBadge status={a.reason} />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {formatDate(a.start_date)}
                  {a.start_date !== a.end_date && ` — ${formatDate(a.end_date)}`}
                </span>
                {a.reason_detail && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">{a.reason_detail}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{t('noActiveAbsences')}</p>
        )}
      </div>

      {/* Danger Zone */}
      <div className="mt-8 rounded-2xl border border-red-200 bg-red-50/30 p-5 dark:border-red-900/40 dark:bg-red-950/10">
        <h2 className="text-base font-semibold text-red-600 dark:text-red-400">{t('dangerZone')}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('deleteAccountDescription')}</p>
        <div className="mt-4">
          <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
            {t('deleteAccount')}
          </Button>
        </div>
      </div>

      <ProfileEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
      <DeleteAccountModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        userEmail={user.email}
      />
    </div>
  )
}
