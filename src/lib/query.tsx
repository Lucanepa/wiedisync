/**
 * TanStack Query integration — provides the QueryClientProvider
 * and reusable hook factories for Directus collections.
 *
 * Usage:
 *   const { data, isLoading } = useCollection('teams', { filter: { active: { _eq: true } } })
 *   const { mutate } = useCreate('participations')
 */

import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { fetchItems, fetchAllItems, fetchItem, countItems, createRecord, updateRecord, deleteRecord } from './api'

// ── Query Client ────────────────────────────────────────────────────

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30s before refetch
      gcTime: 5 * 60_000,       // 5min garbage collection
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

// ── Query key factory ───────────────────────────────────────────────

export const keys = {
  collection: (name: string) => [name] as const,
  list: (name: string, query?: Record<string, unknown>) =>
    query ? [name, 'list', query] as const : [name, 'list'] as const,
  detail: (name: string, id: string | number) => [name, 'detail', id] as const,
  count: (name: string, filter?: Record<string, unknown>) =>
    filter ? [name, 'count', filter] as const : [name, 'count'] as const,
}

// ── Collection query hook ───────────────────────────────────────────

interface UseCollectionOptions {
  filter?: Record<string, unknown>
  sort?: string | string[]
  fields?: string[]
  limit?: number
  offset?: number
  deep?: Record<string, unknown>
  search?: string
  enabled?: boolean
  /** Fetch all items (limit: -1). Default false. */
  all?: boolean
  /** Stale time override in ms. */
  staleTime?: number
}

/**
 * Fetch items from a Directus collection with automatic caching.
 * Fetch items from a Directus collection with automatic caching.
 */
export function useCollection<T = Record<string, unknown>>(
  collection: string,
  options?: UseCollectionOptions,
) {
  const {
    filter, sort, fields, limit, offset, deep, search,
    enabled = true, all = false, staleTime,
  } = options ?? {}

  const sortArr = sort ? (Array.isArray(sort) ? sort : sort.split(',').map(s => s.trim())) : undefined
  const queryOpts = { filter, sort: sortArr, fields, deep, search, limit: all ? -1 : limit, offset }

  return useQuery<T[]>({
    queryKey: keys.list(collection, queryOpts as Record<string, unknown>),
    queryFn: () => all
      ? fetchAllItems<T>(collection, { filter, sort: sortArr, fields, deep })
      : fetchItems<T>(collection, { filter, sort: sortArr, fields, limit, offset, deep, search }),
    enabled,
    staleTime,
  })
}

/** Fetch a single item by ID. */
export function useItem<T = Record<string, unknown>>(
  collection: string,
  id: string | number | null | undefined,
  options?: { fields?: string[]; enabled?: boolean },
) {
  return useQuery<T>({
    queryKey: keys.detail(collection, id!),
    queryFn: () => fetchItem<T>(collection, id!, { fields: options?.fields }),
    enabled: (options?.enabled ?? true) && id != null,
  })
}

/** Count items in a collection. */
export function useCount(
  collection: string,
  filter?: Record<string, unknown>,
  options?: { enabled?: boolean },
) {
  return useQuery<number>({
    queryKey: keys.count(collection, filter),
    queryFn: () => countItems(collection, filter),
    enabled: options?.enabled ?? true,
  })
}

// ── Mutation hooks ──────────────────────────────────────────────────

interface MutationCallbacks<T = Record<string, unknown>> {
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
}

/** Create a record in a collection. Invalidates the collection cache. */
export function useCreate<T = Record<string, unknown>>(
  collection: string,
  callbacks?: MutationCallbacks<T>,
) {
  const qc = useQueryClient()
  return useMutation<T, Error, Record<string, unknown>>({
    mutationFn: (data) => createRecord<T>(collection, data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: keys.collection(collection) })
      callbacks?.onSuccess?.(data)
    },
    onError: callbacks?.onError,
  })
}

/** Update a record. Invalidates the collection cache. */
export function useUpdate<T = Record<string, unknown>>(
  collection: string,
  callbacks?: MutationCallbacks<T>,
) {
  const qc = useQueryClient()
  return useMutation<T, Error, { id: string | number; data: Record<string, unknown> }>({
    mutationFn: ({ id, data }) => updateRecord<T>(collection, id, data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: keys.collection(collection) })
      callbacks?.onSuccess?.(data)
    },
    onError: callbacks?.onError,
  })
}

/** Delete a record. Invalidates the collection cache. */
export function useDelete(
  collection: string,
  callbacks?: MutationCallbacks<void>,
) {
  const qc = useQueryClient()
  return useMutation<void, Error, string | number>({
    mutationFn: (id) => deleteRecord(collection, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.collection(collection) })
      callbacks?.onSuccess?.(undefined)
    },
    onError: callbacks?.onError,
  })
}

/** Invalidate all queries for a collection (triggers refetch). */
export function useInvalidate() {
  const qc = useQueryClient()
  return (collection: string) => qc.invalidateQueries({ queryKey: keys.collection(collection) })
}
