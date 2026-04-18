import { useState, useEffect, useCallback, useMemo } from 'react'
import { API_URL, fetchItems } from '../lib/api'

export interface ServiceHealth {
  name: string
  status: 'ok' | 'error' | 'loading'
  latency?: number
}

export interface SyncStatus {
  source: string
  lastUpdated: string | null
  isStale: boolean
}

export interface InfraHealth {
  services: ServiceHealth[]
  syncs: SyncStatus[]
  isLoading: boolean
  refresh: () => void
}

const STALE_THRESHOLD_MS = 36 * 60 * 60 * 1000 // 36 hours

export function useInfraHealth(): InfraHealth {
  const [services, setServices] = useState<ServiceHealth[]>([])
  const [syncs, setSyncs] = useState<SyncStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const checkHealth = useCallback(async () => {
    setIsLoading(true)
    try {
      // API health check — Directus /server/health may omit CORS headers, so
      // fall back to no-cors (opaque response = server reachable), matching
      // the pattern used by InfraHealthPage.checkEndpoint.
      const pbStart = Date.now()
      let pbHealth: ServiceHealth
      try {
        const r = await fetch(`${API_URL}/server/health`, { mode: 'cors' })
        pbHealth = { name: 'Directus', status: r.ok ? 'ok' : 'error', latency: Date.now() - pbStart }
      } catch {
        try {
          const r = await fetch(`${API_URL}/server/health`, { mode: 'no-cors' })
          pbHealth = {
            name: 'Directus',
            status: r.type === 'opaque' ? 'ok' : 'error',
            latency: Date.now() - pbStart,
          }
        } catch {
          pbHealth = { name: 'Directus', status: 'error' }
        }
      }

      setServices([pbHealth])

      // Sync freshness — query latest record per source
      const now = Date.now()
      const syncChecks: SyncStatus[] = []

      for (const source of ['swiss_volley', 'basketplan']) {
        try {
          // Legacy sync rows (before the knex scripts were patched to bump
          // date_updated) have null timestamps. Postgres sorts NULLS-FIRST on
          // DESC, so without the _nnull filter we'd return a junk row and
          // render "Unknown" / stale-by-default. Filter + take max of both.
          const records = await fetchItems<Record<string, unknown>>('games', {
            sort: ['-date_updated', '-date_created'],
            filter: {
              source: { _eq: source },
              _or: [
                { date_updated: { _nnull: true } },
                { date_created: { _nnull: true } },
              ],
            },
            fields: ['date_created', 'date_updated'],
            limit: 1,
          })
          const rec = records[0]
          const lastUpdated = (rec?.date_updated as string) || (rec?.date_created as string) || null
          const isStale = lastUpdated
            ? now - new Date(lastUpdated).getTime() > STALE_THRESHOLD_MS
            : true
          syncChecks.push({ source, lastUpdated, isStale })
        } catch {
          syncChecks.push({ source, lastUpdated: null, isStale: true })
        }
      }

      // GCal sync — same null-sort defense as above.
      try {
        const gcalRecords = await fetchItems<Record<string, unknown>>('hall_events', {
          sort: ['-date_updated', '-date_created'],
          filter: {
            _or: [
              { date_updated: { _nnull: true } },
              { date_created: { _nnull: true } },
            ],
          },
          fields: ['date_created', 'date_updated'],
          limit: 1,
        })
        const rec = gcalRecords[0]
        const lastUpdated = (rec?.date_updated as string) || (rec?.date_created as string) || null
        const isStale = lastUpdated
          ? now - new Date(lastUpdated).getTime() > STALE_THRESHOLD_MS
          : true
        syncChecks.push({ source: 'gcal', lastUpdated, isStale })
      } catch {
        syncChecks.push({ source: 'gcal', lastUpdated: null, isStale: true })
      }

      setSyncs(syncChecks)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { checkHealth() }, [checkHealth])

  return useMemo(
    () => ({ services, syncs, isLoading, refresh: checkHealth }),
    [services, syncs, isLoading, checkHealth],
  )
}
