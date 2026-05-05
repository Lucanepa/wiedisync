import React from 'react'
import { useTranslation } from 'react-i18next'
import { formatDateZurich, formatTimeZurich } from '../utils/dateHelpers'
import type { PlayerStats } from '../modules/trainings/useAttendanceStats'

interface AttendanceTableProps {
  stats: PlayerStats[]
  /** Optional drilldown: when provided, rows are clickable. */
  onPlayerClick?: (memberId: string) => void
  /** Currently expanded player id (only used when onPlayerClick + renderDrilldown are set). */
  expandedPlayerId?: string | null
  /** Renderer for the drilldown body — placed inline below the row on desktop, in a sheet on mobile (sheet handled by caller). */
  renderDrilldown?: (memberId: string) => React.ReactNode
  /** i18n namespace to read column labels from (default: 'trainings'). */
  namespace?: string
  /** Activities-count column label key (default: 'trainingsCol'). */
  countColKey?: string
}

const trendColors: Record<string, string> = {
  present: 'bg-green-500',
  absent: 'bg-red-500',
}

export default function AttendanceTable({
  stats,
  onPlayerClick,
  expandedPlayerId,
  renderDrilldown,
  namespace = 'trainings',
  countColKey = 'trainingsCol',
}: AttendanceTableProps) {
  const { t } = useTranslation(namespace)
  const isClickable = !!onPlayerClick

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block mx-auto w-fit max-w-full overflow-x-auto rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800">
        <table>
          <thead>
            <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-400">
              <th className="min-w-[150px] px-4 py-3">{t('playerCol')}</th>
              <th className="px-4 py-3 text-center">{t('numberCol')}</th>
              <th className="px-4 py-3 text-center">{t(countColKey)}</th>
              <th className="px-4 py-3 text-center">{t('presentCol')}</th>
              <th className="px-4 py-3 text-center">{t('absentCol')}</th>
              <th className="px-4 py-3 text-center">{t('rateCol')}</th>
              <th className="px-4 py-3">{t('trendCol')}</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((player) => {
              const expanded = expandedPlayerId === player.memberId
              return (
                <React.Fragment key={player.memberId}>
                  <tr
                    onClick={isClickable ? () => onPlayerClick!(player.memberId) : undefined}
                    className={`border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      isClickable ? 'cursor-pointer' : ''
                    } ${expanded ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                  >
                    <td className="min-w-[150px] whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {player.memberName || '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                      {player.jerseyNumber || '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                      {player.total}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-green-600">
                      {player.present}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-red-600">
                      {player.absent}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                          player.percentage >= 80
                            ? 'bg-green-100 text-green-800'
                            : player.percentage >= 50
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {player.percentage}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {player.trend.map((status, i) => (
                          <div
                            key={i}
                            className={`h-3 w-3 rounded-full ${trendColors[status] ?? 'bg-gray-300'}`}
                            title={status}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                  {expanded && renderDrilldown && (
                    <tr>
                      <td colSpan={7} className="bg-gray-50 dark:bg-gray-900 px-4 py-3">
                        {renderDrilldown(player.memberId)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile compact list */}
      <div className="sm:hidden divide-y divide-gray-200 dark:divide-gray-700 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800">
        {stats.map((player) => (
          <button
            key={player.memberId}
            type="button"
            onClick={isClickable ? () => onPlayerClick!(player.memberId) : undefined}
            className={`w-full text-left px-4 py-3 ${isClickable ? 'cursor-pointer active:bg-gray-100 dark:active:bg-gray-700' : ''}`}
          >
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {player.memberName || '—'}
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span>{t(countColKey)}: <span className="text-gray-700 dark:text-gray-300">{player.total}</span></span>
              <span>{t('presentCol')}: <span className="text-green-600">{player.present}</span></span>
              <span>{t('absentCol')}: <span className="text-red-600">{player.absent}</span></span>
              <span
                className={`inline-block rounded-full px-1.5 py-0.5 font-bold ${
                  player.percentage >= 80
                    ? 'bg-green-100 text-green-800'
                    : player.percentage >= 50
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                }`}
              >
                {player.percentage}%
              </span>
            </div>
            {player.lastResponseAt && (
              <div className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                {formatDateZurich(player.lastResponseAt)}{' '}
                {formatTimeZurich(player.lastResponseAt)}
              </div>
            )}
          </button>
        ))}
      </div>
    </>
  )
}
