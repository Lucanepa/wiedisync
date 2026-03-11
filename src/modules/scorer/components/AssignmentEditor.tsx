import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Member, Team, LicenceType } from '../../../types'
import { Select } from '../../../components/ui/Input'
import { Phone, Mail, Hand, ArrowRightLeft, Clock } from 'lucide-react'
import TeamSelect from '../../../components/TeamSelect'

interface AssignmentEditorProps {
  label: string
  requiredLicence?: LicenceType | LicenceType[]
  teamValue: string
  personValue: string
  members: Member[]
  teams: Team[]
  teamMemberIds: Map<string, Set<string>>
  onTeamChange: (teamId: string) => void
  onPersonChange: (memberId: string) => void
  disabled: boolean
  showContact?: boolean
  selfAssignButton?: boolean
  onSelfAssign?: () => void
  /** Whether the editor should show admin controls (dropdowns) */
  canEdit: boolean
  /** Whether the current user is the assigned member for this role */
  isCurrentUserAssigned?: boolean
  /** Callback to open delegation modal */
  onDelegate?: () => void
  /** Pending outgoing delegation target name */
  pendingDelegationName?: string
}

export default function AssignmentEditor({
  label,
  requiredLicence,
  teamValue,
  personValue,
  members,
  teams,
  teamMemberIds,
  onTeamChange,
  onPersonChange,
  disabled,
  showContact,
  selfAssignButton,
  onSelfAssign,
  canEdit,
  isCurrentUserAssigned,
  onDelegate,
  pendingDelegationName,
}: AssignmentEditorProps) {
  const { t } = useTranslation('scorer')

  const filteredMembers = useMemo(() => {
    let list = members.filter((m) => m.active && !m.is_guest)
    if (requiredLicence) {
      const licences = Array.isArray(requiredLicence) ? requiredLicence : [requiredLicence]
      list = list.filter((m) => licences.some((l) => m.licences?.includes(l)))
    }
    if (teamValue) {
      const teamMembers = teamMemberIds.get(teamValue)
      if (teamMembers) {
        list = list.filter((m) => teamMembers.has(m.id))
      }
    }
    // Ensure the currently assigned person is always in the list
    if (personValue && !list.some((m) => m.id === personValue)) {
      const assigned = members.find((m) => m.id === personValue)
      if (assigned) list.push(assigned)
    }
    return list.sort((a, b) =>
      `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, 'de'),
    )
  }, [members, requiredLicence, teamValue, teamMemberIds, personValue])

  const assignedPerson = useMemo(() => {
    if (!personValue) return null
    return members.find((m) => m.id === personValue) ?? null
  }, [members, personValue])

  const assignedName = assignedPerson
    ? `${assignedPerson.first_name} ${assignedPerson.last_name}`
    : ''

  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">{label}</span>

      {/* Admin view: full dropdowns */}
      {canEdit ? (
        <>
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
            <TeamSelect
              value={teamValue}
              onChange={(v) => {
                onTeamChange(v)
                if (personValue) onPersonChange('')
              }}
              teams={teams}
              disabled={disabled}
              aria-label={`${label} – ${t('selectTeam')}`}
              placeholder={t('selectTeam')}
            />
            <Select
              value={personValue}
              onChange={(e) => onPersonChange(e.target.value)}
              disabled={disabled}
              aria-label={`${label} – ${t('selectPerson')}`}
            >
              <option value="">{t('selectPerson')}</option>
              {filteredMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name}
                </option>
              ))}
            </Select>
          </div>

          {/* Admin delegate button (when someone is assigned) */}
          {personValue && onDelegate && !disabled && (
            <button
              onClick={onDelegate}
              className="mt-1 flex items-center gap-1.5 rounded-lg px-2 py-3 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              {t('delegate')}
            </button>
          )}
        </>
      ) : (
        /* Regular user view: read-only with action buttons */
        <>
          {personValue ? (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-750">
              <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                {assignedName}
              </span>
              {isCurrentUserAssigned && onDelegate && (
                <button
                  onClick={onDelegate}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-3 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 dark:bg-brand-900/20 dark:text-brand-400 dark:hover:bg-brand-900/40"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  {t('delegate')}
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-400 dark:bg-gray-750 dark:text-gray-500">
              {t('unassigned')}
            </div>
          )}
        </>
      )}

      {/* Pending delegation indicator */}
      {pendingDelegationName && (
        <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          <Clock className="h-3.5 w-3.5" />
          {t('delegatePendingOutgoing', { name: pendingDelegationName })}
        </div>
      )}

      {/* Contact info */}
      {showContact && assignedPerson && (assignedPerson.phone || assignedPerson.email) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-750 dark:text-gray-400">
          {assignedPerson.phone && (
            <a href={`tel:${assignedPerson.phone}`} className="flex items-center gap-1.5 transition-colors hover:text-brand-600 dark:hover:text-brand-400">
              <Phone className="h-3 w-3" />
              {assignedPerson.phone}
            </a>
          )}
          {assignedPerson.email && (
            <a href={`mailto:${assignedPerson.email}`} className="flex items-center gap-1.5 transition-colors hover:text-brand-600 dark:hover:text-brand-400">
              <Mail className="h-3 w-3" />
              {assignedPerson.email}
            </a>
          )}
        </div>
      )}

      {/* Self-assign button for regular users */}
      {selfAssignButton && !personValue && (
        <button
          onClick={onSelfAssign}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-50 px-3 py-2.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 dark:bg-brand-900/20 dark:text-brand-400 dark:hover:bg-brand-900/40"
        >
          <Hand className="h-4 w-4" />
          {t('selfAssign')}
        </button>
      )}
    </div>
  )
}
