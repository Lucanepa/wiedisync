import { useTranslation } from 'react-i18next'
import type { RecordModel } from 'pocketbase'
import type { Game, Team, Hall } from '../../../types'
import { formatDateCompact, formatTime } from '../../../utils/dateHelpers'
import { leagueShort } from '../../../utils/leagueShort'
import TeamChip from '../../../components/TeamChip'
import { pbNameToColorKey } from '../../../utils/teamColors'
import VolleyballIcon from '../../../components/VolleyballIcon'
import BasketballIcon from '../../../components/BasketballIcon'
import ParticipationSummary from '../../../components/ParticipationSummary'
import { useAuth } from '../../../hooks/useAuth'
import { useParticipation } from '../../../hooks/useParticipation'

function parseSets(json: unknown): Array<{ home: number; away: number }> {
  if (!Array.isArray(json)) return []
  return json.filter(
    (s): s is { home: number; away: number } =>
      typeof s === 'object' && s !== null && 'home' in s && 'away' in s,
  )
}

interface GameCardProps {
  game: Game
  onClick?: (game: Game) => void
  variant?: 'card' | 'compact'
}

type ExpandedGame = Game & {
  expand?: {
    kscw_team?: Team & RecordModel
    hall?: Hall & RecordModel
  }
}

function StatusBadge({ status }: { status: Game['status'] }) {
  const { t } = useTranslation('games')

  switch (status) {
    case 'live':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          {t('statusLive')}
        </span>
      )
    case 'postponed':
      return (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
          {t('statusPostponed')}
        </span>
      )
    case 'completed':
      return (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
          {t('statusCompleted')}
        </span>
      )
    default:
      return null
  }
}

