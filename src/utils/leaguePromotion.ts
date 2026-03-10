/**
 * Promotion / relegation color logic for league rankings.
 *
 * Rules by league level (same for men/women in volleyball):
 *   5. Liga: green 1st
 *   4. Liga: green 1st, red last
 *   3. Liga: green 1st, blue 2nd, red last
 *   2. Liga: green 1st, red last 2, orange 3rd-last (skip "talents" teams)
 *   1. Liga: green 1st, red last
 *
 * Youth / Classics / Cup / Turnier leagues → no coloring.
 */

export type PromotionColor = 'green' | 'blue' | 'orange' | 'red' | null

/** Extract league level (1-5) from league name, or null if not applicable. */
function parseLeagueLevel(league: string): number | null {
  // Skip youth, classics, cup, turnier, plausch, etc.
  if (/U\d|Jugend|Junior|Classics|Cup|Turnier|Plausch|Mini/i.test(league)) return null

  // Volleyball: "3. Liga" or "3.Liga" etc.
  const vbMatch = league.match(/(\d)\.\s*Liga/i)
  if (vbMatch) return parseInt(vbMatch[1], 10)

  // Basketball: league codes like "H1L", "D2L", "H3LRA" etc.
  const bbMatch = league.match(/[HDM](\d)L/i)
  if (bbMatch) return parseInt(bbMatch[1], 10)

  return null
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

  switch (level) {
    case 5:
      if (rank === 1) return 'green'
      return null

    case 4:
      if (rank === 1) return 'green'
      if (rank === totalTeams) return 'red'
      return null

    case 3:
      if (rank === 1) return 'green'
      if (rank === 2) return 'blue'
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
