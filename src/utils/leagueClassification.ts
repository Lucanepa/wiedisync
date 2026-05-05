/**
 * Returns true if the league name represents a cup / tournament / playoff
 * (excluded from regular season standings + attendance % when "league only" is on).
 */
export function isCupGame(league: string | null | undefined): boolean {
  if (!league) return false
  return /Cup|Pokal|Turnier/i.test(league)
}
