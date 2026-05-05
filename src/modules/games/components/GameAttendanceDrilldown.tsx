import { useTranslation } from 'react-i18next'
import { formatDate } from '../../../utils/dateHelpers'
import type { Game } from '../../../types'
import type { GamePlayerStats } from './useGameAttendanceStats'

interface Props {
  memberId: string
  stats: GamePlayerStats[]
  gamesById: Map<string, Game>
}

export default function GameAttendanceDrilldown({ memberId, stats, gamesById }: Props) {
  const { t } = useTranslation('games')
  const player = stats.find((s) => s.memberId === memberId)
  if (!player) return null

  const rows = player.gameStatuses
    .map((gs) => ({ gs, game: gamesById.get(gs.gameId) }))
    .filter((r): r is { gs: typeof r.gs; game: Game } => !!r.game)
    .sort((a, b) => a.gs.dateKey.localeCompare(b.gs.dateKey))

  if (rows.length === 0) {
    return <p className="text-xs text-gray-500 dark:text-gray-400">{t('drilldownEmpty')}</p>
  }

  return (
    <ul className="space-y-1.5 text-xs">
      {rows.map(({ gs, game }) => {
        const opponent = game.type === 'home' ? game.away_team : game.home_team
        const hall = (game.hall as { name?: string } | null | undefined)?.name ?? ''
        const statusLabel = gs.status === 'present' ? t('drilldownStatusConfirmed') : t('drilldownStatusDeclined')
        const statusColor = gs.status === 'present'
          ? 'text-green-700 dark:text-green-400'
          : 'text-red-700 dark:text-red-400'
        return (
          <li key={gs.gameId} className="flex flex-wrap items-center gap-x-2 text-gray-600 dark:text-gray-300">
            <span className="font-medium">{formatDate(gs.dateKey)}</span>
            <span>·</span>
            <span>vs {opponent || '?'}</span>
            {hall && (
              <>
                <span>·</span>
                <span>{hall}</span>
              </>
            )}
            <span>·</span>
            <span className={`font-medium ${statusColor}`}>{statusLabel}</span>
          </li>
        )
      })}
    </ul>
  )
}
