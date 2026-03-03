import { useTranslation } from 'react-i18next'
import type { RecordModel } from 'pocketbase'
import type { Game, Team, Hall } from '../../../types'
import { formatDateCompact } from '../../../utils/dateHelpers'
import TeamChip from '../../../components/TeamChip'

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
      className={`overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-sm transition-shadow ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
    >
      <div className="flex gap-3">
        {/* Left: date, time, halle, league */}
        <div className="w-20 shrink-0 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">
          <div className="font-medium text-gray-700 dark:text-gray-300">{game.date ? formatDateCompact(game.date) : ''}</div>
          {game.time && <div>{game.time}</div>}
          {hallInfo && <div className="truncate">{hallInfo}</div>}
          <div className="truncate">{game.league}</div>
        </div>

        {/* Right: teams stacked + chips */}
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm text-gray-900 dark:text-gray-100 ${game.type === 'home' ? 'font-bold' : ''}`}>
            {game.home_team}
          </p>
          <p className={`truncate text-sm text-gray-900 dark:text-gray-100 ${game.type === 'away' ? 'font-bold' : ''}`}>
            {game.away_team}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <StatusBadge status={game.status} />
            {kscwTeamName && <TeamChip team={kscwTeamName} size="sm" />}
          </div>
        </div>
      </div>
    </div>
  )
}
