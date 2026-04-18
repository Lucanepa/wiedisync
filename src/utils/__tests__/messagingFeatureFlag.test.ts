import { describe, it, expect, vi, afterEach } from 'vitest'

const load = async () => (await import('../messagingFeatureFlag')).messagingFeatureEnabled

afterEach(() => { vi.resetModules() })

describe('messagingFeatureEnabled', () => {
  it('returns true when VITE_FEATURE_MESSAGING === "true"', async () => {
    vi.stubEnv('VITE_FEATURE_MESSAGING', 'true')
    const fn = await load()
    expect(fn()).toBe(true)
  })

  it('returns false when the var is unset', async () => {
    vi.stubEnv('VITE_FEATURE_MESSAGING', '')
    const fn = await load()
    expect(fn()).toBe(false)
  })

  it('returns false for any non-"true" string', async () => {
    vi.stubEnv('VITE_FEATURE_MESSAGING', '1')
    const fn = await load()
    expect(fn()).toBe(false)
  })
})
