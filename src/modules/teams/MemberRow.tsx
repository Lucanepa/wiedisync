import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import pb from '../../pb'
import { logActivity } from '../../utils/logActivity'
import { coercePositions, getPositionI18nKey, getSelectablePositions } from '../../utils/memberPositions'
import StatusBadge from '../../components/StatusBadge'
import { getFileUrl } from '../../utils/pbFile'
import ImageLightbox from '../../components/ImageLightbox'
import type { ExpandedMemberTeam } from '../../hooks/useTeamMembers'
import type { Team } from '../../types'

interface MemberRowProps {
  memberTeam: ExpandedMemberTeam
  teamId: string
  teamSlug: string
  team?: Team | null
  canEdit?: boolean
  isAdmin?: boolean
  showContact?: boolean
  onTeamUpdate?: (updated: Partial<Team>) => void
}

export const roleColors: Record<string, { bg: string; text: string }> = {
  captain: { bg: '#fef3c7', text: '#92400e' },
  coach: { bg: '#dbeafe', text: '#1e40af' },
  team_responsible: { bg: '#ede9fe', text: '#5b21b6' },
}

type LeadershipRole = 'coach' | 'captain' | 'team_responsible'
const LEADERSHIP_ROLES: LeadershipRole[] = ['coach', 'captain', 'team_responsible']
const roleI18nKeys: Record<LeadershipRole, string> = {
  coach: 'roleCoach',
  captain: 'roleCaptain',
  team_responsible: 'roleTeamResponsible',
}

export function getMemberRole(memberId: string, team?: Team | null): string | null {
  if (!team) return null
  if (team.coach?.includes(memberId)) return 'coach'
  if (team.captain?.includes(memberId)) return 'captain'
  if (team.team_responsible?.includes(memberId)) return 'team_responsible'
  return null
}

