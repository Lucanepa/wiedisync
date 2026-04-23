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

/**
 * Current SVRZ season in long form (e.g. "2025/2026"), using the Jun 1
 * cutover — Swiss Volley publishes new-season fixtures in June.
 *
 * NOTE: `directus/extensions/kscw-hooks/src/index.js` (SVRZ cron) and
 * `directus/extensions/kscw-endpoints/src/game-scheduling.js` (svrz-sync
 * endpoint) duplicate this same logic inline (they can't cross-import from
 * src/). If you change the cutover here, mirror it there.
 */
export function currentSeasonLong(now: Date = new Date()): string {
  const startYear = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1
  return `${startYear}/${startYear + 1}`
}
