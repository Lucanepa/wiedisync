import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { countItems, fetchItems, kscwApi } from '../../../lib/api'
import { memberName } from '../../../utils/relations'

interface RsvpRow {
  name: string
  rate: number
}

interface UserLogRecord {
  id: string
  user: string | { id: string; first_name?: string; last_name?: string }
  action: string
  collection_name: string
  created: string
}

function simpleTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '< 1m'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d} 00:00:00`
}

export default function ActivitySection() {
  const { t } = useTranslation('admin')
  const [rsvpRates, setRsvpRates] = useState<RsvpRow[]>([])
  const [notifsToday, setNotifsToday] = useState(0)
  const [notifsWeek, setNotifsWeek] = useState(0)
  const [activityLogs, setActivityLogs] = useState<UserLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const today = new Date()
        const sevenDaysAgo = new Date(today)
        sevenDaysAgo.setDate(today.getDate() - 7)

        const todayStr = toDateStr(today)
        const weekAgoStr = toDateStr(sevenDaysAgo)

        const [rsvpResult, notifsTodayResult, notifsWeekResult, logsResult] = await Promise.all([
          kscwApi('/admin/sql', {
            method: 'POST',
body: {
              query: `SELECT t.name, ROUND(100.0 * COUNT(CASE WHEN p.status != '' THEN 1 END) / MAX(COUNT(p.id), 1), 0) as rate FROM participations p JOIN teams t ON p.team = t.id GROUP BY t.id ORDER BY rate DESC`,
            },
          }) as Promise<{ rows: [string, number][] }>,
          countItems('notifications', { date_created: { _gte: todayStr } }),
          countItems('notifications', { date_created: { _gte: weekAgoStr } }),
          fetchItems<UserLogRecord>('user_logs', { limit: 20,
            sort: ['-date_created'],
            fields: ['user.id', 'user.first_name', 'user.last_name', 'action', 'collection_name', 'created'],
          }),
        ])

        if (rsvpResult?.rows) {
          setRsvpRates(
            (rsvpResult as any).rows.map(([name, rate]: [string, number]) => ({ name, rate: rate ?? 0 }))
          )
        }
        setNotifsToday(notifsTodayResult)
        setNotifsWeek(notifsWeekResult)
        setActivityLogs(logsResult)
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
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{t('fetchError')}: {error}</p>
  }

  return (
    <div className="space-y-6">
      {/* RSVP rates */}
      {rsvpRates.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {t('rsvpRates')}
          </h4>
          <div className="space-y-1.5">
            {rsvpRates.map(row => {
              const barColor =
                row.rate >= 80
                  ? 'bg-green-500'
                  : row.rate >= 50
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              return (
                <div key={row.name} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20 shrink-0 truncate">
                    {row.name}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.min(row.rate, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums w-8 text-right text-muted-foreground">
                    {row.rate}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Notifications summary */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          {t('recentNotifications')}
        </h4>
        <p className="text-sm text-muted-foreground">
          {t('auditToday')}: <span className="font-medium text-foreground">{notifsToday}</span>
          {' · '}
          7d: <span className="font-medium text-foreground">{notifsWeek}</span>
        </p>
      </div>

      {/* Recent activity */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {t('recentActivity')}
        </h4>
        {activityLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noData')}</p>
        ) : (
          <div className="space-y-1">
            {activityLogs.map((log, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs py-1 border-b border-border/50 last:border-0"
              >
                <span className="font-medium truncate max-w-[90px]">
                  {typeof log.user === 'object' ? (memberName(log.user) || log.user.id.slice(0, 8)) : (log.user?.slice(0, 8) ?? '?')}
                </span>
                <span className="text-muted-foreground truncate">{log.action}</span>
                <span className="text-muted-foreground/70 truncate">{log.collection_name}</span>
                <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
                  {simpleTimeAgo(log.created)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
