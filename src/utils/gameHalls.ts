import type { Hall, Team } from '../types'

export function normalizeRelId(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'object' && 'id' in (v as Record<string, unknown>)) {
    return String((v as { id: unknown }).id)
  }
  return String(v)
}

type GameHallFields = {
  hall?: string | number | null
  additional_halls?: string[] | null | undefined
  kscw_team?: string | number | null | { id: unknown }
}

export function allGameHallIds(
  game: GameHallFields,
  ctx?: { teams?: Team[]; halls?: Hall[] },
): string[] {
  const primary = game.hall ? [normalizeRelId(game.hall)] : []
  const extras = (game.additional_halls ?? []).map((v) => normalizeRelId(v))
  const ids = [...primary, ...extras].filter(Boolean)

  if (ids.length > 1) return Array.from(new Set(ids))

  // TODO: remove after backfill — see plan
  // Backward-compat: legacy basketball rows have no additional_halls. If the
  // primary hall is KWI A or KWI B and the team is basketball, span both.
  if (ids.length === 1 && ctx?.teams && ctx?.halls) {
    const team = ctx.teams.find((t) => String(t.id) === normalizeRelId(game.kscw_team))
    if (team?.sport === 'basketball') {
      const primaryHall = ctx.halls.find((h) => String(h.id) === ids[0])
      if (primaryHall && (primaryHall.name === 'KWI A' || primaryHall.name === 'KWI B')) {
        const bbHalls = ctx.halls
          .filter((h) => h.name === 'KWI A' || h.name === 'KWI B')
          .map((h) => String(h.id))
        return Array.from(new Set([ids[0], ...bbHalls]))
      }
    }
  }

  return ids
}

export function hallsIntersect(
  a: GameHallFields,
  b: GameHallFields,
  ctx?: { teams?: Team[]; halls?: Hall[] },
): boolean {
  const aIds = new Set(allGameHallIds(a, ctx))
  if (aIds.size === 0) return false
  for (const id of allGameHallIds(b, ctx)) if (aIds.has(id)) return true
  return false
}
