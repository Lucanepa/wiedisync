import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { RecordModel } from 'pocketbase'
import type { Game, Team, Hall, Member } from '../../../types'
import Button from '../../../components/ui/Button'
import TeamChip from '../../../components/TeamChip'
import { pbNameToColorKey } from '../../../utils/teamColors'
import ParticipationSummary from '../../../components/ParticipationSummary'
import ParticipationRosterModal from '../../../components/ParticipationRosterModal'
import { useAuth } from '../../../hooks/useAuth'
import { useParticipation } from '../../../hooks/useParticipation'
import { useMutation } from '../../../hooks/useMutation'
import pb from '../../../pb'
import { sanitizeUrl } from '../../../utils/sanitizeUrl'
import DatePicker from '../../../components/ui/DatePicker'
import { formatDate, formatTime } from '../../../utils/dateHelpers'

const GAME_EXPAND = 'kscw_team,hall,scorer_member,scoreboard_member,scorer_scoreboard_member,scorer_duty_team,scoreboard_duty_team,scorer_scoreboard_duty_team,bb_scorer_member,bb_timekeeper_member,bb_24s_official,bb_duty_team,bb_scorer_duty_team,bb_timekeeper_duty_team,bb_24s_duty_team'

interface GameDetailModalProps {
  game: Game | null
  onClose: () => void
  readOnly?: boolean
}

type ExpandedGame = Game & {
  expand?: {
    kscw_team?: Team & RecordModel
    hall?: Hall & RecordModel
    scorer_member?: Member & RecordModel
    scoreboard_member?: Member & RecordModel
    scorer_scoreboard_member?: Member & RecordModel
    scorer_duty_team?: Team & RecordModel
    scoreboard_duty_team?: Team & RecordModel
    scorer_scoreboard_duty_team?: Team & RecordModel
    bb_scorer_member?: Member & RecordModel
    bb_timekeeper_member?: Member & RecordModel
    bb_24s_official?: Member & RecordModel
    bb_duty_team?: Team & RecordModel
    bb_scorer_duty_team?: Team & RecordModel
    bb_timekeeper_duty_team?: Team & RecordModel
    bb_24s_duty_team?: Team & RecordModel
  }
}

function parseSets(json: unknown): Array<{ home: number; away: number }> {
  if (!Array.isArray(json)) return []
  return json.filter(
    (s): s is { home: number; away: number } =>
      typeof s === 'object' && s !== null && 'home' in s && 'away' in s,
  )
}

const dateFormatOptions: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}

