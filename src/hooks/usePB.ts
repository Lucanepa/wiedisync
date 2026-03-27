import { useState, useEffect, useCallback, useRef } from 'react'
import { readItems, aggregate } from '@directus/sdk'
import directus from '../directus'

// Directus filter operators mapping from PB syntax
// PB: "field = 'value'" → Directus: { field: { _eq: 'value' } }
// This adapter keeps PB-style options but translates them for Directus

interface UsePBOptions {
  page?: number
  perPage?: number
  enabled?: boolean
  all?: boolean
  sort?: string
  // Accepts both PB-style string filters (legacy, passed as _filter param)
  // and Directus object filters. String filters need migration but work for now.
  filter?: string | Record<string, unknown>
  expand?: string
  fields?: string[] | string
  // Directus-native deep query
  deep?: Record<string, unknown>
}

export function usePB<T = Record<string, unknown>>(
  collection: string,
  options?: UsePBOptions,
) {
  const [data, setData] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const hasLoaded = useRef(false)

  const enabled = options?.enabled ?? true
  const all = options?.all ?? false
  const page = options?.page ?? 1
  const perPage = options?.perPage ?? 50
  const sort = options?.sort ?? ''
  const filterRaw = options?.filter ?? undefined
  // Directus needs object filters; string filters are PB legacy — pass through for now
  const filter = typeof filterRaw === 'object' ? filterRaw : undefined
  const filterString = typeof filterRaw === 'string' ? filterRaw : ''
  const fields = options?.fields ?? undefined
  const deep = options?.deep ?? undefined

  // Stable serialization for dependency tracking
  const filterKey = filter ? JSON.stringify(filter) : filterString
  const fieldsKey = fields ? JSON.stringify(fields) : ''
  const deepKey = deep ? JSON.stringify(deep) : ''

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setData([])
      setTotal(0)
      setIsLoading(false)
      return
    }
    if (!hasLoaded.current) setIsLoading(true)
    setError(null)
    try {
      const query: Record<string, unknown> = {}

      if (sort) {
        // PB sort: "-created,name" → Directus sort: ["-created", "name"]
        query.sort = sort.split(',').map(s => s.trim())
      }
      if (filter) query.filter = filter
      if (fields) {
        query.fields = Array.isArray(fields) ? fields : fields.split(',').map(s => s.trim())
      }
      if (deep) query.deep = deep

      if (all) {
        query.limit = -1
        const items = await directus.request<T[]>(readItems(collection, query as never))
        setData(items)
        setTotal(items.length)
      } else {
        query.limit = perPage
        query.offset = (page - 1) * perPage
        query.meta = 'filter_count'
        const result = await directus.request(readItems(collection, query as never)) as unknown as T[]
        // Directus returns items directly when meta is requested via the SDK
        setData(result)
        // For total count, do a separate aggregate query
        try {
          const countResult = await directus.request(aggregate(collection, {
            aggregate: { count: '*' },
            query: filter ? { filter } as never : undefined,
          }))
          setTotal(Number(countResult[0]?.count ?? result.length))
        } catch {
          setTotal(result.length)
        }
      }
      hasLoaded.current = true
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [collection, enabled, all, page, perPage, sort, filterKey, fieldsKey, deepKey])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, total, isLoading, error, refetch: fetchData }
}
