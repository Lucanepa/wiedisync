/**
 * useMutation — backward-compatible wrapper around TanStack mutations.
 *
 * New code should import { useCreate, useUpdate, useDelete } from '../lib/query' directly.
 */

import { useState, useCallback } from 'react'
import { createRecord, updateRecord, deleteRecord } from '../lib/api'
import { queryClient, keys } from '../lib/query'
import { logActivity } from '../utils/logActivity'

const SKIP_LOG = new Set(['user_logs'])

/**
 * Convert any thrown value into a real Error with a usable message.
 * Directus SDK throws `{ errors: [{ message, extensions: { code } }] }` —
 * `String({...})` produces "[object Object]", which is what landed in
 * Sentry as WIEDISYNC-3T. Walk known shapes first so the message is
 * actionable.
 */
function toError(err: unknown): Error {
  if (err instanceof Error) return err
  if (typeof err === 'string') return new Error(err)
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>
    const directusErrors = obj.errors
    if (Array.isArray(directusErrors) && directusErrors.length > 0) {
      const first = directusErrors[0] as Record<string, unknown> | undefined
      if (first && typeof first.message === 'string') {
        const wrapped = new Error(first.message)
        ;(wrapped as Error & { cause?: unknown }).cause = err
        return wrapped
      }
    }
    if (typeof obj.message === 'string') {
      const wrapped = new Error(obj.message)
      ;(wrapped as Error & { cause?: unknown }).cause = err
      return wrapped
    }
    try {
      return new Error(JSON.stringify(err))
    } catch {
      // fall through to String() below
    }
  }
  return new Error(String(err))
}

export function useMutation<T = Record<string, unknown>>(collection: string) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const create = useCallback(
    async (data: Record<string, unknown>, opts: { silentOnUnique?: boolean } = {}) => {
      setIsLoading(true)
      setError(null)
      try {
        const record = await createRecord<T>(collection, data, opts)
        const id = (record as Record<string, unknown>).id
        if (!SKIP_LOG.has(collection)) logActivity('create', collection, String(id), data)
        queryClient.invalidateQueries({ queryKey: keys.collection(collection) })
        return record
      } catch (err) {
        const e = toError(err)
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
        const record = await updateRecord<T>(collection, id, data)
        if (!SKIP_LOG.has(collection)) logActivity('update', collection, String(id), data)
        queryClient.invalidateQueries({ queryKey: keys.collection(collection) })
        return record
      } catch (err) {
        const e = toError(err)
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
        await deleteRecord(collection, id)
        if (!SKIP_LOG.has(collection)) logActivity('delete', collection, String(id))
        queryClient.invalidateQueries({ queryKey: keys.collection(collection) })
        return true
      } catch (err) {
        const e = toError(err)
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
