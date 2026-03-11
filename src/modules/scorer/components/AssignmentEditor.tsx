import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Member, Team, LicenceType } from '../../../types'
import { Select } from '../../../components/ui/Input'
import { Phone, Mail, Hand } from 'lucide-react'
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
}: AssignmentEditorProps) {
  const { t } = useTranslation('scorer')

  const filteredMembers = useMemo(() => {
    let list = members.filter((m) => m.active && !m.is_guest)
    if (requiredLicence) {
      const licences = Array.isArray(requiredLicence) ? requiredLicence : [requiredLicence]
      list = list.filter((m) => licences.some((l) => m.licences?.includes(l)))
    }
    // Filter by selected team
    if (teamValue) {
      const teamMembers = teamMemberIds.get(teamValue)
      if (teamMembers) {
        list = list.filter((m) => teamMembers.has(m.id))
      }
    }
    return list.sort((a, b) =>
      `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, 'de'),
    )
  }, [members, requiredLicence, teamValue, teamMemberIds])

  const assignedPerson = useMemo(() => {
    if (!personValue) return null
    return members.find((m) => m.id === personValue) ?? null
  }, [members, personValue])

  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">{label}</span>
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
