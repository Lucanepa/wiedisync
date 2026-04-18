import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3 } from 'lucide-react'
import { useAttendanceStats } from './useAttendanceStats'
import EmptyState from '../../components/EmptyState'
import { getCurrentSeason, parseWallClock } from '../../utils/dateHelpers'

interface CoachDashboardProps {
  teamId: string
}

const trendColors: Record<string, string> = {
  present: 'bg-green-500',
  absent: 'bg-red-500',
  excused: 'bg-brand-500',
}

export default function CoachDashboard({ teamId }: CoachDashboardProps) {
  const { t } = useTranslation('trainings')
  const [season, setSeason] = useState(getCurrentSeason())
  const { stats, isLoading } = useAttendanceStats(teamId, season)

  // Generate season options (current + previous 2)
  const currentSeason = getCurrentSeason()
  const startYear = parseInt(currentSeason.split('/')[0])
  const seasonOptions = [0, 1, 2].map((offset) => {
    const y = startYear - offset
    return `${y}/${String(y + 1).slice(2)}`
  })

  if (isLoading) {
    return <div className="py-8 text-center text-gray-500 dark:text-gray-400">{t('common:loading')}</div>
  }

  return (
    <div data-tour="attendance-stats">
      <div className="mb-6 flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('seasonLabel')}</label>
        <select
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          className="rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-1.5 text-sm"
        >
          {seasonOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {stats.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-10 w-10" />}
          title={t('noDataAvailable')}
          description={t('noDataDescription')}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block mx-auto w-fit max-w-full overflow-x-auto rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800">
            <table>
              <thead>
                <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-400">
                  <th className="min-w-[150px] px-4 py-3">{t('playerCol')}</th>
                  <th className="px-4 py-3 text-center">{t('numberCol')}</th>
                  <th className="px-4 py-3 text-center">{t('trainingsCol')}</th>
                  <th className="px-4 py-3 text-center">{t('presentCol')}</th>
                  <th className="px-4 py-3 text-center">{t('absentCol')}</th>
                  <th className="px-4 py-3 text-center">{t('rateCol')}</th>
                  <th className="px-4 py-3">{t('trendCol')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((player) => (
                  <tr key={player.memberId} className="border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700">
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
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden divide-y divide-gray-200 dark:divide-gray-700 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800">
            {stats.map((player) => (
              <div key={player.memberId} className="px-4 py-3">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {player.memberName || '—'}
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>{t('trainingsCol')}: <span className="text-gray-700 dark:text-gray-300">{player.total}</span></span>
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
                    {parseWallClock(player.lastResponseAt).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })}{' '}
                    {parseWallClock(player.lastResponseAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
