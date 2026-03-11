import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RecordModel } from 'pocketbase'
import type { Game, Member, Team, Hall, LicenceType, MemberTeam, ScorerDelegation } from '../../../types'
import TeamChip from '../../../components/TeamChip'
import AssignmentEditor from './AssignmentEditor'
import DelegationModal from './DelegationModal'
import { downloadICal } from '../../../utils/icalGenerator'
import type { CalendarEntry } from '../../../types/calendar'
import { formatTime } from '../../../utils/dateHelpers'
import { Calendar } from 'lucide-react'
import TeamSelect from '../../../components/TeamSelect'

interface ScorerRowProps {
  game: Game
  members: Member[]
  teams: Team[]
  teamMemberIds: Map<string, Set<string>>
  memberTeams: MemberTeam[]
  onUpdate: (gameId: string, fields: Partial<Game>) => void
  canEdit: boolean
  showContact: boolean
  userId?: string
  userTeamIds?: string[]
  userLicences?: LicenceType[]
  sport: 'volleyball' | 'basketball'
  onDelegate: (gameId: string, role: ScorerDelegation['role'], toMemberId: string, fromTeamId: string, toTeamId: string) => void
  getPendingForRole: (gameId: string, role: string) => ScorerDelegation | undefined
  getDelegationTargetName: (delegation: ScorerDelegation, members: Member[]) => string
}

export type ExpandedGame = Game & {
  expand?: {
    kscw_team?: Team & RecordModel
    hall?: Hall & RecordModel
    // VB duty relations
    scorer_member?: Member & RecordModel
    taefeler_member?: Member & RecordModel
    scorer_taefeler_member?: Member & RecordModel
    scorer_duty_team?: Team & RecordModel
    taefeler_duty_team?: Team & RecordModel
    scorer_taefeler_duty_team?: Team & RecordModel
    // BB duty relations
    bb_anschreiber?: Member & RecordModel
    bb_zeitnehmer?: Member & RecordModel
    bb_24s_official?: Member & RecordModel
    bb_duty_team?: Team & RecordModel
  }
}

function getDateFormatter(locale: string) {
  const loc = locale === 'de' ? 'de-CH' : 'en-GB'
  return new Intl.DateTimeFormat(loc, { weekday: 'short', day: 'numeric', month: 'short' })
}

// ── VB helpers ──

function isVbSeparateMode(game: Game): boolean {
  return !!(game.scorer_duty_team || game.scorer_member || game.taefeler_duty_team || game.taefeler_member)
}

function isVbCombinedMode(game: Game): boolean {
  return !!(game.scorer_taefeler_duty_team || game.scorer_taefeler_member)
}

export function hasAnyVbAssignment(game: Game): boolean {
  return !!(game.scorer_member || game.taefeler_member || game.scorer_taefeler_member)
}

function isVbFullyAssigned(game: Game): boolean {
  if (isVbCombinedMode(game)) return !!game.scorer_taefeler_member
  if (isVbSeparateMode(game)) return !!(game.scorer_member && game.taefeler_member)
  return false
}

// ── BB helpers ──

export function hasAnyBbAssignment(game: Game): boolean {
  return !!(game.bb_anschreiber || game.bb_zeitnehmer || game.bb_24s_official)
}

function isBbFullyAssigned(game: Game): boolean {
  return !!(game.bb_anschreiber && game.bb_zeitnehmer)
}

// ── Generic helpers ──

export function hasAnyAssignment(game: Game): boolean {
  return hasAnyVbAssignment(game) || hasAnyBbAssignment(game)
}

export function isFullyAssigned(game: Game, sport: 'volleyball' | 'basketball'): boolean {
  return sport === 'basketball' ? isBbFullyAssigned(game) : isVbFullyAssigned(game)
}

