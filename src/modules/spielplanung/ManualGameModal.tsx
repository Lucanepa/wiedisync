import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, AlertTriangle, Home as HomeIcon, Plane } from 'lucide-react'
import Modal from '../../components/Modal'
import { Button } from '../../components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import DatePicker from '../../components/ui/DatePicker'
import { useCollection } from '../../lib/query'
import { useMutation } from '../../hooks/useMutation'
import { useTeams } from '../../hooks/useTeams'
import { useGameConflicts } from './hooks/useGameConflicts'
import { buildManualGamePayload } from './utils/manualGamePayload'
import { getSeasonYear, toDateKey } from '../../utils/dateUtils'
import { asObj } from '../../utils/relations'
import type { Hall, Team, ManualGameInput, Game, HallSlot } from '../../types'
import { cn } from '../../lib/utils'

const HALL_COMBO_AB = 'combo:A+B'

interface ManualGameModalProps {
  open: boolean
  onClose: () => void
  /** Team IDs (as strings) the caller is allowed to create games for. */
  editableTeamIds: string[]
  /** Prefills the date field when opened from a day cell (create mode only). */
  initialDate?: Date | null
  /** When set, the modal opens in edit mode preloaded with this game's values. */
  editingGame?: Game | null
}

function defaultTime(): string {
  return '16:00'
}

function toSeasonLabel(date: string): string {
  const year = getSeasonYear(new Date(date + 'T00:00:00'))
  return `${year}/${year + 1}`
}

