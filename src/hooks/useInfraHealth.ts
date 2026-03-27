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
      // PB health check
      const pbHealth = await fetch(`${API_URL}/server/health`)
        .then(r => ({ name: 'Directus', status: r.ok ? 'ok' as const : 'error' as const }))
        .catch(() => ({ name: 'Directus', status: 'error' as const }))

      setServices([pbHealth])

      // Sync freshness — query latest record per source
      const now = Date.now()
      const syncChecks: SyncStatus[] = []

      for (const source of ['swiss_volley', 'basketplan']) {
        try {
          const records = await fetchItems<Record<string, unknown>>('games', {
            sort: ['-date_updated'],
            filter: { source: { _eq: source } },
            fields: ['date_updated'],
            limit: 1,
          })
          const lastUpdated = (records[0]?.date_updated as string) || null
          const isStale = lastUpdated
            ? now - new Date(lastUpdated).getTime() > STALE_THRESHOLD_MS
            : true
          syncChecks.push({ source, lastUpdated, isStale })
        } catch {
          syncChecks.push({ source, lastUpdated: null, isStale: true })
        }
      }

      // GCal sync
      try {
        const gcalRecords = await fetchItems<Record<string, unknown>>('hall_events', {
          sort: ['-date_updated'],
          fields: ['date_updated'],
          limit: 1,
        })
        const lastUpdated = (gcalRecords[0]?.date_updated as string) || null
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
