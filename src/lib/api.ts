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
        if (!raw) return null
        try { return JSON.parse(raw) } catch { return null }
      },
      set: (data) => {
        if (data) {
          getStorage().setItem(AUTH_KEY, JSON.stringify(data))
        } else {
          // SDK calls set(null) on logout
          localStorage.removeItem(AUTH_KEY)
          sessionStorage.removeItem(AUTH_KEY)
        }
      },
    },
    autoRefresh: true,
  }))
  .with(rest())
  .with(realtime({
    authMode: 'handshake',
  }))

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

/**
 * Numeric data fields that must stay as numbers (not foreign keys).
 * Every other integer field is assumed to be a FK/ID and gets stringified.
 */
const KEEP_AS_NUMBER = new Set([
  'home_score', 'away_score', 'min_participants', 'max_participants',
  'max_players', 'day_of_week', 'guest_level', 'amount', 'rank',
  'points', 'won', 'lost', 'played', 'draws', 'sets_won', 'sets_lost',
  'points_won', 'points_lost', 'point_diff',
  'wins_clear', 'wins_narrow', 'defeats_clear', 'defeats_narrow',
  'sort_order', 'number', 'yob', 'courts', 'lat', 'lon',
  'game_min_participants', 'game_respond_by_days',
  'training_min_participants', 'training_respond_by_days',
  'guest_count', 'confirmed_proposal', 'seats_available',
  'respond_by_days', 'count',
])

/** Coerce Directus integer IDs/FKs to strings for frontend compat. */
function stringifyIds<T>(items: T[]): T[] {
  return items.map(item => stringifyId(item))
}

function stringifyId<T>(item: T): T {
  if (item && typeof item === 'object') {
    const obj = { ...item } as Record<string, unknown>
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'number' && !KEEP_AS_NUMBER.has(key)) {
        obj[key] = String(obj[key])
      }
    }
    return obj as T
  }
  return item
}

/**
 * Wrap a single FK value into an array of string IDs.
 * Used for fields that were multi-relations in PB but single FKs in Directus.
 */
export function wrapFkAsArray<T>(items: T[], field: keyof T): T[] {
  return items.map(item => {
    if (!item || typeof item !== 'object') return item
    const val = (item as Record<string, unknown>)[field as string]
    if (Array.isArray(val)) return item
    return { ...item, [field as string]: val != null ? [String(val)] : [] }
  })
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
