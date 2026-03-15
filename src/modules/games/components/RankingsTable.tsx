import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Ranking } from '../../../types'
import TeamChip from '../../../components/TeamChip'
import Modal from '../../../components/Modal'
import { teamIds } from '../../../utils/teamColors'
import { getPromotionColor, promotionBorderColors } from '../../../utils/leaguePromotion'
import { formatNumberSwiss } from '../../../utils/formatNumber'

interface RankingsTableProps {
  league: string
  rankings: Ranking[]
}

export default function RankingsTable({ league, rankings }: RankingsTableProps) {
  const { t } = useTranslation('games')
  const sorted = [...rankings].sort((a, b) => a.rank - b.rank)
  const isBasketball = rankings.some((r) => r.team_id.startsWith('bb_'))
  const totalTeams = sorted.length
  const [breakdown, setBreakdown] = useState<{ row: Ranking; mode: 'win' | 'loss' } | null>(null)

  function getTeamLabel(row: Ranking): string {
    const kscwTeam = teamIds[row.team_id]
    return kscwTeam ? `KSC Wiedikon ${kscwTeam}` : (row.team_name || `Team ${row.team_id}`)
  }

  function hasBreakdownData(row: Ranking): boolean {
    return (
      typeof row.wins_clear === 'number'
      && typeof row.wins_narrow === 'number'
      && typeof row.defeats_clear === 'number'
      && typeof row.defeats_narrow === 'number'
    )
  }

  const winsClear = breakdown?.row.wins_clear ?? 0
  const winsNarrow = breakdown?.row.wins_narrow ?? 0
  const lossesClear = breakdown?.row.defeats_clear ?? 0
  const lossesNarrow = breakdown?.row.defeats_narrow ?? 0

  return (
    <>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-card overflow-hidden">
        <div className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{league}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b dark:border-gray-700 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="w-8 px-2 py-2.5 text-center">{t('rank')}</th>
                <th className="w-10 px-2 py-2.5 text-center">{t('points')}</th>
                <th className="px-2 py-2.5">{t('teamCol')}</th>
                <th className="w-10 px-2 py-2.5 text-center">{t('played')}</th>
                <th className={`w-10 px-2 py-2.5 text-center ${isBasketball ? 'hidden sm:table-cell' : ''}`}>{t('won')}</th>
                <th className={`w-10 px-2 py-2.5 text-center ${isBasketball ? 'hidden sm:table-cell' : ''}`}>{t('lost')}</th>
                {isBasketball ? (
                  <>
                    <th className="w-16 px-2 py-2.5 text-center">{t('pointsFor')}:{t('pointsAgainst')}</th>
                  </>
                ) : (
                  <>
                    <th className="hidden w-14 px-2 py-2.5 text-center sm:table-cell">{t('sets')}</th>
                    <th className="hidden w-16 px-2 py-2.5 text-center lg:table-cell">{t('pointsFor')}:{t('pointsAgainst')}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sorted.map((row) => {
                const kscwTeam = teamIds[row.team_id]
                const isKscw = !!kscwTeam
                const promoColor = getPromotionColor(league, row.rank, totalTeams, row.team_name)
                const promoBorder = promoColor ? promotionBorderColors[promoColor] : ''
                const canShowBreakdown = !isBasketball && hasBreakdownData(row)

                return (
                  <tr
                    key={row.id}
                    className={`${isKscw ? 'bg-brand-50 dark:bg-brand-900/20 font-semibold' : ''} ${promoBorder}`}
                  >
                    <td className="px-2 py-2 text-center text-gray-500 dark:text-gray-400">{row.rank}</td>
                    <td className="px-2 py-2 text-center font-bold text-gray-900 dark:text-gray-100">{row.points}</td>
                    <td className="max-w-0 px-2 py-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isKscw ? (
                          <TeamChip team={kscwTeam} label={`KSC Wiedikon ${kscwTeam}`} size="sm" />
                        ) : (
                          <span className="truncate text-gray-700 dark:text-gray-300">
                            {row.team_name || `Team ${row.team_id}`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{row.played}</td>
                    <td className={`px-2 py-2 text-center text-green-600 dark:text-green-400 ${isBasketball ? 'hidden sm:table-cell' : ''}`}>
                      {canShowBreakdown ? (
                        <>
                          <button
                            type="button"
                            className="mx-auto min-h-[36px] rounded px-1.5 hover:bg-gray-100 sm:hidden dark:hover:bg-gray-700"
                            onClick={() => setBreakdown({ row, mode: 'win' })}
                            aria-label={`${t('won')} ${getTeamLabel(row)}`}
                          >
                            {row.won}
                          </button>
                          <div className="hidden flex-col items-center leading-tight sm:flex">
                            <span>{row.won}</span>
                            <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400">
                              {canShowBreakdown ? `${row.wins_clear ?? 0}/${row.wins_narrow ?? 0}` : '-/-'}
                            </span>
                          </div>
                        </>
                      ) : row.won}
                    </td>
                    <td className={`px-2 py-2 text-center text-red-500 dark:text-red-400 ${isBasketball ? 'hidden sm:table-cell' : ''}`}>
                      {canShowBreakdown ? (
                        <>
                          <button
                            type="button"
                            className="mx-auto min-h-[36px] rounded px-1.5 hover:bg-gray-100 sm:hidden dark:hover:bg-gray-700"
                            onClick={() => setBreakdown({ row, mode: 'loss' })}
                            aria-label={`${t('lost')} ${getTeamLabel(row)}`}
                          >
                            {row.lost}
                          </button>
                          <div className="hidden flex-col items-center leading-tight sm:flex">
                            <span>{row.lost}</span>
                            <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400">
                              {canShowBreakdown ? `${row.defeats_clear ?? 0}/${row.defeats_narrow ?? 0}` : '-/-'}
                            </span>
                          </div>
                        </>
                      ) : row.lost}
                    </td>
                    {isBasketball ? (
                      <>
                        <td className="px-2 py-2 text-center text-gray-700 dark:text-gray-300">
                          {formatNumberSwiss(row.points_won)}:{formatNumberSwiss(row.points_lost)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="hidden px-2 py-2 text-center text-gray-700 dark:text-gray-300 sm:table-cell">
                          {row.sets_won}:{row.sets_lost}
                        </td>
                        <td className="hidden px-2 py-2 text-center text-gray-700 dark:text-gray-300 lg:table-cell">
                          {formatNumberSwiss(row.points_won)}:{formatNumberSwiss(row.points_lost)}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Modal
        open={!!breakdown}
        onClose={() => setBreakdown(null)}
        title={breakdown ? `${getTeamLabel(breakdown.row)} - ${breakdown.mode === 'win' ? t('won') : t('lost')}` : ''}
        size="sm"
      >
        {!breakdown ? null : !hasBreakdownData(breakdown.row) ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('breakdownUnavailable')}</p>
        ) : (
          <div className="space-y-3">
            {breakdown.mode === 'win' ? (
              <>
                <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
                  <span className="text-gray-700 dark:text-gray-200">{t('winsClear')}</span>
                  <strong className="text-gray-900 dark:text-gray-100">{winsClear}</strong>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
                  <span className="text-gray-700 dark:text-gray-200">{t('winsNarrow')}</span>
                  <strong className="text-gray-900 dark:text-gray-100">{winsNarrow}</strong>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-700/40">
                  <span className="text-gray-700 dark:text-gray-200">{t('breakdownTotal')}</span>
                  <strong className="text-gray-900 dark:text-gray-100">{breakdown.row.won}</strong>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
                  <span className="text-gray-700 dark:text-gray-200">{t('lossesClear')}</span>
                  <strong className="text-gray-900 dark:text-gray-100">{lossesClear}</strong>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
                  <span className="text-gray-700 dark:text-gray-200">{t('lossesNarrow')}</span>
                  <strong className="text-gray-900 dark:text-gray-100">{lossesNarrow}</strong>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-700/40">
                  <span className="text-gray-700 dark:text-gray-200">{t('breakdownTotal')}</span>
                  <strong className="text-gray-900 dark:text-gray-100">{breakdown.row.lost}</strong>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
