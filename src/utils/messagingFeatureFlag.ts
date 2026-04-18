/**
 * Gate for the KSCW messaging feature (Plans 02-06).
 * Strict-string match against 'true' so `VITE_FEATURE_MESSAGING=1` doesn't
 * accidentally enable in dev environments that use numeric truthy values.
 */
export function messagingFeatureEnabled(): boolean {
  return import.meta.env.VITE_FEATURE_MESSAGING === 'true'
}
