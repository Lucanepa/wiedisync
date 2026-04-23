/**
 * Convert long-form SVRZ season names (e.g. "2025/2026") to Wiedisync's
 * short convention ("2025/26"). Returns the input unchanged for anything
 * that doesn't match the YYYY/YYYY pattern.
 */
export function formatSeasonShort(name: string | null | undefined): string {
  if (!name) return ''
  const m = name.match(/^(\d{4})\/(\d{4})$/)
  return m ? `${m[1]}/${m[2].slice(-2)}` : name
}
