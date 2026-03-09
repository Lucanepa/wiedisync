import { useTranslation } from 'react-i18next'
import type { RecordModel } from 'pocketbase'
import type { Game, Team, Hall } from '../../../types'
import { formatDateCompact } from '../../../utils/dateHelpers'
import { leagueShort } from '../../../utils/leagueShort'
import TeamChip from '../../../components/TeamChip'
import ParticipationSummary from '../../../components/ParticipationSummary'
import { useAuth } from '../../../hooks/useAuth'
import { useParticipation } from '../../../hooks/useParticipation'

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
  const { user, memberTeamIds } = useAuth()
  const canParticipate = !!user && !!game.kscw_team && memberTeamIds.includes(game.kscw_team)
  const expanded = game as ExpandedGame
  const expandedHall = expanded.expand?.hall
  const hallInfo = expandedHall
    ? [expandedHall.name, expandedHall.city].filter(Boolean).join(', ')
    : game.away_hall_json
      ? [game.away_hall_json.name, game.away_hall_json.city].filter(Boolean).join(', ')
      : ''
  const kscwTeamName = expanded.expand?.kscw_team?.name ?? ''

  if (variant === 'compact') {
    const short = game.date ? formatDateCompact(game.date) : ''
    const hasScore = game.status === 'completed' || game.status === 'live'
    const homeWon = Number(game.home_score) > Number(game.away_score)
    const awayWon = Number(game.away_score) > Number(game.home_score)

    return (
      <div
        onClick={() => onClick?.(game)}
        className={`flex items-center gap-3 border-b border-gray-100 px-4 py-2 dark:border-gray-700 ${onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : ''}`}
      >
        {/* Date + time */}
        <div className="w-16 shrink-0 text-xs text-gray-500 dark:text-gray-400">
          <div>{short}</div>
          {game.time && <div>{game.time}</div>}
        </div>

        {/* Team names — stacked */}
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm text-gray-900 dark:text-gray-100 ${game.type === 'home' ? 'font-bold' : ''}`}>
            {game.home_team}
          </p>
          <p className={`truncate text-sm text-gray-900 dark:text-gray-100 ${game.type === 'away' ? 'font-bold' : ''}`}>
            {game.away_team}
          </p>
        </div>

        {/* Vertical score: green for winner, red for loser */}
        {hasScore && (
          <div className="shrink-0 text-right font-mono text-sm font-bold leading-snug">
            <div className={homeWon ? 'text-green-500' : awayWon ? 'text-red-500' : 'text-gray-400'}>
              {game.home_score}
            </div>
            <div className={awayWon ? 'text-green-500' : homeWon ? 'text-red-500' : 'text-gray-400'}>
              {game.away_score}
            </div>
          </div>
        )}

        {/* Only show badge for non-completed states (live, postponed) */}
        {game.status !== 'completed' && <StatusBadge status={game.status} />}
      </div>
    )
  }

  return (
    <div
      onClick={() => onClick?.(game)}
      className={`overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-card transition-shadow ${onClick ? 'cursor-pointer hover:shadow-card-hover' : ''}`}
    >
      {/* H/A badge top-right */}
      <div className="flex justify-end">
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
          {game.time && <div>{game.time}</div>}
          <div className="truncate">{leagueShort(game.league)}</div>
          {kscwTeamName && <div className="pt-0.5"><TeamChip team={kscwTeamName} size="xs" /></div>}
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
          {game.status === 'scheduled' && (
            <div className="mt-1.5 flex items-center gap-2">
              {canParticipate && <GameCardParticipation game={game} />}
              <div className="ml-auto">
                <ParticipationSummary activityType="game" activityId={game.id} compact />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function GameCardParticipation({ game }: { game: Game }) {
  const { t } = useTranslation('participation')
  const { effectiveStatus, hasAbsence, setStatus } = useParticipation('game', game.id, game.date)

  if (hasAbsence) {
    return <span className="text-xs text-gray-500 dark:text-gray-400">{t('absent')}</span>
  }

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
