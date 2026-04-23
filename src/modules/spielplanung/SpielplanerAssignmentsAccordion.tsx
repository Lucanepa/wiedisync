import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { UserCheck, Trash2, Plus, UsersIcon } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../components/ui/collapsible'
import { Button } from '../../components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { useCollection } from '../../lib/query'
import { useMutation } from '../../hooks/useMutation'
import { useTeams } from '../../hooks/useTeams'
import type { Member, SpielplanerAssignment } from '../../types'
import { asObj } from '../../utils/relations'
import TeamChip from '../../components/TeamChip'

interface AssignmentRow extends Omit<SpielplanerAssignment, 'member' | 'kscw_team'> {
  member: Member | string | number
  kscw_team: { id: number | string; name: string } | string | number
}

export default function SpielplanerAssignmentsAccordion() {
  const { t } = useTranslation('spielplanung')
  const { data: assignments, isLoading } = useCollection<AssignmentRow>('spielplaner_assignments', {
    fields: [
      'id',
      'member.id',
      'member.first_name',
      'member.last_name',
      'member.is_spielplaner',
      'kscw_team.id',
      'kscw_team.name',
    ],
    sort: ['member.last_name', 'member.first_name'],
    all: true,
  })
  const { data: teams } = useTeams('all')
  const { data: members } = useCollection<Member>('members', {
    filter: { kscw_membership_active: { _eq: true } },
    fields: ['id', 'first_name', 'last_name', 'is_spielplaner'],
    sort: ['last_name', 'first_name'],
    all: true,
  })
  const { create, remove } = useMutation('spielplaner_assignments')

  const [memberId, setMemberId] = useState<string>('')
  const [teamId, setTeamId] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Group assignments by member for display
  const grouped = useMemo(() => {
    const map = new Map<string, { member: Member | null; rows: AssignmentRow[] }>()
    for (const row of assignments ?? []) {
      const member = asObj<Member>(row.member)
      const key = String(member?.id ?? row.member ?? 'unknown')
      const existing = map.get(key) ?? { member, rows: [] }
      existing.rows.push(row)
      map.set(key, existing)
    }
    return [...map.values()].sort((a, b) => {
      const an = `${a.member?.last_name ?? ''} ${a.member?.first_name ?? ''}`.trim()
      const bn = `${b.member?.last_name ?? ''} ${b.member?.first_name ?? ''}`.trim()
      return an.localeCompare(bn)
    })
  }, [assignments])

  async function handleAdd() {
    if (!memberId || !teamId) return
    setBusy(true)
    setError(null)
    try {
      await create({ member: parseInt(memberId, 10), kscw_team: parseInt(teamId, 10) })
      setMemberId('')
      setTeamId('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(id: string | number) {
    setBusy(true)
    setError(null)
    try {
      await remove(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Collapsible>
      <CollapsibleTrigger className="group inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
        <UserCheck className="h-4 w-4" aria-hidden />
        {t('assignments.title')}
        <span className="text-xs text-muted-foreground">
          ({assignments?.length ?? 0})
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="mb-3 text-sm text-muted-foreground">{t('assignments.hint')}</p>

          {/* Add form */}
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
                {t('assignments.member')}
              </label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('assignments.memberPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {(members ?? []).map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.last_name}, {m.first_name}
                      {m.is_spielplaner ? ' ★' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
                {t('assignments.team')}
              </label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('assignments.teamPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {(teams ?? []).map((tm) => (
                    <SelectItem key={tm.id} value={String(tm.id)}>
                      {tm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              onClick={handleAdd}
              disabled={!memberId || !teamId || busy}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t('assignments.add')}
            </Button>
          </div>

          {error && (
            <div className="mb-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Grouped list */}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t('assignments.loading')}</p>
          ) : grouped.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              <UsersIcon className="mx-auto mb-2 h-5 w-5" aria-hidden />
              {t('assignments.empty')}
            </p>
          ) : (
            <ul className="space-y-2">
              {grouped.map(({ member, rows }) => (
                <li
                  key={String(member?.id ?? 'unknown')}
                  className="rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                    <span>
                      {member?.last_name ?? '?'}, {member?.first_name ?? '?'}
                    </span>
                    {member?.is_spielplaner && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        {t('assignments.clubWide')}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {rows.map((row) => {
                      const team = asObj<{ id: number | string; name: string }>(row.kscw_team)
                      return (
                        <span
                          key={String(row.id)}
                          className="inline-flex items-center gap-1 rounded-full bg-white pl-1 pr-0.5 shadow-sm dark:bg-gray-800"
                        >
                          <TeamChip team={team?.name ?? '?'} size="xs" />
                          <button
                            type="button"
                            onClick={() => handleRemove(String(row.id))}
                            disabled={busy}
                            aria-label={t('assignments.remove')}
                            className="ml-0.5 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950"
                          >
                            <Trash2 className="h-3 w-3" aria-hidden />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
