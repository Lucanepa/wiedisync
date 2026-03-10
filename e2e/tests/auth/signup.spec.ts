import { test, expect } from '@playwright/test'

// Runs in 'unauthenticated' project — signup page uses German labels by default
test.describe('Signup flow', () => {
  test.describe.configure({ mode: 'serial' })

  test('shows signup page with email step', async ({ page }) => {
    await page.goto('/signup')

    // Title: "Konto erstellen" (de)
    await expect(page.getByRole('heading', { name: 'Konto erstellen' })).toBeVisible()

    // Email input and continue button
    await expect(page.getByPlaceholder('name@beispiel.ch')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible()

    // Club logo
    await expect(page.getByAltText('KSC Wiedikon')).toBeVisible()
  })

  test('has link to login page', async ({ page }) => {
    await page.goto('/signup')

    // "Bereits ein Konto?" + "Anmelden" link
    await expect(page.getByText('Bereits ein Konto?')).toBeVisible()
    const loginLink = page.getByRole('link', { name: 'Anmelden' })
    await expect(loginLink).toBeVisible()
  })

  test('shows account claim step for existing email', async ({ page }) => {
    await page.goto('/signup')

    // Enter an existing test account email
    await page.getByPlaceholder('name@beispiel.ch').fill('test_user@test.ch')
    const continueBtn = page.getByRole('button', { name: 'Weiter' })

    // Retry transition in case check-email endpoint is briefly rate-limited.
    for (let attempt = 1; attempt <= 3; attempt++) {
      await continueBtn.click()
      try {
        await expect(page.getByText('Konto gefunden')).toBeVisible({ timeout: 4_000 })
        return
      } catch {
        if (attempt === 3) throw new Error('Could not reach account-claim step from signup page')
        await page.waitForTimeout(3_500)
      }
    }
  })

  test('shows registration form for new email', async ({ page }) => {
    await page.goto('/signup')

    // Enter a non-existing email
    await page.getByPlaceholder('name@beispiel.ch').fill('new_user_e2e_test@nonexistent.local')
    const continueBtn = page.getByRole('button', { name: 'Weiter' })

    // Retry transition in case check-email endpoint is briefly rate-limited.
    for (let attempt = 1; attempt <= 3; attempt++) {
      await continueBtn.click()
      try {
        await expect(page.getByPlaceholder('Passwort eingeben')).toBeVisible({ timeout: 4_000 })
        break
      } catch {
        if (attempt === 3) throw new Error('Could not reach registration step from signup page')
        await page.waitForTimeout(3_500)
      }
    }

    // Team selector should be visible
    const teamSelect = page.locator('select')
    await expect(teamSelect).toBeVisible()
  })
})

test.describe('Unapproved user redirect', () => {
  test('unapproved user is redirected to /pending on protected routes', async ({ page }) => {
    // Use PocketBase REST API to login — retry once if rate-limited
    const pbUrl = process.env.VITE_PB_URL!
    let response = await page.request.post(
      `${pbUrl}/api/collections/members/auth-with-password`,
      { data: { identity: 'test_unapproved@test.ch', password: process.env.TEST_USER_PASSWORD! } },
    )
    if (!response.ok()) {
      // PB rate limit (2 req/3s) — wait and retry
      await page.waitForTimeout(4_000)
      response = await page.request.post(
        `${pbUrl}/api/collections/members/auth-with-password`,
        { data: { identity: 'test_unapproved@test.ch', password: process.env.TEST_USER_PASSWORD! } },
      )
    }
    expect(response.ok()).toBeTruthy()

    const authData = await response.json()

    // Navigate to app and inject auth token
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    await page.evaluate((data) => {
      localStorage.setItem(
        'pocketbase_auth',
        JSON.stringify({ token: data.token, record: data.record }),
      )
    }, authData)

    // Navigate to a protected route — should redirect to /pending
    await page.goto('/trainings')
    await expect(page).toHaveURL('/pending', { timeout: 10_000 })

    // Pending page shows approval message
    // English: "Pending Approval" / German: "Freigabe ausstehend"
    await expect(page.getByText(/Pending Approval|Freigabe ausstehend/)).toBeVisible({
      timeout: 10_000,
    })
  })
})
