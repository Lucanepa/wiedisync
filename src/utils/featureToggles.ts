import type { FeatureToggles, TeamSettings } from '../types'

export type FeatureKey = keyof TeamSettings

/**
 * Check whether a feature is enabled for a team or event.
 * Features default to OFF (false) when the key is missing or undefined.
 */
export function isFeatureEnabled(
  toggles: FeatureToggles | TeamSettings | undefined | null,
  feature: FeatureKey,
): boolean {
  if (!toggles) return false
  return (toggles as TeamSettings)[feature] === true
}
