/**
 * usePB — backward-compatible wrapper around useCollection.
 *
 * New code should import { useCollection } from '../lib/query' directly.
 * This exists so 41 existing call sites don't need to change yet.
 */

import { useCollection } from '../lib/query'

interface UsePBOptions {
  page?: number
  perPage?: number
  enabled?: boolean
  all?: boolean
  sort?: string
  filter?: string | Record<string, unknown>
  expand?: string
  fields?: string
  deep?: Record<string, unknown>
}

export function usePB<T = Record<string, unknown>>(
  collection: string,
  options?: UsePBOptions,
) {
  const {
    enabled, all, sort, fields, deep,
    page = 1, perPage = 50,
  } = options ?? {}

  // Convert PB-style string filter to empty (needs manual migration per call site)
  const filter = typeof options?.filter === 'object' ? options.filter : undefined

  const sortArr = sort ? sort.split(',').map(s => s.trim()) : undefined
  const fieldsArr = fields ? fields.split(',').map(s => s.trim()) : undefined

  const result = useCollection<T>(collection, {
    filter,
    sort: sortArr,
    fields: fieldsArr,
    deep,
    limit: all ? undefined : perPage,
    offset: all ? undefined : (page - 1) * perPage,
    all,
    enabled,
  })

  return {
    data: result.data ?? [],
    total: result.data?.length ?? 0,
    isLoading: result.isLoading,
    error: result.error ?? null,
    refetch: result.refetch,
  }
}
