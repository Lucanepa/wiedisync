import { useState, useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, X, Clock } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useCollection } from '../../lib/query'
import { Button } from '@/components/ui/button'
import StatusBadge from '../../components/StatusBadge'
import TeamChip from '../../components/TeamChip'
import { getFileUrl } from '../../utils/fileUrl'
import { coercePositions, getPositionI18nKey } from '../../utils/memberPositions'
import { formatDate, toISODate } from '../../utils/dateHelpers'
import ProfileEditModal from './ProfileEditModal'
import DeleteAccountModal from './DeleteAccountModal'
import TeamRequestModal from './TeamRequestModal'
import type { MemberTeam, Team, Absence, LicenceType } from '../../types'
import { updateRecord } from '../../lib/api'
import { asObj } from '../../utils/relations'

const LICENCE_LABELS: Record<LicenceType, string> = {
  scorer_vb: 'licenceScorer',
  referee_vb: 'licenceReferee',
  otr1_bb: 'licenceOTR1',
  otr2_bb: 'licenceOTR2',
  otn_bb: 'licenceOTN',
  referee_bb: 'licenceRefereeBB',
}

type ExpandedMemberTeam = MemberTeam & { team: Team | string }

export default function ProfilePage() {
  const { user } = useAuth()
  const { t } = useTranslation('auth')
  const { t: tt } = useTranslation('teams')
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [teamRequestOpen, setTeamRequestOpen] = useState(false)

  const { data: memberTeamsRaw } = useCollection<ExpandedMemberTeam>('member_teams', {
    filter: user ? { member: { _eq: user.id } } : undefined,
    fields: ['*', 'team.*'],
    limit: 20,
    enabled: !!user,
  })
  const memberTeams = memberTeamsRaw ?? []

  // Pending team requests
  interface TeamRequest { id: string; member: string; team: Team | string; status: string }
  const { data: pendingRequestsRaw, refetch: refetchRequests } = useCollection<TeamRequest>('team_requests', {
    filter: user ? { _and: [{ member: { _eq: user.id } }, { status: { _eq: 'pending' } }] } : undefined,
    fields: ['*', 'team.*'],
    limit: 20,
    enabled: !!user,
  })
  const pendingRequests = pendingRequestsRaw ?? []

  const currentTeamIds = useMemo(
    () => memberTeams.map((mt) => asObj<Team>(mt.team)?.id ?? (mt.team as string)),
    [memberTeams],
  )

  async function handleCancelRequest(requestId: string) {
    try {
      await updateRecord('team_requests', requestId, { status: 'cancelled' })
      refetchRequests()
    } catch {
      // ignore
    }
  }

  const today = toISODate(new Date())

  const { data: activeAbsencesRaw } = useCollection<Absence>('absences', {
    filter: user ? { _and: [{ member: { _eq: user.id } }, { end_date: { _gte: today } }] } : undefined,
    sort: ['start_date'],
    limit: 20,
    enabled: !!user,
  })
  const activeAbsences = activeAbsencesRaw ?? []

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
            variant="outline"
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
                  const team = asObj<Team>(mt.team)
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

            {/* Pending team requests */}
            {pendingRequests.length > 0 && (
              <div className="mt-1 space-y-1">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="flex items-center gap-2.5 py-1.5 pl-5">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    <TeamChip team={asObj<Team>(req.team)?.name ?? '?'} size="sm" />
                    <span className="text-xs text-amber-600 dark:text-amber-400">{t('pendingApproval')}</span>
                    <button
                      onClick={() => handleCancelRequest(req.id)}
                      className="ml-auto rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-700 dark:hover:text-red-400"
                      title={t('common:cancel')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Team button */}
            <button
              onClick={() => setTeamRequestOpen(true)}
              className="mt-1 flex items-center gap-1.5 py-1.5 pl-5 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('addTeam')}
            </button>

            {user.role.length > 0 && (
              <div className={`flex flex-wrap items-center gap-1.5 ${memberTeams.length > 0 ? 'mt-2 border-t border-gray-100 pt-2 dark:border-gray-700' : ''}`}>
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
                  <span key={l} className="inline-flex rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-medium text-gold-900 dark:bg-gold-400/20 dark:text-gold-300">
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
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            {t('deleteAccount')}
          </Button>
        </div>
      </div>

      <ProfileEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
      <TeamRequestModal
        open={teamRequestOpen}
        onClose={() => setTeamRequestOpen(false)}
        onComplete={() => {
          setTeamRequestOpen(false)
          refetchRequests()
        }}
        currentTeamIds={currentTeamIds}
      />
      <DeleteAccountModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        userEmail={user.email}
      />
    </div>
  )
}