export default function MemberRow({ memberTeam, teamId: _teamId, teamSlug, team, canEdit, isAdmin, showContact = true, onTeamUpdate }: MemberRowProps) {
  const { t } = useTranslation('teams')
  const member = memberTeam.expand?.member
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [lightboxOpen, setLightboxOpen] = useState(false)

  if (!member) return null

  const displayName = [member.last_name, member.first_name].filter(Boolean).join(' ') || member.name || '—'
  const memberPositions = coercePositions(member.position)
  const selectablePositions = getSelectablePositions(team?.sport, memberPositions)
  const initials = `${member.first_name?.[0] ?? ''}${member.last_name?.[0] ?? ''}`.toUpperCase()
  const role = getMemberRole(member.id, team)

  const birthdate = member.birthdate
    ? new Date(member.birthdate).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null

  async function saveField(field: string, value: string | number | string[]) {
    try {
      await pb.collection('members').update(member!.id, { [field]: value })
      logActivity('update', 'members', member!.id, { [field]: value })
      // Update the local expand to reflect change immediately
      if (memberTeam.expand?.member) {
        ;(memberTeam.expand.member as Record<string, unknown>)[field] = value
      }
    } catch {
      // ignore
    }
    setEditingField(null)
  }

  async function toggleRole(roleKey: LeadershipRole) {
    if (!team || !onTeamUpdate) return
    const current: string[] = team[roleKey] ?? []
    const next = current.includes(member!.id)
      ? current.filter((id) => id !== member!.id)
      : [...current, member!.id]
    try {
      await pb.collection('teams').update(team.id, { [roleKey]: next })
      logActivity('update', 'teams', team.id, { [roleKey]: next })
      onTeamUpdate({ [roleKey]: next })
    } catch {
      // ignore
    }
  }

  function startEdit(field: string, currentValue: string | number) {
    setEditingField(field)
    setEditValue(String(currentValue ?? ''))
  }

  function getPositionLabelList(positions: string[]) {
    if (positions.length === 0) return '—'
    return positions
      .map((p) => (getPositionI18nKey(p) ? t(getPositionI18nKey(p)!) : p))
      .join(', ')
  }

  function handleKeyDown(e: React.KeyboardEvent, field: string) {
    if (e.key === 'Enter') {
      const val = field === 'number' ? (editValue ? parseInt(editValue, 10) : 0) : editValue
      saveField(field, val)
    } else if (e.key === 'Escape') {
      setEditingField(null)
    }
  }

  return (
    <tr className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {member.photo ? (
            <>
              <img
                src={getFileUrl('members', member.id, member.photo)}
                alt={displayName}
                className="h-8 w-8 cursor-pointer rounded-full object-cover"
                onClick={() => setLightboxOpen(true)}
              />
              <ImageLightbox
                src={getFileUrl('members', member.id, member.photo)}
                alt={displayName}
                open={lightboxOpen}
                onClose={() => setLightboxOpen(false)}
              />
            </>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600 dark:text-gray-400">
              {initials}
            </div>
          )}
          <Link
            to={`/teams/player/${member.id}?from=${teamSlug}`}
            className="text-sm font-medium text-gray-900 hover:text-brand-600 dark:text-gray-100"
          >
            {displayName}
          </Link>
          {member.is_guest && (
            <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              {t('guestBadge')}
            </span>
          )}
        </div>
      </td>

      {/* Number — editable by coach */}
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
        {canEdit && editingField === 'number' ? (
          <input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, 'number')}
            onBlur={() => saveField('number', editValue ? parseInt(editValue, 10) : 0)}
            className="w-14 rounded border px-1.5 py-0.5 text-sm dark:bg-gray-700 dark:border-gray-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            autoFocus
          />
        ) : (
          <span
            className={canEdit ? 'cursor-pointer hover:text-brand-600' : ''}
            onClick={canEdit ? () => startEdit('number', member.number) : undefined}
          >
            {member.number || '—'}
          </span>
        )}
      </td>

      {/* Position — editable by coach */}
      <td className="hidden px-4 py-3 text-sm text-gray-500 sm:table-cell dark:text-gray-400">
        {canEdit && editingField === 'position' ? (
          <select
            value={memberPositions}
            multiple
            size={Math.min(4, selectablePositions.length)}
            onChange={(e) => {
              const next = Array.from(e.target.selectedOptions).map((opt) => opt.value)
              saveField('position', next.length > 0 ? next : ['other'])
            }}
            onBlur={() => setEditingField(null)}
            className="min-h-[88px] rounded border px-1.5 py-0.5 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            autoFocus
          >
            {selectablePositions.map((p) => (
              <option key={p} value={p}>{getPositionI18nKey(p) ? t(getPositionI18nKey(p)!) : p}</option>
            ))}
          </select>
        ) : (
          <span
            className={canEdit ? 'cursor-pointer hover:text-brand-600' : ''}
            onClick={canEdit ? () => setEditingField('position') : undefined}
          >
            {getPositionLabelList(memberPositions)}
          </span>
        )}
      </td>

      {showContact && (
        <td className="hidden px-4 py-3 text-sm text-gray-500 md:table-cell dark:text-gray-400">
          {member.email || '—'}
        </td>
      )}
      {showContact && (
        <td className="hidden px-4 py-3 text-sm text-gray-500 md:table-cell dark:text-gray-400">
          {member.phone || '—'}
        </td>
      )}
      {showContact && (
        <td className="hidden px-4 py-3 text-sm text-gray-500 lg:table-cell dark:text-gray-400">
          {birthdate || '—'}
        </td>
      )}

      {/* Role — editable by admin only */}
      <td className="px-4 py-3">
        {isAdmin ? (
          <div className="relative">
            <button
              onClick={() => setEditingField(editingField === 'role' ? null : 'role')}
              className="flex items-center gap-1 text-xs"
            >
              {role ? (
                <StatusBadge status={role} colorMap={roleColors} />
              ) : (
                <span className="text-gray-400 hover:text-brand-600">+</span>
              )}
            </button>
            {editingField === 'role' && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setEditingField(null)} />
                <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
                  {LEADERSHIP_ROLES.map((r) => {
                    const active = (team?.[r] ?? []).includes(member.id)
                    return (
                      <button
                        key={r}
                        onClick={() => toggleRole(r)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <span className={`flex h-4 w-4 items-center justify-center rounded border ${active ? 'border-brand-500 bg-brand-500 text-white' : 'border-gray-300 dark:border-gray-500'}`}>
                          {active && (
                            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
                              <path d="M10 3L4.5 8.5 2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        {t(roleI18nKeys[r])}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        ) : (
          role ? <StatusBadge status={role} colorMap={roleColors} /> : null
        )}
      </td>
    </tr>
  )
}
