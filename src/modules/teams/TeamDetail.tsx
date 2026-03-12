import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, Link } from 'react-router-dom'
import { Move, Check, X as XIcon } from 'lucide-react'
import pb from '../../pb'
import { logActivity } from '../../utils/logActivity'
import { useTeamMembers } from '../../hooks/useTeamMembers'
import { useAuth } from '../../hooks/useAuth'
import { useAdminMode } from '../../hooks/useAdminMode'
import { usePendingMembers } from '../../hooks/usePendingMembers'
import Button from '../../components/ui/Button'
import TeamChip from '../../components/TeamChip'
import EmptyState from '../../components/EmptyState'
import { sanitizeUrl } from '../../utils/sanitizeUrl'
import VolleyballIcon from '../../components/VolleyballIcon'
import BasketballIcon from '../../components/BasketballIcon'
import MemberRow, { getMemberRole } from './MemberRow'
import { getFileUrl } from '../../utils/pbFile'
import { coercePositions } from '../../utils/memberPositions'
import { getCurrentSeason } from '../../utils/dateHelpers'
import ImageLightbox from '../../components/ImageLightbox'
import type { Team, Member } from '../../types'

type SortKey = 'name' | 'number' | 'position' | 'email' | 'phone' | 'birthdate' | 'role'
type SortDir = 'asc' | 'desc'

