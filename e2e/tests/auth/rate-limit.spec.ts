import { test, expect } from '@playwright/test'

const PB_URL = process.env.VITE_PB_URL!
const AUTH_ENDPOINT = `${PB_URL}/api/collections/members/auth-with-password`

// Skip entirely when the PB API is unreachable (e.g. CI without a live instance)
let apiReachable = true
test.beforeAll(async ({ request }) => {
  try {
    await request.get(`${PB_URL}/api/health`, { timeout: 5_000 })
  } catch {
    apiReachable = false
  }
})

// PocketBase rate limit config: 2 auth requests per 3-second window (*:auth rule)
// These tests verify the rate limiter is active and protecting the auth endpoint.
//
// NOTE: Rate limiting is per-IP. In production, CF-Connecting-IP differentiates
// clients behind Cloudflare Tunnel. In tests, all requests share one IP.

test.describe.serial('Auth rate limiting', () => {
  test('PocketBase returns 429 when auth rate limit is exceeded', async ({ request }) => {
    test.skip(!apiReachable, 'PocketBase API is not reachable')
    // Wait for any previous rate-limit window from other tests to clear
    await new Promise((r) => setTimeout(r, 5_000))

    // Fire 3 rapid auth requests — limit is 2 per 3s, so the 3rd should be rejected
    const results = await Promise.all([
      request.post(AUTH_ENDPOINT, {
        data: { identity: 'ratelimit-test-1@fake.local', password: 'x' },
      }),
      request.post(AUTH_ENDPOINT, {
        data: { identity: 'ratelimit-test-2@fake.local', password: 'x' },
      }),
      request.post(AUTH_ENDPOINT, {
        data: { identity: 'ratelimit-test-3@fake.local', password: 'x' },
      }),
    ])

    const statuses = results.map((r) => r.status())

    // At least one request should be rate-limited (429)
    const has429 = statuses.some((s) => s === 429)
    // The non-rate-limited requests should fail auth (400) — not succeed
    const nonRateLimited = statuses.filter((s) => s !== 429)
    const allNon429Are400 = nonRateLimited.every((s) => s === 400)

    expect(has429, `Expected at least one 429 in [${statuses}]`).toBeTruthy()
    expect(allNon429Are400, `Non-rate-limited responses should be 400, got [${statuses}]`).toBeTruthy()
  })

  test('auth requests succeed again after rate limit window expires', async ({ request }) => {
    test.skip(!apiReachable, 'PocketBase API is not reachable')
    // Wait well beyond the 3s rate limit window for full recovery.
    // Other concurrent test workers may also be hitting auth endpoints,
    // so we use a generous buffer.
    await new Promise((r) => setTimeout(r, 10_000))

    // Single request should go through (returns 400 for bad creds, not 429)
    const response = await request.post(AUTH_ENDPOINT, {
      data: { identity: 'ratelimit-recovery@fake.local', password: 'x' },
    })

    expect(response.status(), 'Should get 400 (bad creds), not 429 (rate limited)').toBe(400)
  })
})