export default function GameCard({ game, onClick, variant = 'card' }: GameCardProps) {
  const { t } = useTranslation('games')
  const { user, canParticipateIn } = useAuth()
  const canParticipate = !!user && !!game.kscw_team && canParticipateIn(game.kscw_team)
  const expanded = game as ExpandedGame
  const expandedHall = expanded.expand?.hall
  const hallInfo = expandedHall
    ? [expandedHall.name, expandedHall.city].filter(Boolean).join(', ')
    : game.away_hall_json
      ? [game.away_hall_json.name, game.away_hall_json.city].filter(Boolean).join(', ')
      : ''
  const rawTeamName = expanded.expand?.kscw_team?.name ?? ''
  const teamSport = expanded.expand?.kscw_team?.sport as 'volleyball' | 'basketball' | undefined
  const kscwTeamName = rawTeamName && teamSport ? pbNameToColorKey(rawTeamName, teamSport) : rawTeamName

  if (variant === 'compact') {
    const short = game.date ? formatDateCompact(game.date) : ''
    const hasScore = game.status === 'completed' || game.status === 'live'
    const homeWon = Number(game.home_score) > Number(game.away_score)
    const awayWon = Number(game.away_score) > Number(game.home_score)
    const kscwWon = game.type === 'home' ? homeWon : awayWon
    const kscwLost = game.type === 'home' ? awayWon : homeWon
    const sets = parseSets(game.sets_json)

    return (
      <>
        {/* Mobile: flex row */}
        <div
          onClick={() => onClick?.(game)}
          className={`border-b border-gray-100 dark:border-gray-700 md:hidden ${onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : ''}`}
        >
          <div className="flex items-center gap-2 px-4 py-2.5">
            <div className="w-16 shrink-0 text-xs text-gray-500 dark:text-gray-400">
              <div>{short}</div>
              {game.time && <div>{formatTime(game.time)}</div>}
            </div>
            {expanded.expand?.kscw_team?.sport === 'basketball'
              ? <BasketballIcon className="h-5 w-5 shrink-0" filled />
              : <VolleyballIcon className="h-5 w-5 shrink-0" filled />}
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm text-gray-900 dark:text-gray-100 ${game.type === 'home' ? 'font-bold' : ''}`}>
                {game.home_team}
              </p>
              <p className={`truncate text-sm text-gray-900 dark:text-gray-100 ${game.type === 'away' ? 'font-bold' : ''}`}>
                {game.away_team}
              </p>
            </div>
            {hasScore && (
              <div className="shrink-0 text-right font-mono text-sm font-bold leading-snug">
                <div className={game.type === 'home' ? (kscwWon ? 'text-green-500' : kscwLost ? 'text-red-500' : 'text-gray-400') : 'text-gray-400'}>{game.home_score}</div>
                <div className={game.type === 'away' ? (kscwWon ? 'text-green-500' : kscwLost ? 'text-red-500' : 'text-gray-400') : 'text-gray-400'}>{game.away_score}</div>
              </div>
            )}
            {game.status !== 'completed' && <StatusBadge status={game.status} />}
          </div>
        </div>

        {/* Desktop: uses display:contents so cells participate in parent grid */}
        <div
          onClick={() => onClick?.(game)}
          className={`col-span-full hidden md:grid md:grid-cols-subgrid items-center gap-x-3 border-b border-gray-100 px-5 py-3 dark:border-gray-700 ${onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : ''}`}
        >
          {/* Col 1: Date + time */}
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <div>{short}</div>
            {game.time && <div>{formatTime(game.time)}</div>}
          </div>

          {/* Col 2: Sport icon */}
          <div>
            {expanded.expand?.kscw_team?.sport === 'basketball'
              ? <BasketballIcon className="h-5 w-5" filled />
              : <VolleyballIcon className="h-5 w-5" filled />}
          </div>

          {/* Col 3: Team chip */}
          <div>
            {kscwTeamName ? <TeamChip team={kscwTeamName} size="xs" /> : null}
          </div>

          {/* Col 4: Total score (left of team names) */}
          <div className="text-right font-mono text-sm font-bold">
            {hasScore ? (
              <>
                <p className={`leading-5 ${game.type === 'home' ? (kscwWon ? 'text-green-500' : kscwLost ? 'text-red-500' : 'text-gray-400') : 'text-gray-400'}`}>{game.home_score}</p>
                <p className={`leading-5 ${game.type === 'away' ? (kscwWon ? 'text-green-500' : kscwLost ? 'text-red-500' : 'text-gray-400') : 'text-gray-400'}`}>{game.away_score}</p>
              </>
            ) : (
              game.status !== 'completed' && <StatusBadge status={game.status} />
            )}
          </div>

          {/* Col 5: Team names */}
          <div className="min-w-0">
            <p className={`truncate text-sm leading-5 text-gray-900 dark:text-gray-100 ${game.type === 'home' ? 'font-bold' : ''}`}>
              {game.home_team}
            </p>
            <p className={`truncate text-sm leading-5 text-gray-900 dark:text-gray-100 ${game.type === 'away' ? 'font-bold' : ''}`}>
              {game.away_team}
            </p>
          </div>

          {/* Col 6: Set scores */}
          <div className="flex items-center gap-1">
            {hasScore && sets.length > 0 && sets.map((s, i) => {
              const homeSetWon = s.home > s.away
              return (
                <span
                  key={i}
                  className={`rounded px-1.5 py-0.5 text-xs font-mono tabular-nums ${
                    homeSetWon === (game.type === 'home')
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}
                >
                  {s.home}:{s.away}
                </span>
              )
            })}
          </div>

          {/* Col 7: League */}
          <div>
            {game.league && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                {leagueShort(game.league)}
              </span>
            )}
          </div>

          {/* Col 8: Hall */}
          <div className="truncate text-xs text-gray-500 dark:text-gray-400">
            {hallInfo}
          </div>
        </div>
      </>
    )
  }

  return (
    <div
      onClick={() => onClick?.(game)}
      className={`overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-card transition-shadow ${onClick ? 'cursor-pointer hover:shadow-card-hover' : ''}`}
    >
      {/* H/A badge + counters top-right */}
      <div className="flex items-center justify-end gap-2">
        {game.status === 'scheduled' && (
          <ParticipationSummary activityType="game" activityId={game.id} compact />
        )}
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold leading-none ${
          game.type === 'home'
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
            : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
        }`}>
          {game.type === 'home' ? t('typeHomeShort') : t('typeAwayShort')}
        </span>
      </div>

      <div className="flex gap-3">
        {/* Left: date, time, league, chip */}
        <div className="w-20 shrink-0 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">
          <div className="font-medium text-gray-700 dark:text-gray-300">{game.date ? formatDateCompact(game.date) : ''}</div>
          {game.time && <div>{formatTime(game.time)}</div>}
          <div className="whitespace-pre-line">{leagueShort(game.league)}</div>
          {kscwTeamName && (
            <div className="flex items-center gap-1 pt-0.5">
              {expanded.expand?.kscw_team?.sport === 'basketball'
                ? <BasketballIcon className="h-3.5 w-3.5" filled />
                : <VolleyballIcon className="h-3.5 w-3.5" filled />}
              <TeamChip team={kscwTeamName} size="xs" />
            </div>
          )}
        </div>

        {/* Right: teams stacked + hall */}
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm text-gray-900 dark:text-gray-100 ${game.type === 'home' ? 'font-bold' : ''}`}>
            {game.home_team}
          </p>
          <p className={`truncate text-sm text-gray-900 dark:text-gray-100 ${game.type === 'away' ? 'font-bold' : ''}`}>
            {game.away_team}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={game.status} />
            {hallInfo && <span className="truncate text-xs text-gray-500 dark:text-gray-400">{hallInfo}</span>}
          </div>
          {game.status === 'scheduled' && canParticipate && (
            <div className="mt-1.5">
              <GameCardParticipation game={game} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function GameCardParticipation({ game }: { game: Game }) {
  const { t } = useTranslation('participation')
  const { isStaffOnly } = useAuth()
  const staffOnly = !!game.kscw_team && isStaffOnly(game.kscw_team)
  const { effectiveStatus, setStatus } = useParticipation('game', game.id, game.date, undefined, staffOnly)

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={(e) => { e.stopPropagation(); setStatus('confirmed') }}
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
          effectiveStatus === 'confirmed'
            ? 'bg-green-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-green-900/30 dark:hover:text-green-400'
        }`}
      >
        {t('yes')}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setStatus('tentative') }}
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
          effectiveStatus === 'tentative'
            ? 'bg-yellow-500 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-yellow-100 hover:text-yellow-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-yellow-900/30 dark:hover:text-yellow-400'
        }`}
      >
        {t('maybe')}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setStatus('declined') }}
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
          effectiveStatus === 'declined'
            ? 'bg-red-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-red-900/30 dark:hover:text-red-400'
        }`}
      >
        {t('no')}
      </button>
    </div>
  )
}