export default function TeamDetail() {
  const { t } = useTranslation('teams')
  const { teamSlug } = useParams<{ teamSlug: string }>()
  const { isCoachOf, hasAdminAccessToTeam, canViewTeam } = useAuth()
  const { effectiveIsAdmin } = useAdminMode()
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const teamId = team?.id
  const { members, isLoading: membersLoading } = useTeamMembers(teamId)
  const canManage = isCoachOf(teamId ?? '') || (effectiveIsAdmin && hasAdminAccessToTeam(teamId ?? ''))
  const { data: pendingMembers, refetch: refetchPending } = usePendingMembers(canManage ? teamId : undefined)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [adjustingCrop, setAdjustingCrop] = useState(false)
  const [cropPos, setCropPos] = useState({ x: 50, y: 50 })
  const cropContainerRef = useRef<HTMLDivElement>(null)
  const draggingCrop = useRef(false)

  // Initialize crop position from team data
  useEffect(() => {
    if (team?.team_picture_pos) {
      const [x, y] = team.team_picture_pos.split(' ').map((v) => parseFloat(v))
      if (!isNaN(x) && !isNaN(y)) setCropPos({ x, y })
    }
  }, [team?.team_picture_pos])

  const handleCropPointerDown = useCallback((e: React.PointerEvent) => {
    if (!adjustingCrop) return
    e.preventDefault()
    draggingCrop.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    updateCropFromPointer(e.clientX, e.clientY)
  }, [adjustingCrop])

  const handleCropPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingCrop.current) return
    updateCropFromPointer(e.clientX, e.clientY)
  }, [])

  const handleCropPointerUp = useCallback(() => {
    draggingCrop.current = false
  }, [])

  function updateCropFromPointer(clientX: number, clientY: number) {
    const rect = cropContainerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
    setCropPos({ x: Math.round(x), y: Math.round(y) })
  }

  async function saveCropPosition() {
    if (!team) return
    const pos = `${cropPos.x}% ${cropPos.y}%`
    try {
      await pb.collection('teams').update(team.id, { team_picture_pos: pos })
      logActivity('update', 'teams', team.id, { team_picture_pos: pos })
      setTeam((prev) => prev ? { ...prev, team_picture_pos: pos } : prev)
    } catch { /* ignore */ }
    setAdjustingCrop(false)
  }

  function cancelCropAdjust() {
    if (team?.team_picture_pos) {
      const [x, y] = team.team_picture_pos.split(' ').map((v) => parseFloat(v))
      if (!isNaN(x) && !isNaN(y)) setCropPos({ x, y })
    } else {
      setCropPos({ x: 50, y: 50 })
    }
    setAdjustingCrop(false)
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedMembers = useMemo(() => {
    const sorted = [...members]
    const dir = sortDir === 'asc' ? 1 : -1
    sorted.sort((a, b) => {
      const ma = a.expand?.member
      const mb = b.expand?.member
      if (!ma || !mb) return 0
      let cmp = 0
      switch (sortKey) {
        case 'name':
          cmp = (ma.last_name ?? '').localeCompare(mb.last_name ?? '') || (ma.first_name ?? '').localeCompare(mb.first_name ?? '')
          break
        case 'number':
          cmp = (ma.number || 999) - (mb.number || 999)
          break
        case 'position':
          cmp = coercePositions(ma.position).join(',').localeCompare(coercePositions(mb.position).join(','))
          break
        case 'email':
          cmp = (ma.email ?? '').localeCompare(mb.email ?? '')
          break
        case 'phone':
          cmp = (ma.hide_phone ? '' : ma.phone ?? '').localeCompare(mb.hide_phone ? '' : mb.phone ?? '')
          break
        case 'birthdate':
          cmp = (ma.birthdate_visibility === 'hidden' ? '' : ma.birthdate ?? '').localeCompare(mb.birthdate_visibility === 'hidden' ? '' : mb.birthdate ?? '')
          break
        case 'role': {
          const ra = getMemberRole(ma.id, team) ?? ''
          const rb = getMemberRole(mb.id, team) ?? ''
          cmp = ra.localeCompare(rb)
          break
        }
      }
      return cmp * dir
    })
    return sorted
  }, [members, sortKey, sortDir, team])

  async function handleApprove(member: Member) {
    try {
      await pb.collection('members').update(member.id, { approved: true })
      logActivity('update', 'members', member.id, { approved: true })
      const mt = await pb.collection('member_teams').create({
        member: member.id,
        team: teamId!,
        season: getCurrentSeason(),
      })
      logActivity('create', 'member_teams', mt.id, { member: member.id, team: teamId })
      refetchPending()
    } catch {
      // ignore
    }
  }

  async function handleReject(memberId: string) {
    try {
      await pb.collection('members').delete(memberId)
      logActivity('delete', 'members', memberId)
      refetchPending()
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!teamSlug) return
    setLoading(true)
    pb.collection('teams')
      .getFirstListItem<Team>(`name="${teamSlug}"`)
      .then(setTeam)
      .catch(() => setTeam(null))
      .finally(() => setLoading(false))
  }, [teamSlug])

  if (loading || membersLoading) {
    return <div className="py-12 text-center text-gray-500 dark:text-gray-400">{t('common:loading')}</div>
  }

  if (!team || !canViewTeam(team.id)) {
    return <EmptyState icon="❌" title={t('noTeams')} />
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link to="/teams" className="hover:text-gray-700 dark:text-gray-300">{t('title')}</Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-gray-100">{team.full_name}</span>
      </div>

      {team.team_picture && (
        <>
          <div
            ref={cropContainerRef}
            className="group relative mb-6 overflow-hidden rounded-lg"
            onPointerDown={handleCropPointerDown}
            onPointerMove={handleCropPointerMove}
            onPointerUp={handleCropPointerUp}
            style={{ touchAction: adjustingCrop ? 'none' : 'auto' }}
          >
            <img
              src={getFileUrl('teams', team.id, team.team_picture)}
              alt={team.full_name}
              className={`h-48 w-full object-cover sm:h-64 ${adjustingCrop ? 'cursor-crosshair' : 'cursor-pointer'}`}
              style={{ objectPosition: `${cropPos.x}% ${cropPos.y}%` }}
              onClick={adjustingCrop ? undefined : () => setLightboxOpen(true)}
              draggable={false}
            />
            {adjustingCrop && (
              <div className="absolute inset-0 border-2 border-dashed border-white/60 bg-black/10">
                <div
                  className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand-500 shadow"
                  style={{ left: `${cropPos.x}%`, top: `${cropPos.y}%` }}
                />
              </div>
            )}
            {/* Crop controls for coaches */}
            {canManage && !adjustingCrop && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setAdjustingCrop(true) }}
                className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-lg bg-black/50 px-3 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Move className="h-3.5 w-3.5" />
                {t('adjustCrop')}
              </button>
            )}
            {adjustingCrop && (
              <div
                className="absolute bottom-2 right-2 flex gap-2"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  onClick={saveCropPosition}
                  className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                >
                  <Check className="h-3.5 w-3.5" />
                  {t('common:save')}
                </button>
                <button
                  onClick={cancelCropAdjust}
                  className="flex items-center gap-1 rounded-lg bg-gray-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
                >
                  <XIcon className="h-3.5 w-3.5" />
                  {t('common:cancel')}
                </button>
              </div>
            )}
          </div>
          <ImageLightbox
            src={getFileUrl('teams', team.id, team.team_picture)}
            alt={team.full_name}
            open={lightboxOpen}
            onClose={() => setLightboxOpen(false)}
          />
        </>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <TeamChip team={team.name} />
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-gray-100">{team.full_name}</h1>
            {team.social_url && sanitizeUrl(team.social_url) && (
              <a
                href={sanitizeUrl(team.social_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 transition-colors hover:text-brand-500"
                title="Social"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </a>
            )}
          </div>
          <div className="mt-2 flex gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>{team.league}</span>
            <span>{team.season}</span>
            <span className="inline-flex items-center gap-1">
              {team.sport === 'basketball'
                ? <BasketballIcon className="h-4 w-4" filled />
                : <VolleyballIcon className="h-4 w-4" filled />}
              {team.sport === 'volleyball' ? 'Volleyball' : 'Basketball'}
            </span>
          </div>
        </div>

        {isCoachOf(teamId ?? '') && (
          <Link
            to={`/teams/${teamSlug}/roster/edit`}
            className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            {t('editTeam')}
          </Link>
        )}
      </div>

      {/* Pending member requests */}
      {canManage && pendingMembers.length > 0 && (
        <div className="mt-6 rounded-lg border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-900/20">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {t('pendingRequests', { count: pendingMembers.length })}
          </h3>
          <div className="mt-3 space-y-3">
            {pendingMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-lg bg-white p-3 dark:bg-gray-800">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {member.first_name} {member.last_name}
                  </p>
                  <p className="truncate text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleApprove(member)}
                    className="bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700"
                  >
                    {t('approve')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleReject(member.id)}
                  >
                    {t('reject')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('currentRoster', { count: members.length })}</h2>

        {members.length === 0 ? (
          <EmptyState
            icon="👤"
            title={t('noMembers')}
            description={t('noMembersDescription')}
            action={
              isCoachOf(teamId ?? '') ? (
                <Link
                  to={`/teams/${teamSlug}/roster/edit`}
                  className="text-sm text-brand-600 hover:text-brand-700"
                >
                  {t('addPlayer')}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border bg-white dark:bg-gray-800">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50 dark:bg-gray-900 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <SortHeader label={t('playerCol')} sortKey="name" current={sortKey} dir={sortDir} onClick={handleSort} />
                  <SortHeader label={t('numberCol')} sortKey="number" current={sortKey} dir={sortDir} onClick={handleSort} />
                  <SortHeader label={t('positionCol')} sortKey="position" current={sortKey} dir={sortDir} onClick={handleSort} className="hidden sm:table-cell" />
                  {canManage && <SortHeader label={t('emailCol')} sortKey="email" current={sortKey} dir={sortDir} onClick={handleSort} className="hidden md:table-cell" />}
                  {canManage && <SortHeader label={t('phoneCol')} sortKey="phone" current={sortKey} dir={sortDir} onClick={handleSort} className="hidden md:table-cell" />}
                  {canManage && <SortHeader label={t('birthdateCol')} sortKey="birthdate" current={sortKey} dir={sortDir} onClick={handleSort} className="hidden lg:table-cell" />}
                  <SortHeader label={t('roleCol')} sortKey="role" current={sortKey} dir={sortDir} onClick={handleSort} />
                </tr>
              </thead>
              <tbody>
                {sortedMembers.map((mt) => (
                  <MemberRow
                    key={mt.id}
                    memberTeam={mt}
                    teamId={team.id}
                    teamSlug={team.name}
                    team={team}
                    canEdit={canManage}
                    isAdmin={effectiveIsAdmin && hasAdminAccessToTeam(team.id)}
                    showContact={canManage}
                    onTeamUpdate={(updated) => setTeam((prev) => prev ? { ...prev, ...updated } : prev)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sponsors */}
      {team.sponsors && team.sponsors.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('sponsors')}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-6">
            {team.sponsors.map((name, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                {team.sponsors_logos?.[i] && (
                  <img
                    src={getFileUrl('teams', team.id, team.sponsors_logos[i])}
                    alt={name}
                    className="h-12 w-auto object-contain"
                  />
                )}
                <span className="text-sm text-gray-500 dark:text-gray-400">{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SortHeader({ label, sortKey: key, current, dir, onClick, className = '' }: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onClick: (key: SortKey) => void
  className?: string
}) {
  const active = current === key
  return (
    <th
      className={`px-4 py-3 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 ${className}`}
      onClick={() => onClick(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
            {dir === 'asc'
              ? <path d="M6 3L10 9H2z" />
              : <path d="M6 9L2 3h8z" />}
          </svg>
        )}
      </span>
    </th>
  )
}