export function DutyStatus({ game, sport }: { game: Game; sport: 'volleyball' | 'basketball' }) {
  const { t } = useTranslation('scorer')
  if (game.duty_confirmed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        {t('statusConfirmed')}
      </span>
    )
  }
  const hasAssignment = sport === 'basketball' ? hasAnyBbAssignment(game) : hasAnyVbAssignment(game)
  if (hasAssignment) {
    return (
      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
        {t('statusAssigned')}
      </span>
    )
  }
  return (
    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
      {t('statusOpen')}
    </span>
  )
}

function handleExportICal(game: ExpandedGame, title: string) {
  const hallName = game.expand?.hall?.name ?? ''
  const entry: CalendarEntry = {
    id: `duty-${game.id}`,
    type: 'game',
    title,
    date: new Date(game.date),
    startTime: game.time ? formatTime(game.time) : null,
    endTime: null,
    allDay: false,
    location: hallName,
    teamNames: [],
    description: `${game.home_team} vs ${game.away_team}\n${game.league}`,
    source: game,
  }
  downloadICal([entry], `scorer-duty-${game.date}.ics`)
}

type VbAssignRole = 'scorer' | 'taefeler' | 'scorer_taefeler'
type BbAssignRole = 'bb_anschreiber' | 'bb_zeitnehmer' | 'bb_24s_official'
type AssignRole = VbAssignRole | BbAssignRole

