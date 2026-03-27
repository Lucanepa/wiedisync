import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import type { RefereeExpense, Game, Team, Member, BaseRecord } from '../../types'
import { usePB } from '../../hooks/usePB'
import TeamChip from '../../components/TeamChip'
import { pbNameToColorKey } from '../../utils/teamColors'
import { formatDate } from '../../utils/dateHelpers'

type ExpandedExpense = RefereeExpense & {
  expand?: {
    game?: Game & BaseRecord
    team?: Team & BaseRecord
    paid_by_member?: Member & BaseRecord
  }
}

export default function RefereeExpensesPage() {
  const { t } = useTranslation('admin')
  const [teamFilter, setTeamFilter] = useState('')
  const [seasonFilter, setSeasonFilter] = useState('')

  // Fetch all volleyball teams for filter dropdown
  const { data: vbTeams } = usePB<Team & BaseRecord>('teams', {
    filter: 'sport="volleyball" && active=true',
    sort: 'name',
    all: true,
  })

  // Build filter
  const filter = useMemo(() => {
    const parts: string[] = []
    if (teamFilter) parts.push(`team="${teamFilter}"`)
    if (seasonFilter) parts.push(`game.season="${seasonFilter}"`)
    return parts.join(' && ')
  }, [teamFilter, seasonFilter])

  // Fetch expenses
  const { data: expenses, isLoading } = usePB<ExpandedExpense>('referee_expenses', {
    filter,
    expand: 'game,team,paid_by_member',
    sort: '-created',
    all: true,
  })

  // Extract unique seasons from game data
  const seasons = useMemo(() => {
    const s = new Set<string>()
    expenses.forEach((e) => {
      if (e.expand?.game?.season) s.add(e.expand.game.season)
    })
    return Array.from(s).sort().reverse()
  }, [expenses])

  const exportCsv = () => {
    const header = ['Date', 'Home Team', 'Away Team', 'League', 'KSCW Team', 'Paid By', 'Amount (CHF)', 'Notes']
    const rows = expenses.map((e) => {
      const game = e.expand?.game
      const paidBy = e.expand?.paid_by_member
        ? `${e.expand.paid_by_member.first_name} ${e.expand.paid_by_member.last_name}`
        : e.paid_by_other || ''
      return [
        game?.date ? formatDate(game.date) : '',
        game?.home_team || '',
        game?.away_team || '',
        game?.league || '',
        e.expand?.team?.name || '',
        paidBy,
        e.amount ? e.amount.toFixed(2) : '',
        e.notes || '',
      ]
    })
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `referee-expenses${seasonFilter ? `-${seasonFilter}` : ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('refereeExpensesTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('refereeExpensesDescription')}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="rounded-md border border-gray-200 bg-transparent px-3 py-2 text-sm dark:border-gray-600 dark:text-gray-100"
        >
          <option value="">{t('refereeExpensesAllTeams')}</option>
          {vbTeams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>

        <select
          value={seasonFilter}
          onChange={(e) => setSeasonFilter(e.target.value)}
          className="rounded-md border border-gray-200 bg-transparent px-3 py-2 text-sm dark:border-gray-600 dark:text-gray-100"
        >
          <option value="">{t('refereeExpensesAllSeasons')}</option>
          {seasons.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <button
          onClick={exportCsv}
          disabled={expenses.length === 0}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <Download className="h-4 w-4" />
          {t('refereeExpensesExport')}
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">…</div>
      ) : expenses.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">{t('refereeExpensesNoRecords')}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                <th className="px-4 py-3">{t('refereeExpensesDate')}</th>
                <th className="px-4 py-3">{t('refereeExpensesGame')}</th>
                <th className="px-4 py-3">{t('refereeExpensesTeam')}</th>
                <th className="px-4 py-3">{t('refereeExpensesPaidBy')}</th>
                <th className="px-4 py-3 text-right">{t('refereeExpensesAmount')}</th>
                <th className="px-4 py-3">{t('refereeExpensesNotes')}</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => {
                const game = expense.expand?.game
                const team = expense.expand?.team
                const teamKey = team?.name && team?.sport
                  ? pbNameToColorKey(team.name, team.sport)
                  : team?.name || ''
                const paidBy = expense.expand?.paid_by_member
                  ? `${expense.expand.paid_by_member.first_name} ${expense.expand.paid_by_member.last_name}`
                  : expense.paid_by_other || '–'

                return (
                  <tr
                    key={expense.id}
                    className="border-b last:border-b-0 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-gray-900 dark:text-gray-100">
                      {game?.date ? formatDate(game.date) : '–'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {game ? `${game.home_team} vs ${game.away_team}` : '–'}
                    </td>
                    <td className="px-4 py-3">
                      {teamKey && <TeamChip team={teamKey} size="xs" />}
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{paidBy}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {expense.amount > 0 ? `CHF ${expense.amount.toFixed(2)}` : '–'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{expense.notes || '–'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
