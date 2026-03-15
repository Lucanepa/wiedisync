/**
 * Shortens Swiss Volley league names for compact display.
 *
 * Examples:
 *   "Herren 2. Liga"              → "2LM"
 *   "Frauen 3. Liga Gruppe B"     → "3LD - B"
 *   "Herren 4. Liga Gruppe A"     → "4LM - A"
 *   "Frauen 5. Liga Gruppe B"     → "5LD - B"
 *   "Frauen U23 1. Liga"          → "U23D 1L"
 *   "Frauen U23 2. Liga"          → "U23D 2L"
 *   "Männer U23 Gruppe A"         → "U23M - A"
 *   "SM Quali U23"                → "SM Quali U23"
 */
export function leagueShort(league: string): string {
  if (!league) return ''

  // Detect gender: M = Herren/Männer, D = Frauen/Damen
  let gender = ''
  if (/Herren|Männer/i.test(league)) gender = 'M'
  else if (/Frauen|Damen/i.test(league)) gender = 'D'

  // Detect group suffix: "Gruppe A" → "- A"
  const groupMatch = league.match(/Gruppe\s+(\S+)/i)
  const group = groupMatch ? ` - ${groupMatch[1]}` : ''

  // U23 pattern
  if (/U23/i.test(league)) {
    const ligaMatch = league.match(/(\d+)\.\s*Liga/i)
    const ligaSuffix = ligaMatch ? ` ${ligaMatch[1]}L` : ''
    return `U23${gender}${ligaSuffix}${group}`
  }

  // Standard league: "N. Liga" → "NL"
  const ligaMatch = league.match(/(\d+)\.\s*Liga/i)
  if (ligaMatch) {
    return `${ligaMatch[1]}L${gender}${group}`
  }

  // Fallback: strip em-dash separators for compact display
  return league.replace(/\s*—\s*/g, '\n')
}
