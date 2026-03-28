/**
 * Directus relation helpers.
 *
 * When a relation field is expanded via `fields: ['*', 'relation.*']`,
 * the field value becomes the full object instead of the raw ID.
 * These helpers safely extract IDs or objects regardless of expansion state.
 */

/** Extract the string ID from a relation field (expanded object or raw ID). */
export function relId(val: unknown): string {
  if (val == null) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object' && 'id' in val) return String((val as { id: unknown }).id)
  return ''
}

/** Safely extract an expanded relation object. Returns null if the value is a raw ID. */
export function asObj<T>(val: T | string | number | null | undefined): T | null {
  return val != null && typeof val === 'object' ? val as T : null
}
