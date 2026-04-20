/**
 * Promotion / relegation color logic for SVRZ league rankings.
 *
 * Per SVRZ Volleyballreglement 25/26 Art. 102a (ER SVRZ – Auf- und Abstieg):
 *   1st of each group: direct promotion              → green
 *   2nd of each group: barrage up (Entscheidungsspiel) → blue
 *   2nd-to-last:       barrage down                   → orange
 *   Last:              direct relegation              → red
 *
 * League structure: men have 1L–4L, women have 1L–5L (per referee/scorer
 * tables in the reglement — 5L column is empty for Herren). So men's 4L is
 * the bottom league and has no relegation/barrage-down. 2L gets additional
 * relegations per Art. 102a.5 when team count ≥ 11 (encoded as 2 reds).
 *
 * Talents (RTZ) teams: per Art. 102a.7 and Anhang they cannot promote or
 * relegate. They get no color themselves, AND they are skipped when
 * determining who sits in a promotion or relegation slot — e.g. if the
 * 1st-placed team is Talents, the 2nd-placed team takes the green marker
 * (Art. 102a.2: promotion shifts to next eligible, up to rank 3).
 *
 * Youth / Classics / Cup / Turnier leagues → no coloring.
 */

export type PromotionColor = 'green' | 'blue' | 'orange' | 'red' | null

export interface RankingLike {
  rank: number
  team_name?: string | null
}

/** Extract league level (1-5) from league name, or null if not applicable. */
function parseLeagueLevel(league: string): number | null {
  // Skip youth, classics, cup, turnier, plausch, etc.
  if (/U\d|Jugend|Junior|Classics|Cup|Turnier|Plausch|Mini/i.test(league)) return null

  // Volleyball only: "3. Liga" or "3.Liga" etc.
  const vbMatch = league.match(/(\d)\.\s*Liga/i)
  if (vbMatch) return parseInt(vbMatch[1], 10)

  return null
}

function isWomenLeague(league: string): boolean {
  return /damen|frauen/i.test(league)
}

function isTalentsTeam(name?: string | null): boolean {
  return !!name && /talents/i.test(name)
}

/**
 * Map a team's raw rank to its 1-based position among eligible (non-Talents)
 * teams, plus the eligible total. Returns null for Talents rows themselves.
 * When `allRankings` is not provided, falls back to raw rank/totalTeams.
 */
function effectivePosition(
  rank: number,
  teamName: string | undefined,
  totalTeams: number,
  allRankings: RankingLike[] | undefined,
): { position: number; total: number } | null {
  if (isTalentsTeam(teamName)) return null
  if (!allRankings || allRankings.length === 0) {
    return { position: rank, total: totalTeams }
  }
  const eligible = allRankings
    .filter((r) => !isTalentsTeam(r.team_name))
    .sort((a, b) => a.rank - b.rank)
  const idx = eligible.findIndex((r) => r.rank === rank)
  if (idx === -1) return null
  return { position: idx + 1, total: eligible.length }
}

export function getPromotionColor(
  league: string,
  rank: number,
  totalTeams: number,
  teamName?: string,
  allRankings?: RankingLike[],
): PromotionColor {
  const level = parseLeagueLevel(league)
  if (!level) return null

  const eff = effectivePosition(rank, teamName, totalTeams, allRankings)
  if (!eff) return null

  const pos = eff.position
  const total = eff.total
  const isWomen = isWomenLeague(league)

  switch (level) {
    case 5:
      // 5L is women-only and the bottom league — no barrage down / relegation.
      if (pos === 1) return 'green'
      if (pos === 2) return 'blue'
      return null

    case 4:
      // Men's 4L is the bottom league (no 5L for Herren) — no down moves.
      // Women's 4L sits above 5L, so full rules apply.
      if (pos === 1) return 'green'
      if (pos === 2) return 'blue'
      if (isWomen) {
        if (pos === total - 1) return 'orange'
        if (pos === total) return 'red'
      }
      return null

    case 3:
      if (pos === 1) return 'green'
      if (pos === 2) return 'blue'
      if (pos === total - 1) return 'orange'
      if (pos === total) return 'red'
      return null

    case 2:
      if (pos === 1) return 'green'
      if (pos === 2) return 'blue'
      if (pos === total || pos === total - 1) return 'red'
      if (pos === total - 2) return 'orange'
      return null

    case 1:
      if (pos === 1) return 'green'
      if (pos === total) return 'red'
      return null

    default:
      return null
  }
}

/** CSS border-left color classes for each promotion color. */
export const promotionBorderColors: Record<PromotionColor & string, string> = {
  green: 'border-l-4 border-l-green-500',
  blue: 'border-l-4 border-l-blue-500',
  orange: 'border-l-4 border-l-orange-500',
  red: 'border-l-4 border-l-red-500',
}