export default function ScorerRow({
  game,
  members,
  teams,
  teamMemberIds,
  memberTeams,
  onUpdate,
  canEdit,
  showContact,
  userId,
  userTeamIds = [],
  userLicences = [],
  sport,
  onDelegate,
  getPendingForRole,
  getDelegationTargetName,
}: ScorerRowProps) {
  const { t, i18n } = useTranslation('scorer')
  const expanded = game as ExpandedGame
  const kscwTeam = expanded.expand?.kscw_team?.name ?? ''
  const dateStr = game.date ? getDateFormatter(i18n.language).format(new Date(game.date)) : ''

  const vbSeparate = isVbSeparateMode(game)
  const vbCombined = isVbCombinedMode(game)

  // Self-assign confirmation state
  const [confirmRole, setConfirmRole] = useState<AssignRole | null>(null)
  // Delegation modal state
  const [delegateRole, setDelegateRole] = useState<AssignRole | null>(null)

  // Can this user self-assign to a role?
  function canSelfAssign(role: AssignRole): boolean {
    if (!userId || game.duty_confirmed) return false

    if (sport === 'volleyball') {
      const vbRole = role as VbAssignRole
      if ((vbRole === 'scorer' || vbRole === 'scorer_taefeler') && !userLicences.includes('scorer_vb')) return false
      let dutyTeamId: string | undefined
      let currentPerson: string | undefined
      if (vbRole === 'scorer') {
        dutyTeamId = game.scorer_duty_team
        currentPerson = game.scorer_member
      } else if (vbRole === 'taefeler') {
        dutyTeamId = game.taefeler_duty_team
        currentPerson = game.taefeler_member
      } else {
        dutyTeamId = game.scorer_taefeler_duty_team
        currentPerson = game.scorer_taefeler_member
      }
      if (currentPerson) return false
      if (!dutyTeamId) return false
      return userTeamIds.includes(dutyTeamId)
    } else {
      const bbRole = role as BbAssignRole
      if (bbRole === 'bb_anschreiber' && !userLicences.includes('otr1_bb')) return false
      if (bbRole === 'bb_zeitnehmer' && !userLicences.includes('otr1_bb')) return false
      if (bbRole === 'bb_24s_official' && !userLicences.includes('otr2_bb') && !userLicences.includes('otn_bb')) return false
      const currentPerson = game[bbRole]
      if (currentPerson) return false
      if (!game.bb_duty_team) return false
      return userTeamIds.includes(game.bb_duty_team)
    }
  }

  function handleSelfAssign(role: AssignRole) {
    if (!userId) return
    const fields: Partial<Game> = {}

    if (sport === 'volleyball') {
      const vbRole = role as VbAssignRole
      if (vbRole === 'scorer') fields.scorer_member = userId
      else if (vbRole === 'taefeler') fields.taefeler_member = userId
      else fields.scorer_taefeler_member = userId

      if (vbRole === 'scorer' && game.taefeler_member) fields.duty_confirmed = true
      if (vbRole === 'taefeler' && game.scorer_member) fields.duty_confirmed = true
      if (vbRole === 'scorer_taefeler') fields.duty_confirmed = true
    } else {
      const bbRole = role as BbAssignRole
      fields[bbRole] = userId

      const nextAnschreiber = bbRole === 'bb_anschreiber' ? userId : game.bb_anschreiber
      const nextZeitnehmer = bbRole === 'bb_zeitnehmer' ? userId : game.bb_zeitnehmer
      if (nextAnschreiber && nextZeitnehmer) fields.duty_confirmed = true
    }

    onUpdate(game.id, fields)
    setConfirmRole(null)
  }

  function handleAdminUpdate(gameId: string, fields: Partial<Game>) {
    if (sport === 'volleyball') {
      if (vbSeparate) {
        const nextScorer = 'scorer_member' in fields ? fields.scorer_member : game.scorer_member
        const nextTaefeler = 'taefeler_member' in fields ? fields.taefeler_member : game.taefeler_member
        if (nextScorer && nextTaefeler && !game.duty_confirmed) {
          fields.duty_confirmed = true
        }
      } else if (vbCombined) {
        const nextMember = 'scorer_taefeler_member' in fields ? fields.scorer_taefeler_member : game.scorer_taefeler_member
        if (nextMember && !game.duty_confirmed) {
          fields.duty_confirmed = true
        }
      }
    } else {
      const nextAnschreiber = 'bb_anschreiber' in fields ? fields.bb_anschreiber : game.bb_anschreiber
      const nextZeitnehmer = 'bb_zeitnehmer' in fields ? fields.bb_zeitnehmer : game.bb_zeitnehmer
      if (nextAnschreiber && nextZeitnehmer && !game.duty_confirmed) {
        fields.duty_confirmed = true
      }
    }
    onUpdate(gameId, fields)
  }

  const roleLabel = (role: AssignRole) => {
    if (role === 'scorer') return t('scorer')
    if (role === 'taefeler') return t('scoreboard')
    if (role === 'scorer_taefeler') return t('scorerTaefeler')
    if (role === 'bb_anschreiber') return t('bbAnschreiber')
    if (role === 'bb_zeitnehmer') return t('bbZeitnehmer')
    if (role === 'bb_24s_official') return t('bb24sOfficial')
    return role
  }

  // Get the duty team ID for a role
  function getDutyTeamForRole(role: AssignRole): string {
    if (sport === 'volleyball') {
      if (role === 'scorer') return game.scorer_duty_team ?? ''
      if (role === 'taefeler') return game.taefeler_duty_team ?? ''
      return game.scorer_taefeler_duty_team ?? ''
    }
    return game.bb_duty_team ?? ''
  }

  // Check if current user is the assigned member for a role
  function isUserAssigned(role: AssignRole): boolean {
    if (!userId) return false
    if (sport === 'volleyball') {
      if (role === 'scorer') return game.scorer_member === userId
      if (role === 'taefeler') return game.taefeler_member === userId
      return game.scorer_taefeler_member === userId
    }
    return game[role as BbAssignRole] === userId
  }

  // Get pending delegation name for a role
  function pendingNameForRole(role: AssignRole): string | undefined {
    const pending = getPendingForRole(game.id, role)
    if (!pending) return undefined
    return getDelegationTargetName(pending, members)
  }

  function handleDelegateConfirm(toMemberId: string, toTeamId: string) {
    if (!delegateRole) return
    const fromTeamId = getDutyTeamForRole(delegateRole)
    onDelegate(game.id, delegateRole as ScorerDelegation['role'], toMemberId, fromTeamId, toTeamId)
    setDelegateRole(null)
  }

  const gameLabel = `${game.home_team} – ${game.away_team}`

  const sportBorder = sport === 'basketball'
    ? 'border-l-orange-400 dark:border-l-orange-500'
    : 'border-l-brand-400 dark:border-l-brand-500'

  // Helper to render a VB assignment editor
  const renderVbEditor = (role: VbAssignRole, labelKey: string, requiredLicence: LicenceType | undefined, teamField: keyof Game, personField: keyof Game) => (
    <AssignmentEditor
      label={t(labelKey)}
      requiredLicence={requiredLicence}
      teamValue={(game[teamField] as string) ?? ''}
      personValue={(game[personField] as string) ?? ''}
      members={members}
      teams={teams}
      teamMemberIds={teamMemberIds}
      onTeamChange={(v) => handleAdminUpdate(game.id, { [teamField]: v })}
      onPersonChange={(v) => handleAdminUpdate(game.id, { [personField]: v })}
      disabled={!canEdit || game.duty_confirmed}
      showContact={showContact}
      selfAssignButton={canSelfAssign(role)}
      onSelfAssign={() => setConfirmRole(role)}
      canEdit={canEdit}
      isCurrentUserAssigned={isUserAssigned(role)}
      onDelegate={() => setDelegateRole(role)}
      pendingDelegationName={pendingNameForRole(role)}
    />
  )

  return (
    <div className={`flex h-full flex-col rounded-lg border border-gray-200 border-l-4 ${sportBorder} bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800`}>
      {/* Game info */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-400">
          {dateStr} · {game.time ? formatTime(game.time) : ''}
        </div>
        {kscwTeam && <TeamChip team={kscwTeam} size="sm" />}
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {gameLabel}
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
          {game.league}
        </span>
        <DutyStatus game={game} sport={sport} />
        <button
          onClick={() => handleExportICal(expanded, t('scorerDutyIcal', { home: game.home_team, away: game.away_team }))}
          title={t('exportICal')}
          aria-label={t('exportICal')}
          className="ml-auto flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        >
          <Calendar className="h-4 w-4" />
        </button>
      </div>

      {/* Assignment editors */}
      <div className="mt-3 flex-1 space-y-3">
        {sport === 'volleyball' ? (
          vbCombined ? (
            renderVbEditor('scorer_taefeler', 'scorerTaefeler', 'scorer_vb', 'scorer_taefeler_duty_team', 'scorer_taefeler_member')
          ) : (
            <>
              {renderVbEditor('scorer', 'scorer', 'scorer_vb', 'scorer_duty_team', 'scorer_member')}
              {renderVbEditor('taefeler', 'scoreboard', undefined, 'taefeler_duty_team', 'taefeler_member')}
            </>
          )
        ) : (
          <>
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">{t('bbDutyTeam')}</span>
              {canEdit ? (
                <TeamSelect
                  value={game.bb_duty_team ?? ''}
                  onChange={(v) => handleAdminUpdate(game.id, { bb_duty_team: v })}
                  teams={teams}
                  disabled={!canEdit || game.duty_confirmed}
                  aria-label={t('bbDutyTeam')}
                  placeholder={t('selectTeam')}
                />
              ) : (
                <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-900 dark:bg-gray-750 dark:text-gray-100">
                  {teams.find((t) => t.id === game.bb_duty_team)?.name ?? t('unassigned')}
                </div>
              )}
            </div>
            <AssignmentEditor
              label={t('bbAnschreiber')}
              requiredLicence="otr1_bb"
              teamValue={game.bb_duty_team ?? ''}
              personValue={game.bb_anschreiber ?? ''}
              members={members}
              teams={teams}
              teamMemberIds={teamMemberIds}
              onTeamChange={(v) => handleAdminUpdate(game.id, { bb_duty_team: v })}
              onPersonChange={(v) => handleAdminUpdate(game.id, { bb_anschreiber: v })}
              disabled={!canEdit || game.duty_confirmed}
              showContact={showContact}
              selfAssignButton={canSelfAssign('bb_anschreiber')}
              onSelfAssign={() => setConfirmRole('bb_anschreiber')}
              canEdit={canEdit}
              isCurrentUserAssigned={isUserAssigned('bb_anschreiber')}
              onDelegate={() => setDelegateRole('bb_anschreiber')}
              pendingDelegationName={pendingNameForRole('bb_anschreiber')}
            />
            <AssignmentEditor
              label={t('bbZeitnehmer')}
              requiredLicence="otr1_bb"
              teamValue={game.bb_duty_team ?? ''}
              personValue={game.bb_zeitnehmer ?? ''}
              members={members}
              teams={teams}
              teamMemberIds={teamMemberIds}
              onTeamChange={(v) => handleAdminUpdate(game.id, { bb_duty_team: v })}
              onPersonChange={(v) => handleAdminUpdate(game.id, { bb_zeitnehmer: v })}
              disabled={!canEdit || game.duty_confirmed}
              showContact={showContact}
              selfAssignButton={canSelfAssign('bb_zeitnehmer')}
              onSelfAssign={() => setConfirmRole('bb_zeitnehmer')}
              canEdit={canEdit}
              isCurrentUserAssigned={isUserAssigned('bb_zeitnehmer')}
              onDelegate={() => setDelegateRole('bb_zeitnehmer')}
              pendingDelegationName={pendingNameForRole('bb_zeitnehmer')}
            />
            <AssignmentEditor
              label={t('bb24sOfficial')}
              requiredLicence={['otr2_bb', 'otn_bb']}
              teamValue={game.bb_duty_team ?? ''}
              personValue={game.bb_24s_official ?? ''}
              members={members}
              teams={teams}
              teamMemberIds={teamMemberIds}
              onTeamChange={(v) => handleAdminUpdate(game.id, { bb_duty_team: v })}
              onPersonChange={(v) => handleAdminUpdate(game.id, { bb_24s_official: v })}
              disabled={!canEdit || game.duty_confirmed}
              showContact={showContact}
              selfAssignButton={canSelfAssign('bb_24s_official')}
              onSelfAssign={() => setConfirmRole('bb_24s_official')}
              canEdit={canEdit}
              isCurrentUserAssigned={isUserAssigned('bb_24s_official')}
              onDelegate={() => setDelegateRole('bb_24s_official')}
              pendingDelegationName={pendingNameForRole('bb_24s_official')}
            />
          </>
        )}

        {/* Confirmed badge / admin-only unconfirm */}
        <div className="flex items-end">
          {game.duty_confirmed ? (
            <div className="flex min-h-[44px] items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {t('confirmed')}
              </span>
              {canEdit && (
                <button
                  onClick={() => onUpdate(game.id, { duty_confirmed: false })}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                  title={t('unconfirm')}
                  aria-label={t('unconfirm')}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ) : (
            <span className="flex min-h-[44px] items-center text-sm text-gray-400 dark:text-gray-500" />
          )}
        </div>
      </div>

      {/* Self-assign confirmation popup */}
      {confirmRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('confirmSelfAssignTitle')}
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {t('confirmSelfAssignMessage', {
                role: roleLabel(confirmRole),
                game: gameLabel,
                date: dateStr,
              })}
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setConfirmRole(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {t('cancelAction')}
              </button>
              <button
                onClick={() => handleSelfAssign(confirmRole)}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                {t('confirmAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delegation modal */}
      {delegateRole && (
        <DelegationModal
          role={delegateRole as ScorerDelegation['role']}
          roleLabel={roleLabel(delegateRole)}
          gameLabel={`${gameLabel} · ${dateStr}`}
          dutyTeamId={getDutyTeamForRole(delegateRole)}
          members={members}
          teams={teams}
          memberTeams={memberTeams}
          currentUserId={userId ?? ''}
          onDelegate={handleDelegateConfirm}
          onClose={() => setDelegateRole(null)}
        />
      )}
    </div>
  )
}
