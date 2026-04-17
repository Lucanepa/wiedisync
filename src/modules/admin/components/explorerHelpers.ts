// src/modules/admin/components/explorerHelpers.ts
import type { Member, Team, Event as EventRec, Training, Game } from '../../../types'

export type BucketKey = 'members' | 'teams' | 'events' | 'trainings' | 'games'

export interface ExplorerEntity {
  type: BucketKey
  id: string
  /** Primary label used in tree + breadcrumb. */
  label: string
  /** Secondary label shown under the primary in search results. */
  sublabel?: string
}

export interface CacheShape {
  members: Member[]
  teams: Team[]
  events: EventRec[]
  trainings: Training[]
  games: Game[]
  loadedAt: number | null
}

/**
 * Sport-admin scope: 'all' means no filter, else restrict to a single sport.
 * Users with both vb+bb but not global admin also get 'all'.
 */
export type ExplorerScope = 'all' | 'volleyball' | 'basketball'

export function getExplorerScope(auth: {
  isGlobalAdmin: boolean
  isVorstand: boolean
  isVbAdmin: boolean
  isBbAdmin: boolean
}): ExplorerScope {
  if (auth.isGlobalAdmin || auth.isVorstand) return 'all'
  if (auth.isVbAdmin && auth.isBbAdmin) return 'all'
  if (auth.isVbAdmin) return 'volleyball'
  if (auth.isBbAdmin) return 'basketball'
  return 'all'
}

/** Return segments: array of { text, match } so the caller can render `<mark>` on matches. */
export function highlightMatch(text: string, query: string): Array<{ text: string; match: boolean }> {
  if (!query) return [{ text, match: false }]
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx === -1) return [{ text, match: false }]
  return [
    { text: text.slice(0, idx), match: false },
    { text: text.slice(idx, idx + q.length), match: true },
    { text: text.slice(idx + q.length), match: false },
  ].filter((s) => s.text.length > 0)
}

export function memberLabel(m: Member): string {
  const fn = m.first_name ?? ''
  const ln = m.last_name ?? ''
  return `${ln}, ${fn}`.trim().replace(/^,\s*/, '').trim() || `Member #${m.id}`
}

/** Short label (e.g. "H1") — used for tree rows and compact chips. */
export function teamLabel(t: Team): string {
  return t.name || t.full_name || `Team #${t.id}`
}

export function eventLabel(e: EventRec): string {
  return e.title || `Event #${e.id}`
}

export function trainingLabel(t: Training, teamLookup: (id: string) => string): string {
  const teamStr = t.team ? teamLookup(String(t.team)) : ''
  return [teamStr, t.date].filter(Boolean).join(' · ')
}

export function gameLabel(g: Game, teamLookup: (id: string) => string): string {
  const home = g.home_team ? teamLookup(String(g.home_team)) : '?'
  const away = g.away_team ? teamLookup(String(g.away_team)) : '?'
  return `${home} vs ${away} · ${g.date ?? ''}`.trim()
}
