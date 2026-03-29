import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { InfraHealth } from '../../../hooks/useInfraHealth'
import { kscwApi } from '../../../lib/api'

function timeAgo(dateStr: string, t: (k: string) => string): string {
  if (!dateStr) return t('infraNever')
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return `< 1 ${t('infraMin')} ${t('infraAgo')}`
  if (mins < 60) return `${mins} ${t('infraMin')} ${t('infraAgo')}`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${t('infraAgo')}`
  const days = Math.floor(hrs / 24)
  return `${days}d ${t('infraAgo')}`
}

const SOURCE_LABELS: Record<string, string> = {
  swiss_volley: 'Swiss Volley',
  basketplan: 'Basketplan',
  gcal: 'Google Calendar',
}

export default function InfraSection({ infraHealth }: { infraHealth: InfraHealth }) {
  const { t } = useTranslation('admin')
  const { services, syncs, isLoading } = infraHealth
  const [auditErrors, setAuditErrors] = useState<number | null>(null)

  useEffect(() => {
    async function fetchAuditErrors() {
      try {
        const result = await kscwApi('/admin/audit', {
          method: 'POST',
          body: { filter: { level: 'error' } },
        }) as { items: unknown[]; totalItems: number }
        setAuditErrors(result?.totalItems ?? 0)
      } catch {
        setAuditErrors(null)
      }
    }
    fetchAuditErrors()
  }, [])

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-4 bg-muted rounded w-2/3" />
        <div className="h-4 bg-muted rounded w-1/2" />
      </div>
    )
  }

  const directusService = services.find(s => s.name === 'Directus')
  const directusOk = directusService?.status === 'ok'

  return (
    <div className="space-y-4">
      {/* Health row */}
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
            directusOk ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className="font-medium">Directus</span>
        <span
          className={`text-xs px-1.5 py-0.5 rounded-full font-medium ml-1 ${
            directusOk
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}
        >
          {directusOk ? t('infra_healthy') : t('infra_down')}
        </span>
      </div>

      {/* Sync rows */}
      {syncs.length > 0 && (
        <div className="space-y-1.5">
          {syncs.map(sync => {
            const dot = sync.lastUpdated === null
              ? 'bg-gray-400'
              : sync.isStale
              ? 'bg-amber-500'
              : 'bg-green-500'
            const label = SOURCE_LABELS[sync.source] ?? sync.source
            const lastLabel = sync.lastUpdated
              ? timeAgo(sync.lastUpdated, t)
              : t('infraNever')

            return (
              <div key={sync.source} className="flex items-center gap-2 text-sm">
                <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${dot}`} />
                <span className="text-muted-foreground w-28 shrink-0">{label}</span>
                <span className="text-xs text-muted-foreground/70">
                  {t('auditLoading').includes('…') ? '' : ''}
                  Last: {lastLabel}
                </span>
                {sync.isStale && (
                  <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium ml-auto">
                    {t('infra_stale')}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Audit errors */}
      {auditErrors !== null && auditErrors > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
          <span className="text-red-600 dark:text-red-400 font-medium">
            {auditErrors} audit {auditErrors === 1 ? 'error' : 'errors'}
          </span>
        </div>
      )}

      {/* Link to full details */}
      <div className="pt-1">
        <Link
          to="/admin/infra"
          className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 underline underline-offset-2"
        >
          {t('viewDetails')} →
        </Link>
      </div>
    </div>
  )
}
