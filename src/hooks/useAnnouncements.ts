import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { fetchItems } from '../lib/api'
import { useAuth } from './useAuth'
import { useRealtime } from './useRealtime'
import type { Announcement, AnnouncementLocale, AnnouncementTranslation } from '../types'

const FALLBACK_CHAIN: AnnouncementLocale[] = ['de', 'en', 'fr', 'gsw', 'it']

/**
 * Resolve translation for current locale with fallback chain:
 * requested → de → en → first available.
 */
export function pickTranslation(
  translations: Announcement['translations'] | undefined,
  locale: string,
): AnnouncementTranslation {
  const t = translations ?? {}
  const candidates: AnnouncementLocale[] = [
    locale.slice(0, 3) as AnnouncementLocale,
    locale.slice(0, 2) as AnnouncementLocale,
    ...FALLBACK_CHAIN,
  ]
  for (const code of candidates) {
    const entry = t[code]
    if (entry?.title) return entry
  }
  // Last resort — return the first defined entry
  const first = Object.values(t).find((v): v is AnnouncementTranslation => !!v?.title)
  return first ?? { title: '', body: '' }
}

/**
 * Fetch published announcements visible to the current user, sorted with
 * pinned first then newest published_at.
 *
 * v1 audience filter: `all` always visible; `sport` matches user's primarySport
 * (or shown when primarySport='both'). `teams`/`roles` reserved for v2.
 *
 * Audit note (F2): the audience filter applied here is **client-side only**.
 * Directus permission rules cannot traverse member_teams.team.sport from the
 * current user, so the server returns all published announcements and this
 * hook narrows by primarySport. A direct API call could reveal sport-targeted
 * posts to members of the other sport. Acceptable for v1 (low-sensitivity
 * content) — revisit if announcements ever carry confidential payload.
 */
export function useAnnouncements(opts?: { limit?: number }) {
  const { user, isApproved, primarySport } = useAuth()
  const [items, setItems] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const userIdRef = useRef(user?.id)
  userIdRef.current = user?.id
  const limit = opts?.limit ?? 30

  const fetchAnnouncements = useCallback(async () => {
    if (!user?.id || !isApproved) {
      setItems([])
      setIsLoading(false)
      return
    }
    try {
      const nowIso = new Date().toISOString()
      // Audience filter: all + (primarySport-matched sport rows)
      const sportFilter: Record<string, unknown>[] = [
        { audience_type: { _eq: 'all' } },
      ]
      if (primarySport === 'volleyball' || primarySport === 'both') {
        sportFilter.push({ _and: [{ audience_type: { _eq: 'sport' } }, { audience_sport: { _eq: 'volleyball' } }] })
      }
      if (primarySport === 'basketball' || primarySport === 'both') {
        sportFilter.push({ _and: [{ audience_type: { _eq: 'sport' } }, { audience_sport: { _eq: 'basketball' } }] })
      }
      const result = await fetchItems<Announcement>('announcements', {
        filter: {
          _and: [
            { published_at: { _nnull: true, _lte: nowIso } },
            { _or: [{ expires_at: { _null: true } }, { expires_at: { _gt: nowIso } }] },
            { _or: sportFilter },
          ],
        },
        sort: ['-pinned', '-published_at'],
        limit,
      })
      setItems(result)
    } catch {
      // silently fail (collection may not exist yet on dev)
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, isApproved, primarySport, limit])

  useEffect(() => {
    fetchAnnouncements()
  }, [fetchAnnouncements])

  // Realtime: refetch on any change (audience evaluation is server-side via filter)
  useRealtime<Announcement>('announcements', () => {
    fetchAnnouncements()
  }, undefined, !user?.id || !isApproved)

  return useMemo(() => ({ announcements: items, isLoading, refetch: fetchAnnouncements }), [items, isLoading, fetchAnnouncements])
}
