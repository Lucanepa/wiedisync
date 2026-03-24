import { useState, useEffect, useCallback } from 'react'
import pb from '../pb'

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

const PB_URL = import.meta.env.VITE_PB_URL || 'https://api.kscw.ch'

export function useInfraHealth(): InfraHealth {
  const [services, setServices] = useState<ServiceHealth[]>([])
  const [syncs, setSyncs] = useState<SyncStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const checkHealth = useCallback(async () => {
    setIsLoading(true)
    try {
      // PB health check
      const pbHealth = await fetch(`${PB_URL}/api/health`)
        .then(r => ({ name: 'PocketBase', status: r.ok ? 'ok' as const : 'error' as const }))
        .catch(() => ({ name: 'PocketBase', status: 'error' as const }))

      setServices([pbHealth])

      // Sync freshness — query latest record per source
      const now = Date.now()
      const syncChecks: SyncStatus[] = []

      for (const source of ['swiss_volley', 'basketplan']) {
        try {
          const records = await pb.collection('games').getList(1, 1, {
            sort: '-updated',
            filter: `source = "${source}"`,
            fields: 'updated',
          })
          const lastUpdated = records.items[0]?.updated || null
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
        const gcalRecords = await pb.collection('hall_events').getList(1, 1, {
          sort: '-updated',
          fields: 'updated',
        })
        const lastUpdated = gcalRecords.items[0]?.updated || null
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

  return { services, syncs, isLoading, refresh: checkHealth }
}
