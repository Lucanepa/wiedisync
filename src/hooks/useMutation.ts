import { useState, useCallback } from 'react'
import { createItem, updateItem, deleteItem } from '@directus/sdk'
import directus from '../directus'
import { logActivity } from '../utils/logActivity'

const SKIP_LOG = new Set(['user_logs'])

export function useMutation<T = Record<string, unknown>>(collection: string) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const create = useCallback(
    async (data: Record<string, unknown>) => {
      setIsLoading(true)
      setError(null)
      try {
        const record = await directus.request<T>(createItem(collection, data as never))
        const id = (record as Record<string, unknown>).id
        if (!SKIP_LOG.has(collection)) {
          logActivity('create', collection, String(id), data)
        }
        return record
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        throw e
      } finally {
        setIsLoading(false)
      }
    },
    [collection],
  )

  const update = useCallback(
    async (id: string | number, data: Record<string, unknown>) => {
      setIsLoading(true)
      setError(null)
      try {
        const record = await directus.request<T>(updateItem(collection, id, data as never))
        if (!SKIP_LOG.has(collection)) {
          logActivity('update', collection, String(id), data)
        }
        return record
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        throw e
      } finally {
        setIsLoading(false)
      }
    },
    [collection],
  )

  const remove = useCallback(
    async (id: string | number) => {
      setIsLoading(true)
      setError(null)
      try {
        await directus.request(deleteItem(collection, id))
        if (!SKIP_LOG.has(collection)) {
          logActivity('delete', collection, String(id))
        }
        return true
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        throw e
      } finally {
        setIsLoading(false)
      }
    },
    [collection],
  )

  return { create, update, remove, isLoading, error }
}
