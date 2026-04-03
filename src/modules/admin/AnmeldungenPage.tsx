import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X, ChevronDown, ChevronUp, Save } from 'lucide-react'
import { useCollection, useUpdate } from '../../lib/query'
import { useAuth } from '../../hooks/useAuth'
import TeamChip from '../../components/TeamChip'
import { formatDate } from '../../utils/dateHelpers'
import { toast } from 'sonner'
import type { BaseRecord, Team } from '../../types'

interface Registration extends BaseRecord {
  status: 'pending' | 'approved' | 'rejected'
  membership_type: 'volleyball' | 'basketball' | 'passive'
  vorname: string
  nachname: string
  email: string
  telefon_mobil: string | null
  adresse: string | null
  plz: string | null
  ort: string | null
  geburtsdatum: string | null
  nationalitaet: string | null
  geschlecht: string | null
  team: string | null
  beitragskategorie: string | null
  bemerkungen: string | null
  reference_number: string
  submitted_at: string
  rolle: string | null
  lizenz: string | null
  schiedsrichter_stufe: string | null
  ahv_nummer: string | null
  kantonsschule: string | null
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'
type SportFilter = 'all' | 'volleyball' | 'basketball' | 'passive'

export default function AnmeldungenPage() {
  const { t } = useTranslation('admin')
  const { isGlobalAdmin, isVbAdmin, isBbAdmin } = useAuth()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [sportFilter, setSportFilter] = useState<SportFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Determine which sports this admin can see
  const allowedSports = useMemo(() => {
    if (isGlobalAdmin) return ['volleyball', 'basketball', 'passive']
    const sports: string[] = []
    if (isVbAdmin) sports.push('volleyball')
    if (isBbAdmin) sports.push('basketball')
    return sports
  }, [isGlobalAdmin, isVbAdmin, isBbAdmin])

  // Build filter based on role + UI filters
  const filter = useMemo((): Record<string, unknown> => {
    const conditions: Record<string, unknown>[] = []

    // Status filter
    if (statusFilter !== 'all') {
      conditions.push({ status: { _eq: statusFilter } })
    }

    // Sport filter (from UI or role-based)
    if (sportFilter !== 'all') {
      conditions.push({ membership_type: { _eq: sportFilter } })
    } else if (!isGlobalAdmin) {
      conditions.push({ membership_type: { _in: allowedSports } })
    }

    if (conditions.length === 0) return {}
    return conditions.length === 1 ? conditions[0] : { _and: conditions }
  }, [statusFilter, sportFilter, isGlobalAdmin, allowedSports])

  const { data: registrationsRaw, isLoading } = useCollection<Registration>('registrations', {
    filter,
    sort: ['-submitted_at'],
    all: true,
  })
  const registrations = registrationsRaw ?? []

  // Fetch teams for displaying team names
  const { data: teamsRaw } = useCollection<Team & BaseRecord>('teams', {
    filter: { active: { _eq: true } },
    sort: ['name'],
    all: true,
  })
  const teams = teamsRaw ?? []
  const teamByName = useMemo(() => {
    const map: Record<string, Team & BaseRecord> = {}
    teams.forEach((t) => { map[t.name] = t })
    return map
  }, [teams])

  const { mutate: updateReg, isPending: isUpdating } = useUpdate<Registration>('registrations', {
    onSuccess: () => toast.success(t('anmeldungenUpdated')),
    onError: () => toast.error(t('anmeldungenUpdateError')),
  })

  const handleApprove = (reg: Registration) => {
    updateReg({ id: reg.id, data: { status: 'approved' } })
  }

  const handleReject = (reg: Registration) => {
    updateReg({ id: reg.id, data: { status: 'rejected' } })
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">{t('anmeldungenPending')}</span>
      case 'approved':
        return <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">{t('anmeldungenApproved')}</span>
      case 'rejected':
        return <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300">{t('anmeldungenRejected')}</span>
      default:
        return null
    }
  }

