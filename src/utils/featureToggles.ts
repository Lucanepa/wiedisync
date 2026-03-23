import type { FeatureToggles } from '../types'

export type FeatureKey = keyof FeatureToggles

/**
 * Check whether a feature is enabled for a team.
 * Features default to OFF (false) when the key is missing or undefined.
 */
export function isFeatureEnabled(
  toggles: FeatureToggles | undefined | null,
  feature: FeatureKey,
): boolean {
  if (!toggles) return false
  return toggles[feature] === true
}
