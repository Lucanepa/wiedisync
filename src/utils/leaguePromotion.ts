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
 * Youth / Classics / Cup / Turnier leagues → no coloring.
 */

export type PromotionColor = 'green' | 'blue' | 'orange' | 'red' | null

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

export function getPromotionColor(
  league: string,
  rank: number,
  totalTeams: number,
  teamName?: string,
): PromotionColor {
  const level = parseLeagueLevel(league)
  if (!level) return null

  // Skip "talents" teams for 2. Liga relegation calculation
  const isTalents = teamName ? /talents/i.test(teamName) : false
  if (isTalents) return null

  const isWomen = isWomenLeague(league)

  switch (level) {
    case 5:
      // 5L is women-only and the bottom league — no barrage down / relegation.
      if (rank === 1) return 'green'
      if (rank === 2) return 'blue'
      return null

    case 4:
      // Men's 4L is the bottom league (no 5L for Herren) — no down moves.
      // Women's 4L sits above 5L, so full rules apply.
      if (rank === 1) return 'green'
      if (rank === 2) return 'blue'
      if (isWomen) {
        if (rank === totalTeams - 1) return 'orange'
        if (rank === totalTeams) return 'red'
      }
      return null

    case 3:
      if (rank === 1) return 'green'
      if (rank === 2) return 'blue'
      if (rank === totalTeams - 1) return 'orange'
      if (rank === totalTeams) return 'red'
      return null

    case 2:
      if (rank === 1) return 'green'
      if (rank === totalTeams || rank === totalTeams - 1) return 'red'
      if (rank === totalTeams - 2) return 'orange'
      return null

    case 1:
      if (rank === 1) return 'green'
      if (rank === totalTeams) return 'red'
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