export default function ManualGameModal({
  open,
  onClose,
  editableTeamIds,
  initialDate,
  editingGame,
}: ManualGameModalProps) {
  const { t } = useTranslation('spielplanung')
  const { data: allTeams } = useTeams('all')
  const { data: halls } = useCollection<Hall>('halls', {
    sort: ['name'],
    all: true,
    fields: ['id', 'name', 'address', 'city'],
  })
  const { create, update, isLoading } = useMutation('games')
  const isEditMode = !!editingGame

  const editableTeams = useMemo(
    () => (allTeams ?? []).filter((t) => editableTeamIds.includes(String(t.id))),
    [allTeams, editableTeamIds],
  )

  // ── Form state ─────────────────────────────────────────────────────
  const [teamId, setTeamId] = useState<string>('')
  const [type, setType] = useState<'home' | 'away'>('home')
  const [opponent, setOpponent] = useState('')
  const [date, setDate] = useState<string>(() =>
    initialDate ? toDateKey(initialDate) : toDateKey(new Date()),
  )
  const [time, setTime] = useState<string>(defaultTime)
  const [hallId, setHallId] = useState<string>('')
  const [additionalHalls, setAdditionalHalls] = useState<string[]>([])
  const [saturdayHintHall, setSaturdayHintHall] = useState<string>('')
  const [awayVenue, setAwayVenue] = useState({ name: '', address: '', city: '', plus_code: '' })
  const [league, setLeague] = useState('')
  const [round, setRound] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Prefill date on (re)open (create mode)
  useEffect(() => {
    if (open && initialDate && !editingGame) setDate(toDateKey(initialDate))
  }, [open, initialDate, editingGame])

  // Prefill from existing game on open (edit mode)
  useEffect(() => {
    if (!open || !editingGame) return
    const teamRel = asObj<Team>(editingGame.kscw_team)
    setTeamId(String(teamRel?.id ?? editingGame.kscw_team ?? ''))
    setType(editingGame.type)
    setOpponent(
      editingGame.type === 'home'
        ? editingGame.away_team ?? ''
        : editingGame.home_team ?? '',
    )
    setDate(editingGame.date)
    // time comes back as HH:MM:SS — trim seconds for the <input type="time">
    setTime((editingGame.time ?? '16:00').slice(0, 5))
    const hallRel = asObj<Hall>(editingGame.hall)
    setHallId(hallRel ? String(hallRel.id) : editingGame.hall ? String(editingGame.hall) : '')
    setAdditionalHalls(
      Array.isArray(editingGame.additional_halls)
        ? editingGame.additional_halls.map((v) => String(typeof v === 'object' && v !== null && 'id' in v ? (v as { id: unknown }).id : v))
        : [],
    )
    setSaturdayHintHall('')
    const ah = editingGame.away_hall_json
    setAwayVenue({
      name: ah?.name ?? '',
      address: ah?.address ?? '',
      city: ah?.city ?? '',
      plus_code: ah?.plus_code ?? '',
    })
    setLeague(editingGame.league ?? '')
    setRound(editingGame.round ?? '')
  }, [open, editingGame])

  // Auto-select the single editable team when there's only one
  useEffect(() => {
    if (open && !teamId && editableTeams.length === 1) {
      setTeamId(String(editableTeams[0]!.id))
    }
  }, [open, editableTeams, teamId])

  // Reset form on close
  useEffect(() => {
    if (!open) {
      setTeamId('')
      setType('home')
      setOpponent('')
      setTime(defaultTime())
      setHallId('')
      setAdditionalHalls([])
      setSaturdayHintHall('')
      setAwayVenue({ name: '', address: '', city: '', plus_code: '' })
      setLeague('')
      setRound('')
      setSubmitError(null)
    }
  }, [open])

  // ── Conflict check ────────────────────────────────────────────────
  const selectedTeam = editableTeams.find((t) => String(t.id) === teamId) as Team | undefined
  const isBasketball = selectedTeam?.sport === 'basketball'
  const kwiA = useMemo(() => (halls ?? []).find((h) => h.name === 'KWI A'), [halls])
  const kwiB = useMemo(() => (halls ?? []).find((h) => h.name === 'KWI B'), [halls])
  const kwiC = useMemo(() => (halls ?? []).find((h) => h.name === 'KWI C'), [halls])
  const canOfferCombo = isBasketball && !!kwiA && !!kwiB

  // Saturday training slot lookup (volleyball teams only — drives the hint)
  const isSaturday = useMemo(() => {
    if (!date) return false
    return new Date(date + 'T00:00:00').getDay() === 6
  }, [date])

  const { data: saturdayTrainingSlots } = useCollection<HallSlot>('hall_slots', {
    filter:
      teamId && isSaturday && selectedTeam?.sport === 'volleyball'
        ? {
            _and: [
              { day_of_week: { _eq: 6 } },
              { slot_type: { _eq: 'training' } },
              { recurring: { _eq: true } },
              { teams: { teams_id: { _eq: teamId } } },
            ],
          }
        : undefined,
    fields: ['id', 'hall', 'start_time', 'end_time'],
    all: true,
    enabled: !!teamId && isSaturday && selectedTeam?.sport === 'volleyball',
    staleTime: 60_000,
  })

  // Derived: is the current selection the A+B combo?
  const isComboSelected =
    !!kwiA &&
    !!kwiB &&
    hallId === String(kwiA.id) &&
    additionalHalls.length === 1 &&
    additionalHalls[0] === String(kwiB.id)

  const hallSelectValue = isComboSelected ? HALL_COMBO_AB : hallId

  function onHallSelectChange(value: string) {
    setSaturdayHintHall('') // user took over
    if (value === HALL_COMBO_AB && kwiA && kwiB) {
      setHallId(String(kwiA.id))
      setAdditionalHalls([String(kwiB.id)])
      return
    }
    setHallId(value)
    setAdditionalHalls([])
  }

  // ── VB Saturday prefill (create mode only) ─────────────────────────
  useEffect(() => {
    if (!open || editingGame) return
    if (!selectedTeam || selectedTeam.sport !== 'volleyball') return
    if (!isSaturday || type !== 'home') return
    if (hallId !== '') return // don't override manual choice
    if (!halls || halls.length === 0) return

    // Priority: own Sat training slot hall → KWI C → KWI A → KWI B
    const trainingHall =
      saturdayTrainingSlots && saturdayTrainingSlots.length > 0
        ? String(saturdayTrainingSlots[0].hall)
        : ''
    const fallback = kwiC?.id ?? kwiA?.id ?? kwiB?.id ?? ''
    const pick = trainingHall || String(fallback)
    if (!pick) return
    setHallId(pick)
    setAdditionalHalls([])
    setSaturdayHintHall(pick)
  }, [
    open,
    editingGame,
    selectedTeam,
    isSaturday,
    type,
    hallId,
    halls,
    saturdayTrainingSlots,
    kwiC,
    kwiA,
    kwiB,
  ])

  const { errors, warnings } = useGameConflicts({
    editingId: editingGame?.id,
    kscw_team: teamId,
    hall: type === 'home' ? hallId : null,
    additional_halls: type === 'home' ? additionalHalls : null,
    date,
    time,
    type,
    teams: allTeams,
    halls,
    enabled: !!teamId && !!date && !!time,
  })

  const blocked = errors.length > 0
  const requiredFilled =
    !!teamId && !!opponent.trim() && !!date && !!time && (type === 'away' || !!hallId)

  // ── Submit ────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    if (blocked || !requiredFilled || !selectedTeam) return

    const input: ManualGameInput = {
      kscw_team: teamId,
      type,
      opponent: opponent.trim(),
      date,
      time,
      hall: type === 'home' ? hallId : null,
      additional_halls:
        type === 'home' && additionalHalls.length > 0 ? additionalHalls : null,
      away_hall_json:
        type === 'away' && awayVenue.name.trim()
          ? {
              name: awayVenue.name.trim(),
              address: awayVenue.address.trim(),
              city: awayVenue.city.trim(),
              plus_code: awayVenue.plus_code.trim() || undefined,
            }
          : null,
      league: league.trim(),
      round: round.trim(),
    }

    try {
      const payload = buildManualGamePayload(input, selectedTeam.name, toSeasonLabel(date))
      if (isEditMode && editingGame) {
        // On edit, keep the original game_id + source so we don't rename in-place.
        const { game_id: _gid, ...rest } = payload
        void _gid
        await update(editingGame.id, rest)
      } else {
        await create(payload)
      }
      onClose()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditMode ? t('manualGame.editTitle') : t('manualGame.title')}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEditMode && <p className="text-sm text-muted-foreground">{t('manualGame.subtitle')}</p>}

        {/* Team */}
        <div>
          <Label htmlFor="team">{t('manualGame.team')} *</Label>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger id="team">
              <SelectValue placeholder={t('manualGame.teamPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {editableTeams.map((team) => (
                <SelectItem key={team.id} value={String(team.id)}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Home/Away + Opponent */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>{t('manualGame.homeAway')} *</Label>
            <div className="mt-1 grid grid-cols-2 gap-1 rounded-md border bg-muted/30 p-1">
              <button
                type="button"
                onClick={() => setType('home')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-sm font-medium transition-colors',
                  type === 'home'
                    ? 'bg-gold-400 text-brand-900'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <HomeIcon className="h-4 w-4" aria-hidden /> {t('manualGame.home')}
              </button>
              <button
                type="button"
                onClick={() => setType('away')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-sm font-medium transition-colors',
                  type === 'away'
                    ? 'bg-gold-400 text-brand-900'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <Plane className="h-4 w-4" aria-hidden /> {t('manualGame.away')}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="opponent">{t('manualGame.opponent')} *</Label>
            <Input
              id="opponent"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              placeholder={t('manualGame.opponentPlaceholder')}
            />
          </div>
        </div>

        {/* Date / Time */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="date">{t('manualGame.date')} *</Label>
            <DatePicker
              id="date"
              value={date}
              onChange={(v) => v && setDate(v)}
            />
          </div>
          <div>
            <Label htmlFor="time">{t('manualGame.time')} *</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="dark:bg-gray-800"
            />
          </div>
        </div>

        {/* Hall (home) or Away venue (away) */}
        {type === 'home' ? (
          <div>
            <Label htmlFor="hall">{t('manualGame.hall')} *</Label>
            <Select value={hallSelectValue} onValueChange={onHallSelectChange}>
              <SelectTrigger id="hall">
                <SelectValue placeholder={t('manualGame.hallPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {canOfferCombo && (
                  <SelectItem value={HALL_COMBO_AB}>
                    {t('manualGame.hallComboAB')}
                  </SelectItem>
                )}
                {(halls ?? []).map((h) => (
                  <SelectItem key={h.id} value={String(h.id)}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {saturdayHintHall && hallId === saturdayHintHall && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('manualGame.saturdayHint', {
                  hall: halls?.find((h) => String(h.id) === saturdayHintHall)?.name ?? '',
                })}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2 rounded-md border p-3">
            <Label className="text-xs uppercase text-muted-foreground">
              {t('manualGame.awayVenue')}
            </Label>
            <Input
              value={awayVenue.name}
              onChange={(e) => setAwayVenue((v) => ({ ...v, name: e.target.value }))}
              placeholder={t('manualGame.venueName')}
            />
            <Input
              value={awayVenue.address}
              onChange={(e) => setAwayVenue((v) => ({ ...v, address: e.target.value }))}
              placeholder={t('manualGame.venueAddress')}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={awayVenue.city}
                onChange={(e) => setAwayVenue((v) => ({ ...v, city: e.target.value }))}
                placeholder={t('manualGame.venueCity')}
              />
              <Input
                value={awayVenue.plus_code}
                onChange={(e) => setAwayVenue((v) => ({ ...v, plus_code: e.target.value }))}
                placeholder={t('manualGame.venuePlusCode')}
              />
            </div>
          </div>
        )}

        {/* League + Round (optional) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="league">{t('manualGame.league')}</Label>
            <Input
              id="league"
              value={league}
              onChange={(e) => setLeague(e.target.value)}
              placeholder={t('manualGame.leaguePlaceholder')}
            />
          </div>
          <div>
            <Label htmlFor="round">{t('manualGame.round')}</Label>
            <Input id="round" value={round} onChange={(e) => setRound(e.target.value)} />
          </div>
        </div>

        {/* Conflict banner */}
        {errors.length > 0 && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                {errors.map((e, i) => (
                  <div key={i}>{t(`manualGame.conflict.${e.messageKey}`, e.context ?? {})}</div>
                ))}
              </div>
            </div>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                {warnings.map((w, i) => (
                  <div key={i}>{t(`manualGame.conflict.${w.messageKey}`, w.context ?? {})}</div>
                ))}
              </div>
            </div>
          </div>
        )}
        {submitError && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {submitError}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common:cancel', 'Cancel')}
          </Button>
          <Button type="submit" disabled={blocked || !requiredFilled || isLoading}>
            {isLoading
              ? t('common:saving', 'Saving…')
              : isEditMode
                ? t('manualGame.save')
                : t('manualGame.create')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
