import { test as setup, expect } from '@playwright/test'

setup.describe.configure({ mode: 'serial' })

const USER_FILE = 'e2e/.auth/user.json'
const ADMIN_FILE = 'e2e/.auth/admin.json'

const PB_URL = process.env.VITE_PB_URL!

/**
 * Authenticate via PocketBase REST API directly, then inject the auth token
 * into localStorage so the app picks it up. This avoids the UI login form
 * and its rate-limiting issues (PocketBase: 2 auth req / 3s per IP).
 */
async function loginViaAPI(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  storageStatePath: string,
) {
  // Call the PocketBase auth endpoint directly with retry for strict rate limits.
  let response: import('@playwright/test').APIResponse | null = null
  for (let attempt = 1; attempt <= 4; attempt++) {
    response = await page.request.post(
      `${PB_URL}/api/collections/members/auth-with-password`,
      {
        data: { identity: email, password },
      },
    )
    if (response.ok()) break
    if (response.status() !== 429 || attempt === 4) break
    await page.waitForTimeout(2_000)
  }

  expect(response?.ok(), `Login API failed for ${email}: ${response?.status()}`).toBeTruthy()

  const authData = await response!.json()

  // Navigate to the app so we can set localStorage on the correct origin
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')

  // Inject PocketBase auth token into localStorage (same format the SDK uses)
  await page.evaluate((data) => {
    localStorage.setItem(
      'pocketbase_auth',
      JSON.stringify({ token: data.token, record: data.record }),
    )
  }, authData)

  // Reload so the app picks up the auth state
  await page.reload()
  await page.waitForLoadState('domcontentloaded')

  // Verify we're authenticated — should be on home page, not redirected to /login
  await expect(page).toHaveURL('/', { timeout: 15_000 })

  // Save the full storage state (localStorage + cookies) for reuse
  await page.context().storageState({ path: storageStatePath })
}

setup('authenticate as regular user', async ({ page }) => {
  await loginViaAPI(
    page,
    process.env.TEST_USER_EMAIL!,
    process.env.TEST_USER_PASSWORD!,
    USER_FILE,
  )
})

setup('authenticate as admin', async ({ page }) => {
  await loginViaAPI(
    page,
    process.env.TEST_ADMIN_EMAIL!,
    process.env.TEST_ADMIN_PASSWORD!,
    ADMIN_FILE,
  )
})

