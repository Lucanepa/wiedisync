import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchItems, kscwApi } from '../../../lib/api'

interface GameRecord {
  id: string
  date: string
  home_score: number
  away_score: number
  venue: string
  expand?: {
    home_team?: { id: string; name: string }
    away_team?: { id: string; name: string }
  }
}

interface WinLossRow {
  name: string
  wins: number
  losses: number
  ranking_points: number
}

interface ScorerCoverage {
  total: number
  assigned: number
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })
}

function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d} 00:00:00`
}

export default function GamesSeasonSection() {
  const { t } = useTranslation('admin')
  const [upcoming, setUpcoming] = useState<GameRecord[]>([])
  const [recent, setRecent] = useState<GameRecord[]>([])
  const [winLoss, setWinLoss] = useState<WinLossRow[]>([])
  const [scorerCoverage, setScorerCoverage] = useState<ScorerCoverage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const today = new Date()
        const weekLater = new Date(today)
        weekLater.setDate(today.getDate() + 7)

        const todayStr = toDateStr(today)
        const weekLaterStr = toDateStr(weekLater)

        const [upcomingResult, recentResult, winLossResult, scorerResult] = await Promise.all([
          fetchItems<GameRecord>('games', { limit: 10,
            filter: `date >= "${todayStr}" && date <= "${weekLaterStr}"` as any,
            sort: ['date'],
          }),
          fetchItems<GameRecord>('games', { limit: 5,
            filter: `date < "${todayStr}" && (home_score > 0 || away_score > 0)` as any,
            sort: ['-date'],
          }),
          kscwApi('/admin/sql', {
            method: 'POST',
body: {
              query: 'SELECT t.name, r.wins, r.losses, r.ranking_points FROM rankings r JOIN teams t ON r.team = t.id ORDER BY t.name',
            },
          }) as Promise<{ rows: [string, number, number, number][] }>,
          kscwApi('/admin/sql', {
            method: 'POST',
body: {
              query: "SELECT COUNT(*) as total, COUNT(sa.id) as assigned FROM games g LEFT JOIN scorer_assignments sa ON sa.game = g.id WHERE g.date >= date('now') AND g.source = 'swiss_volley'",
            },
          }) as Promise<{ rows: [number, number][] }>,
        ])

        setUpcoming(upcomingResult)
        setRecent(recentResult)

        if (winLossResult?.rows) {
          const rows: WinLossRow[] = ((winLossResult as any).rows ?? []).map(([name, wins, losses, ranking_points]: [string, number, number, number]) => ({
            name,
            wins: wins ?? 0,
            losses: losses ?? 0,
            ranking_points: ranking_points ?? 0,
          }))
          setWinLoss(rows)
        }

        if ((scorerResult as any)?.rows?.[0]) {
          const [total, assigned] = (scorerResult as any).rows[0]
          setScorerCoverage({ total: total ?? 0, assigned: assigned ?? 0 })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-4 bg-muted rounded w-2/3" />
        <div className="h-4 bg-muted rounded w-1/2" />
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{t('fetchError')}: {error}</p>
  }

  return (
    <div className="space-y-6">
      {/* Upcoming games */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {t('upcomingGames')}
        </h4>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noUpcomingGames')}</p>
        ) : (
          <div className="space-y-1">
            {upcoming.map(game => (
              <div
                key={game.id}
                className="flex items-center gap-3 text-sm py-1 border-b border-border/50 last:border-0"
              >
                <span className="text-muted-foreground tabular-nums w-10 shrink-0">
                  {formatDate(game.date)}
                </span>
                <span className="font-medium truncate">
                  {game.expand?.home_team?.name ?? '?'} vs {game.expand?.away_team?.name ?? '?'}
                </span>
                {game.venue && (
                  <span className="text-xs text-muted-foreground ml-auto shrink-0 truncate max-w-[100px]">
                    {game.venue}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent results */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {t('recentResults')}
        </h4>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noData')}</p>
        ) : (
          <div className="space-y-1">
            {recent.map(game => (
              <div
                key={game.id}
                className="flex items-center gap-3 text-sm py-1 border-b border-border/50 last:border-0"
              >
                <span className="text-muted-foreground tabular-nums w-10 shrink-0">
                  {formatDate(game.date)}
                </span>
                <span className="truncate">
                  {game.expand?.home_team?.name ?? '?'} vs {game.expand?.away_team?.name ?? '?'}
                </span>
                <span className="font-semibold tabular-nums ml-auto shrink-0">
                  {game.home_score}:{game.away_score}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Win/loss table */}
      {winLoss.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {t('winLossSummary')}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-1.5 pr-3 font-medium">{t('teamName')}</th>
                  <th className="text-right py-1.5 pr-3 font-medium">W</th>
                  <th className="text-right py-1.5 font-medium">L</th>
                </tr>
              </thead>
              <tbody>
                {winLoss.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5 pr-3">{row.name}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-green-600 dark:text-green-400 font-medium">
                      {row.wins}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-red-600 dark:text-red-400 font-medium">
                      {row.losses}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scorer coverage */}
      {scorerCoverage !== null && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            {t('scorerCoverage')}
          </h4>
          <p className="text-sm">
            <span
              className={
                scorerCoverage.total === 0
                  ? 'text-muted-foreground'
                  : scorerCoverage.assigned === scorerCoverage.total
                  ? 'text-green-600 dark:text-green-400 font-medium'
                  : 'text-amber-600 dark:text-amber-400 font-medium'
              }
            >
              {scorerCoverage.assigned} / {scorerCoverage.total}
            </span>
            <span className="text-muted-foreground ml-1">{t('upcomingGames').toLowerCase()}</span>
          </p>
        </div>
      )}
    </div>
  )
}