export default function GameDetailModal({ game, onClose, readOnly }: GameDetailModalProps) {
  const { t, i18n } = useTranslation('games')
  const { user, isCoachOf, canParticipateIn, isStaffOnly } = useAuth()
  const [rosterOpen, setRosterOpen] = useState(false)
  const [editingDeadline, setEditingDeadline] = useState(false)
  const [deadlineValue, setDeadlineValue] = useState(game?.respond_by?.split(' ')[0] ?? '')
  const [fullGame, setFullGame] = useState<Game | null>(null)
  const { update: updateGame } = useMutation<Game>('games')
  const canParticipate = !!user && !!game?.kscw_team && canParticipateIn(game.kscw_team)
  const staffOnly = !!game?.kscw_team && isStaffOnly(game.kscw_team)
  const { effectiveStatus, hasAbsence, setStatus } = useParticipation(
    'game',
    game?.id ?? '',
    game?.date,
    undefined,
    staffOnly,
  )

  // Re-fetch with full expand when opened from calendar (which only expands kscw_team,hall)
  useEffect(() => {
    setFullGame(null)
    if (!game) return
    const exp = (game as ExpandedGame).expand
    const needsExpand =
      (game.scorer_member && !exp?.scorer_member) ||
      (game.scoreboard_member && !exp?.scoreboard_member) ||
      (game.scorer_scoreboard_member && !exp?.scorer_scoreboard_member) ||
      (game.scorer_duty_team && !exp?.scorer_duty_team) ||
      (game.scoreboard_duty_team && !exp?.scoreboard_duty_team) ||
      (game.scorer_scoreboard_duty_team && !exp?.scorer_scoreboard_duty_team) ||
      (game.bb_scorer_member && !exp?.bb_scorer_member) ||
      (game.bb_timekeeper_member && !exp?.bb_timekeeper_member) ||
      (game.bb_24s_official && !exp?.bb_24s_official) ||
      (game.bb_duty_team && !exp?.bb_duty_team) ||
      (game.bb_scorer_duty_team && !exp?.bb_scorer_duty_team) ||
      (game.bb_timekeeper_duty_team && !exp?.bb_timekeeper_duty_team) ||
      (game.bb_24s_duty_team && !exp?.bb_24s_duty_team)
    if (needsExpand) {
      pb.collection('games').getOne(game.id, { expand: GAME_EXPAND }).then(r => setFullGame(r as unknown as Game)).catch(() => {})
    }
  }, [game])

  useEffect(() => {
    if (!game) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [game, onClose])

  if (!game) return null

  const expanded = (fullGame ?? game) as ExpandedGame
  const expandedHall = expanded.expand?.hall
  const awayHall = game.away_hall_json
  const awayMapsUrl = awayHall
    ? awayHall.plus_code
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(awayHall.plus_code)}`
      : awayHall.address && awayHall.city
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${awayHall.address}, ${awayHall.city}`)}`
        : ''
    : ''
  const hall = expandedHall ?? (awayHall ? { name: awayHall.name, address: awayHall.address, city: awayHall.city, maps_url: awayMapsUrl } : null)
  const rawKscwTeam = expanded.expand?.kscw_team?.name ?? ''
  const kscwSport = expanded.expand?.kscw_team?.sport as 'volleyball' | 'basketball' | undefined
  const kscwTeam = rawKscwTeam && kscwSport ? pbNameToColorKey(rawKscwTeam, kscwSport) : rawKscwTeam
  const sets = parseSets(game.sets_json)
  const dateStr = game.date ? new Intl.DateTimeFormat(i18n.language, dateFormatOptions).format(new Date(game.date)) : ''
  const showScorerContact = isCoachOf(game.kscw_team)
  const homeWon = Number(game.home_score) > Number(game.away_score)
  const awayWon = Number(game.away_score) > Number(game.home_score)
  const kscwWon = game.type === 'home' ? homeWon : awayWon
  const kscwLost = game.type === 'home' ? awayWon : homeWon
  const scoreColor = kscwWon ? 'text-green-600 dark:text-green-400' : kscwLost ? 'text-red-500 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b dark:border-gray-700 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">
              {game.league}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {kscwTeam && <TeamChip team={kscwTeam} size="sm" />}
            <button
              onClick={onClose}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 sm:min-h-0 sm:min-w-0 sm:p-1 dark:hover:bg-gray-700"
            >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            </button>
          </div>
        </div>

        {/* Teams & Score */}
        <div className="px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 text-right">
              <p className={`text-base text-gray-900 dark:text-gray-100 ${game.type === 'home' ? 'font-semibold' : ''}`}>
                {game.home_team}
              </p>
            </div>

            <div className="shrink-0 text-center">
              {game.status === 'completed' || game.status === 'live' ? (
                <div className="font-mono text-3xl font-bold">
                  <span className={game.type === 'home' ? scoreColor : 'text-gray-500 dark:text-gray-400'}>{game.home_score}</span>
                  <span className="mx-1 text-gray-400 dark:text-gray-500">:</span>
                  <span className={game.type === 'away' ? scoreColor : 'text-gray-500 dark:text-gray-400'}>{game.away_score}</span>
                </div>
              ) : (
                <div className="text-base font-light text-gray-400 dark:text-gray-500">vs</div>
              )}
            </div>

            <div className="flex-1">
              <p className={`text-base text-gray-900 dark:text-gray-100 ${game.type === 'away' ? 'font-semibold' : ''}`}>
                {game.away_team}
              </p>
            </div>
          </div>

          {/* Sets breakdown */}
          {sets.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-center text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 dark:text-gray-400">
                    <th className="px-3 py-2"></th>
                    {sets.map((_, i) => (
                      <th key={i} className="px-3 py-2">
                        {t('set')} {i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t dark:border-gray-700">
                    <td className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{t('home')}</td>
                    {sets.map((s, i) => {
                      const kscwWonSet = (s.home > s.away) === (game.type === 'home')
                      return (
                        <td
                          key={i}
                          className={`px-3 py-2 font-bold ${kscwWonSet ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                        >
                          {s.home}
                        </td>
                      )
                    })}
                  </tr>
                  <tr className="border-t dark:border-gray-700">
                    <td className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{t('away')}</td>
                    {sets.map((s, i) => {
                      const kscwWonSet = (s.home > s.away) === (game.type === 'home')
                      return (
                        <td
                          key={i}
                          className={`px-3 py-2 font-bold ${kscwWonSet ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                        >
                          {s.away}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Participation — only for own team's scheduled games */}
        {game.status === 'scheduled' && canParticipate && (
          <div className="flex flex-wrap items-center gap-3 border-t dark:border-gray-700 px-6 py-3">
            {hasAbsence ? (
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('participation:absent')}</span>
            ) : (
              <>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('participation:attending')}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStatus('confirmed')}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      effectiveStatus === 'confirmed'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-green-900/30 dark:hover:text-green-400'
                    }`}
                  >
                    {t('participation:yes')}
                  </button>
                  <button
                    onClick={() => setStatus('tentative')}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      effectiveStatus === 'tentative'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-yellow-100 hover:text-yellow-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-yellow-900/30 dark:hover:text-yellow-400'
                    }`}
                  >
                    {t('participation:maybe')}
                  </button>
                  <button
                    onClick={() => setStatus('declined')}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      effectiveStatus === 'declined'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-red-900/30 dark:hover:text-red-400'
                    }`}
                  >
                    {t('participation:no')}
                  </button>
                </div>
              </>
            )}
            <div className="ml-auto border-l pl-3 dark:border-gray-600">
              <ParticipationSummary activityType="game" activityId={game.id} compact />
            </div>
          </div>
        )}

        {/* Game info */}
        <div className="space-y-3 border-t dark:border-gray-700 px-6 py-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t('gameInfo')}
          </h4>
          <DetailRow label={t('date')} value={dateStr} />
          <DetailRow label={t('kickoff')} value={game.time ? formatTime(game.time) : '–'} />
          <DetailRow label={t('gameType')} value={game.type === 'home' ? t('typeHome') : t('typeAway')} />
          {game.game_id && <DetailRow label={t('gameNumber')} value={game.game_id.replace(/^(vb_|bb_)/, '')} />}
          {game.season && <DetailRow label={t('season')} value={game.season} />}
        </div>

        {/* Venue */}
        {hall && (
          <div className="space-y-3 border-t dark:border-gray-700 px-6 py-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t('venue')}
            </h4>
            <DetailRow label={t('hallLabel')} value={hall.name} />
            {hall.address && (
              <DetailRow label={t('address')} value={[hall.address, hall.city].filter(Boolean).join(', ')} />
            )}
            {hall.maps_url && sanitizeUrl(hall.maps_url) && (
              <div className="flex items-start gap-3 text-sm">
                <span className="w-28 shrink-0 text-gray-500 dark:text-gray-400">{t('map')}</span>
                <a
                  href={sanitizeUrl(hall.maps_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:underline dark:text-brand-400"
                >
                  Google Maps ↗
                </a>
              </div>
            )}
          </div>
        )}

        {/* Referees */}
        {game.referees_json && game.referees_json.length > 0 && (
          <div className="space-y-3 border-t dark:border-gray-700 px-6 py-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t('referees')}
            </h4>
            {game.referees_json.map((ref, i) => (
              <DetailRow key={i} label={t((['referee1st', 'referee2nd', 'referee3rd'] as const)[i] ?? 'referee')} value={ref.name} />
            ))}
          </div>
        )}

        {/* Scorer duties — Volleyball */}
        {kscwSport !== 'basketball' &&
        (game.scorer_member || game.scoreboard_member || game.scorer_scoreboard_member ||
          game.scorer_person || game.scoreboard_person) && (
          <div className="space-y-3 border-t dark:border-gray-700 px-6 py-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t('scorerDuties')}
            </h4>
            {expanded.expand?.scorer_scoreboard_member ? (
              <DutyPersonRow
                label={t('scorerTaefeler')}
                member={expanded.expand.scorer_scoreboard_member}
                dutyTeam={expanded.expand.scorer_scoreboard_duty_team}
                showContact={showScorerContact}
              />
            ) : (
              <>
                {(expanded.expand?.scorer_member || game.scorer_person) && (
                  <DutyPersonRow
                    label={t('scorer')}
                    member={expanded.expand?.scorer_member}
                    fallbackName={game.scorer_person}
                    dutyTeam={expanded.expand?.scorer_duty_team}
                    showContact={showScorerContact}
                  />
                )}
                {(expanded.expand?.scoreboard_member || game.scoreboard_person) && (
                  <DutyPersonRow
                    label={t('scoreboard')}
                    member={expanded.expand?.scoreboard_member}
                    fallbackName={game.scoreboard_person}
                    dutyTeam={expanded.expand?.scoreboard_duty_team}
                    showContact={showScorerContact}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* Scorer duties — Basketball */}
        {kscwSport === 'basketball' &&
        (game.bb_scorer_member || game.bb_timekeeper_member || game.bb_24s_official || game.bb_duty_team || game.bb_scorer_duty_team || game.bb_timekeeper_duty_team || game.bb_24s_duty_team) && (
          <div className="space-y-3 border-t dark:border-gray-700 px-6 py-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t('officialsDuties')}
            </h4>
            {(expanded.expand?.bb_scorer_member || game.bb_scorer_member) && (
              <DutyPersonRow
                label={t('bbScorer')}
                member={expanded.expand?.bb_scorer_member}
                dutyTeam={expanded.expand?.bb_scorer_duty_team ?? expanded.expand?.bb_duty_team}
                showContact={showScorerContact}
              />
            )}
            {(expanded.expand?.bb_timekeeper_member || game.bb_timekeeper_member) && (
              <DutyPersonRow
                label={t('bbTimekeeper')}
                member={expanded.expand?.bb_timekeeper_member}
                dutyTeam={expanded.expand?.bb_timekeeper_duty_team ?? expanded.expand?.bb_duty_team}
                showContact={showScorerContact}
              />
            )}
            {(expanded.expand?.bb_24s_official || game.bb_24s_official) && (
              <DutyPersonRow
                label={t('bb24sOfficial')}
                member={expanded.expand?.bb_24s_official}
                dutyTeam={expanded.expand?.bb_24s_duty_team ?? expanded.expand?.bb_duty_team}
                showContact={showScorerContact}
              />
            )}
          </div>
        )}

        {/* Participation details (roster, deadline — coach only) */}
        {game.status === 'scheduled' && (
          <div className="space-y-3 border-t dark:border-gray-700 px-6 py-4">
            {game.respond_by && !editingDeadline && (
              <DetailRow label={t('respondBy')} value={formatDate(game.respond_by.split(' ')[0])} />
            )}
            {!readOnly && isCoachOf(game.kscw_team) && (
              editingDeadline ? (
                <div className="flex items-center gap-2">
                  <DatePicker
                    value={deadlineValue}
                    onChange={setDeadlineValue}
                    max={game.date?.split(' ')[0]}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={async () => {
                      await updateGame(game.id, { respond_by: deadlineValue || null })
                      setEditingDeadline(false)
                    }}
                  >
                    OK
                  </Button>
                  <button
                    onClick={() => setEditingDeadline(false)}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setDeadlineValue(game.respond_by?.split(' ')[0] ?? '')
                    setEditingDeadline(true)
                  }}
                  className="text-xs text-brand-600 hover:underline dark:text-brand-400"
                >
                  {t('setDeadline')}
                </button>
              )
            )}
            <Button
              variant="secondary"
              onClick={() => setRosterOpen(true)}
              className="w-full"
            >
              {t('participationRoster')}
            </Button>
          </div>
        )}
      </div>
    </div>
    <ParticipationRosterModal
      open={rosterOpen}
      onClose={() => setRosterOpen(false)}
      activityType="game"
      activityId={game?.id ?? ''}
      activityDate={game?.date ?? ''}
      teamId={game?.kscw_team ?? null}
      title={t('participationRoster')}
      respondBy={game?.respond_by}
      activityStartTime={game?.time}
    />
    </>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="w-28 shrink-0 text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  )
}

function DutyPersonRow({ label, member, fallbackName, dutyTeam, showContact }: {
  label: string
  member?: (Member & RecordModel) | null
  fallbackName?: string
  dutyTeam?: (Team & RecordModel) | null
  showContact: boolean
}) {
  const name = member
    ? `${member.first_name} ${member.last_name}`
    : fallbackName ?? ''
  const teamName = dutyTeam?.name

  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="w-28 shrink-0 text-gray-500 dark:text-gray-400">{label}</span>
      <div>
        <span className="flex items-center gap-1.5 text-gray-900 dark:text-gray-100">
          {name}
          {teamName && <TeamChip team={teamName} size="xs" />}
        </span>
        {showContact && member && ((!member.hide_phone && member.phone) || member.email) && (
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500 dark:text-gray-400">
            {!member.hide_phone && member.phone && (
              <a href={`tel:${member.phone}`} className="hover:text-brand-600 dark:hover:text-brand-400">{member.phone}</a>
            )}
            {member.email && (
              <a href={`mailto:${member.email}`} className="hover:text-brand-600 dark:hover:text-brand-400">{member.email}</a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
