/**
 * Directus API client — thin, typed wrapper around @directus/sdk + fetch.
 *
 * All data access goes through this module. No component should import
 * @directus/sdk or directus.ts directly — use the query hooks instead.
 */

import {
  createDirectus, rest, authentication, realtime,
  readItems, readItem, createItem, updateItem, deleteItem,
  aggregate,
} from '@directus/sdk'

// ── Config ──────────────────────────────────────────────────────────

const AUTH_KEY = 'directus_auth'
const REMEMBER_KEY = 'wiedisync-remember-me'

function isRememberMe(): boolean {
  return localStorage.getItem(REMEMBER_KEY) !== 'false'
}
function getStorage(): Storage {
  return isRememberMe() ? localStorage : sessionStorage
}

const host = typeof window !== 'undefined' ? window.location.hostname : ''
const isProd = host === 'wiedisync.kscw.ch'
export const API_URL = isProd
  ? 'https://directus.kscw.ch'
  : (import.meta.env.VITE_DIRECTUS_URL || 'https://directus-dev.kscw.ch')

// ── Client ──────────────────────────────────────────────────────────

export const client = createDirectus(API_URL)
  .with(authentication('json', {
    storage: {
      get: () => {
        const raw = getStorage().getItem(AUTH_KEY)
        return raw ? JSON.parse(raw) : null
      },
      set: (data) => {
        if (data) getStorage().setItem(AUTH_KEY, JSON.stringify(data))
      },
    },
    autoRefresh: true,
  }))
  .with(rest())
  .with(realtime())

// ── Auth helpers ────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  return client.login(email, password)
}

export async function logout() {
  try { await client.logout() } catch { /* ignore */ }
  localStorage.removeItem(AUTH_KEY)
  sessionStorage.removeItem(AUTH_KEY)
  localStorage.removeItem('wiedisync-sql-history')
}

export async function refreshAuth() {
  return client.refresh()
}

export function getAccessToken(): string | null {
  const raw = getStorage().getItem(AUTH_KEY)
  if (!raw) return null
  try { return JSON.parse(raw)?.access_token || null } catch { return null }
}

export function isAuthenticated(): boolean {
  return !!getAccessToken()
}

// ── Data helpers ────────────────────────────────────────────────────

/** Coerce Directus integer IDs to strings for frontend compat. */
function stringifyIds<T>(items: T[]): T[] {
  return items.map(item => {
    if (item && typeof item === 'object') {
      const obj = { ...item } as Record<string, unknown>
      if (typeof obj.id === 'number') obj.id = String(obj.id)
      return obj as T
    }
    return item
  })
}

function stringifyId<T>(item: T): T {
  if (item && typeof item === 'object') {
    const obj = { ...item } as Record<string, unknown>
    if (typeof obj.id === 'number') obj.id = String(obj.id)
    return obj as T
  }
  return item
}

/** Fetch a list of items. Returns the array directly. */
export async function fetchItems<T = Record<string, unknown>>(
  collection: string,
  query?: {
    filter?: Record<string, unknown>
    sort?: string[]
    fields?: string[]
    limit?: number
    offset?: number
    deep?: Record<string, unknown>
    search?: string
  },
): Promise<T[]> {
  const q: Record<string, unknown> = {}
  if (query?.filter) q.filter = query.filter
  if (query?.sort) q.sort = query.sort
  if (query?.fields) q.fields = query.fields
  if (query?.limit !== undefined) q.limit = query.limit
  if (query?.offset !== undefined) q.offset = query.offset
  if (query?.deep) q.deep = query.deep
  if (query?.search) q.search = query.search
  const items = await client.request<T[]>(readItems(collection, q as never))
  return stringifyIds(items)
}

/** Fetch all items (no pagination). */
export async function fetchAllItems<T = Record<string, unknown>>(
  collection: string,
  query?: {
    filter?: Record<string, unknown>
    sort?: string[]
    fields?: string[]
    deep?: Record<string, unknown>
  },
): Promise<T[]> {
  return fetchItems<T>(collection, { ...query, limit: -1 })
}

/** Fetch a single item by ID. */
export async function fetchItem<T = Record<string, unknown>>(
  collection: string,
  id: string | number,
  query?: { fields?: string[] },
): Promise<T> {
  const item = await client.request<T>(readItem(collection, id, query as never))
  return stringifyId(item)
}

/** Count items in a collection. */
export async function countItems(
  collection: string,
  filter?: Record<string, unknown>,
): Promise<number> {
  const result = await client.request(aggregate(collection, {
    aggregate: { count: '*' },
    query: filter ? { filter } as never : undefined,
  }))
  return Number(result[0]?.count ?? 0)
}

/** Create a new item. */
export async function createRecord<T = Record<string, unknown>>(
  collection: string,
  data: Record<string, unknown>,
): Promise<T> {
  const item = await client.request<T>(createItem(collection, data as never))
  return stringifyId(item)
}

/** Update an item. */
export async function updateRecord<T = Record<string, unknown>>(
  collection: string,
  id: string | number,
  data: Record<string, unknown>,
): Promise<T> {
  const item = await client.request<T>(updateItem(collection, id, data as never))
  return stringifyId(item)
}

/** Delete an item. */
export async function deleteRecord(
  collection: string,
  id: string | number,
): Promise<void> {
  await client.request(deleteItem(collection, id))
}

/** Get a Directus asset URL (images, files). */
export function assetUrl(fileId: string | null | undefined, transforms?: string): string {
  if (!fileId) return ''
  return transforms ? `${API_URL}/assets/${fileId}?${transforms}` : `${API_URL}/assets/${fileId}`
}

/** Call a custom KSCW endpoint. */
export async function kscwApi<T = unknown>(
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const token = getAccessToken()
  const res = await fetch(`${API_URL}/kscw${path}`, {
    method: options?.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
  })
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`)
  return res.json()
}
