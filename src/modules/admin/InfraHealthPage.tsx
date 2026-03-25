import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import pb from '../../pb'
import { useInfraHealth } from '../../hooks/useInfraHealth'

const PB_URL = pb.baseUrl
const PB_DEV_URL = 'https://api-dev.kscw.ch'
const PUSH_WORKER_URL = 'https://kscw-push.lucanepa.workers.dev'

type Status = 'healthy' | 'down' | 'stale' | 'checking' | 'unknown'

interface HealthCheck {
  name: string
  status: Status
  detail: string
  responseTime?: number | null
}

function statusColor(s: Status) {
  switch (s) {
    case 'healthy': return { dot: 'bg-green-500', badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', glow: 'shadow-green-500/40' }
    case 'down': return { dot: 'bg-red-500', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', glow: 'shadow-red-500/40' }
    case 'stale': return { dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', glow: 'shadow-amber-500/40' }
    case 'checking': return { dot: 'bg-gray-400 animate-pulse', badge: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', glow: '' }
    default: return { dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', glow: '' }
  }
}

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

async function checkEndpoint(url: string, noCorsOk = false): Promise<{ ok: boolean; ms: number; status: number; cors: boolean }> {
  const start = Date.now()
  try {
    const res = await fetch(url, { method: 'GET', mode: 'cors' })
    return { ok: res.ok, ms: Date.now() - start, status: res.status, cors: false }
  } catch {
    if (noCorsOk) {
      // Retry with no-cors — opaque response means server is reachable
      try {
        const res = await fetch(url, { method: 'GET', mode: 'no-cors' })
        return { ok: res.type === 'opaque', ms: Date.now() - start, status: 0, cors: false }
      } catch {
        return { ok: false, ms: Date.now() - start, status: 0, cors: true }
      }
    }
    return { ok: false, ms: Date.now() - start, status: 0, cors: true }
  }
}

function Card({ check }: { check: HealthCheck }) {
  const { t } = useTranslation('admin')
  const c = statusColor(check.status)
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="mb-2 flex items-center gap-2.5">
        <span className={`h-2.5 w-2.5 rounded-full ${c.dot} ${c.glow ? `shadow-[0_0_6px]` : ''} ${c.glow}`} />
        <span className="text-sm font-semibold text-gray-900 dark:text-white">{check.name}</span>
      </div>
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${c.badge}`}>
        {t(`infra_${check.status}`)}
      </span>
      {check.detail && (
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{check.detail}</p>
      )}
      {check.responseTime != null && (
        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
          {t('infraResponseTime')}: {check.responseTime}ms
        </p>
      )}
    </div>
  )
}

function Section({ title, checks }: { title: string; checks: HealthCheck[] }) {
  if (!checks.length) return null
  return (
    <div className="mb-6">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {checks.map((c) => <Card key={c.name} check={c} />)}
      </div>
    </div>
  )
}

export default function InfraHealthPage() {
  const { t } = useTranslation('admin')
  const infraHealth = useInfraHealth()
  const [services, setServices] = useState<HealthCheck[]>([])
  const [syncs, setSyncs] = useState<HealthCheck[]>([])
  const [crons, setCrons] = useState<HealthCheck[]>([])
  const [lastCheck, setLastCheck] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Map hook sync statuses → page HealthCheck shape whenever hook data updates
  useEffect(() => {
    const sourceNameMap: Record<string, string> = {
      swiss_volley: t('infraSvSync'),
      basketplan: t('infraBpSync'),
      gcal: t('infraGcalSync'),
    }
    setSyncs(
      infraHealth.syncs.map(s => ({
        name: sourceNameMap[s.source] ?? s.source,
        status: s.lastUpdated === null ? 'unknown' : s.isStale ? 'stale' : 'healthy',
        detail: s.lastUpdated ? timeAgo(s.lastUpdated, t) : t('infraNoData'),
      }))
    )
  }, [infraHealth.syncs, t])

  const runChecks = useCallback(async () => {
    setLoading(true)

    // ── Services ──
    const svcResults: HealthCheck[] = []

    // PocketBase Prod — use shared hook result (already fetched on mount/refresh)
    const hookPbService = infraHealth.services.find(s => s.name === 'PocketBase')
    const pbProdOk = hookPbService?.status === 'ok'
    svcResults.push({
      name: t('infraPbProd'),
      status: pbProdOk ? 'healthy' : 'down',
      detail: pbProdOk ? PB_URL.replace('https://', '') : 'Unreachable',
      responseTime: hookPbService?.latency ?? null,
    })

    // PocketBase Dev (no-cors fallback — dev PB may not whitelist this origin)
    const pbDev = await checkEndpoint(`${PB_DEV_URL}/api/health`, true)
    svcResults.push({
      name: t('infraPbDev'),
      status: pbDev.ok ? 'healthy' : pbDev.cors ? 'unknown' : 'down',
      detail: pbDev.ok ? PB_DEV_URL.replace('https://', '') : pbDev.cors ? 'CORS (cross-origin)' : `HTTP ${pbDev.status}`,
      responseTime: pbDev.ok ? pbDev.ms : null,
    })

    // Cloudflare Tunnel (implied by PB Prod reachability)
    svcResults.push({
      name: t('infraCfTunnel'),
      status: pbProdOk ? 'healthy' : 'down',
      detail: pbProdOk ? 'kscw-vps tunnel active' : 'Tunnel unreachable',
    })

    // Push Worker (uses dedicated /health endpoint with permissive CORS)
    const push = await checkEndpoint(`${PUSH_WORKER_URL}/health`)
    svcResults.push({
      name: t('infraPushWorker'),
      status: (push.ok || push.status === 405 || push.status === 404) ? 'healthy' : push.cors ? 'unknown' : 'down',
      detail: push.cors ? 'CORS (cross-origin)' : PUSH_WORKER_URL.replace('https://', ''),
      responseTime: push.cors ? null : push.ms,
    })

    // Hooks deployed (check a known hook endpoint)
    const hooks = await checkEndpoint(`${PB_URL}/api/public/teams`)
    svcResults.push({
      name: t('infraHooksDeployed'),
      status: hooks.ok ? 'healthy' : 'down',
      detail: hooks.ok ? t('infra_healthy') : 'Hook endpoints not responding',
      responseTime: hooks.ms,
    })

    setServices(svcResults)

    // Trigger shared hook refresh (updates syncs via useEffect above)
    infraHealth.refresh()

    // ── Cron Jobs ──
    const cronResults: HealthCheck[] = []
    const CRON_STALE = 48 * 3600000 // 48h

    // Notifications
    try {
      const notif = await pb.collection('notifications').getList(1, 1, {
        sort: '-created', fields: 'created',
      })
      if (notif.items.length) {
        const diff = Date.now() - new Date(notif.items[0].created).getTime()
        cronResults.push({
          name: t('infraNotifCron'),
          status: diff > CRON_STALE ? 'stale' : 'healthy',
          detail: timeAgo(notif.items[0].created, t),
        })
      }
    } catch {
      cronResults.push({ name: t('infraNotifCron'), status: 'unknown', detail: '' })
    }

    setCrons(cronResults)
    setLastCheck(new Date().toLocaleTimeString())
    setLoading(false)
  }, [t, infraHealth])

  useEffect(() => { runChecks() }, [runChecks])

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('infraTitle')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('infraDescription')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastCheck && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {lastCheck}
            </span>
          )}
          <button
            onClick={runChecks}
            disabled={loading}
            className="rounded-lg bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('infraChecking')}
              </span>
            ) : t('infraRefresh')}
          </button>
        </div>
      </div>

      <Section title={t('infraServices')} checks={services} />
      <Section title={t('infraDataSyncs')} checks={syncs} />
      <Section title={t('infraCronJobs')} checks={crons} />
    </div>
  )
}