  const sportLabel = (type: string) => {
    switch (type) {
      case 'volleyball': return 'Volleyball'
      case 'basketball': return 'Basketball'
      case 'passive': return t('anmeldungenPassive')
      default: return type
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('anmeldungenTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('anmeldungenDescription')}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-md border border-gray-200 bg-transparent px-3 py-2 text-sm dark:border-gray-600 dark:text-gray-100"
        >
          <option value="all">{t('anmeldungenAllStatuses')}</option>
          <option value="pending">{t('anmeldungenPending')}</option>
          <option value="approved">{t('anmeldungenApproved')}</option>
          <option value="rejected">{t('anmeldungenRejected')}</option>
        </select>

        {allowedSports.length > 1 && (
          <select
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value as SportFilter)}
            className="rounded-md border border-gray-200 bg-transparent px-3 py-2 text-sm dark:border-gray-600 dark:text-gray-100"
          >
            <option value="all">{t('anmeldungenAllSports')}</option>
            {allowedSports.map((s) => (
              <option key={s} value={s}>{sportLabel(s)}</option>
            ))}
          </select>
        )}

        <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
          {registrations.length} {t('anmeldungenCount')}
        </span>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">…</div>
      ) : registrations.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">{t('anmeldungenNoRecords')}</div>
      ) : (
        <div className="space-y-3">
          {registrations.map((reg) => {
            const isExpanded = expandedId === reg.id

            return (
              <div
                key={reg.id}
                className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
              >
                {/* Summary row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {reg.vorname} {reg.nachname}
                      </span>
                      {statusBadge(reg.status)}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {sportLabel(reg.membership_type)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>{reg.email}</span>
                      {reg.team && (
                        <>
                          <span>·</span>
                          {reg.team.split(',').map((t) => {
                            const name = t.trim()
                            const tObj = teamByName[name]
                            return tObj ? (
                              <TeamChip key={name} team={tObj.name} size="xs" />
                            ) : (
                              <span key={name} className="text-xs">{name}</span>
                            )
                          })}
                        </>
                      )}
                      <span>·</span>
                      <span>{formatDate(reg.submitted_at)}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    {reg.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(reg)}
                          disabled={isUpdating}
                          className="rounded-md bg-green-600 p-2 text-white hover:bg-green-700 disabled:opacity-40"
                          title={t('anmeldungenApprove')}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleReject(reg)}
                          disabled={isUpdating}
                          className="rounded-md bg-red-600 p-2 text-white hover:bg-red-700 disabled:opacity-40"
                          title={t('anmeldungenReject')}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : reg.id)}
                      className="rounded-md p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      title={t('anmeldungenDetails')}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded details (editable) */}
                {isExpanded && (
                  <ExpandedDetails reg={reg} t={t} onSave={(data) => updateReg({ id: reg.id, data })} isUpdating={isUpdating} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ExpandedDetails({
  reg,
  t,
  onSave,
  isUpdating,
}: {
  reg: Registration
  t: (key: string) => string
  onSave: (data: Partial<Registration>) => void
  isUpdating: boolean
}) {
  const [edits, setEdits] = useState<Record<string, string>>({})
  const hasChanges = Object.keys(edits).length > 0

  const field = (key: keyof Registration, label: string, opts?: { type?: string; full?: boolean }) => {
    const original = (reg[key] as string) ?? ''
    const value = edits[key] ?? original
    return (
      <div className={opts?.full ? 'sm:col-span-2' : ''}>
        <label className="mb-0.5 block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
        <input
          type={opts?.type ?? 'text'}
          value={value}
          onChange={(e) => {
            const v = e.target.value
            if (v === original) {
              const next = { ...edits }
              delete next[key]
              setEdits(next)
            } else {
              setEdits({ ...edits, [key]: v })
            }
          }}
          className="w-full rounded-md border border-gray-200 bg-transparent px-2.5 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:text-gray-100"
        />
      </div>
    )
  }

  const handleSave = () => {
    if (!hasChanges) return
    onSave(edits as Partial<Registration>)
    setEdits({})
  }

  return (
    <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
      <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
        {field('vorname', t('anmeldungenFirstName'))}
        {field('nachname', t('anmeldungenLastName'))}
        {field('email', t('anmeldungenEmail'), { type: 'email' })}
        {field('telefon_mobil', t('anmeldungenPhone'))}
        {field('adresse', t('anmeldungenAddress'), { full: true })}
        {field('plz', 'PLZ')}
        {field('ort', t('anmeldungenCity'))}
        {field('geburtsdatum', t('anmeldungenDob'), { type: 'date' })}
        {field('nationalitaet', t('anmeldungenNationality'))}
        {field('geschlecht', t('anmeldungenGender'))}
        {field('rolle', t('anmeldungenFunction'))}
        {field('team', t('anmeldungenTeam'))}
        {field('beitragskategorie', t('anmeldungenFeeCategory'))}
        {field('lizenz', t('anmeldungenLicence'))}
        {field('schiedsrichter_stufe', t('anmeldungenRefLevel'))}
        {field('kantonsschule', t('anmeldungenSchool'))}
        {field('ahv_nummer', 'AHV')}
        {field('bemerkungen', t('anmeldungenNotes'), { full: true })}
        <div>
          <label className="mb-0.5 block text-xs font-medium text-gray-500 dark:text-gray-400">{t('anmeldungenRef')}</label>
          <div className="px-2.5 py-1.5 text-sm text-gray-500 dark:text-gray-400">{reg.reference_number}</div>
        </div>
      </div>
      {hasChanges && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isUpdating}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            {t('save')}
          </button>
        </div>
      )}
    </div>
  )
}
