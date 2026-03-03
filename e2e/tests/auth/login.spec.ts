import { test, expect } from '@playwright/test'
import { LoginPage } from '../../pages/login.page'

// Serial to avoid PocketBase auth rate limiting (2 req / 3s)
test.describe.serial('Login flow', () => {
  test('shows login page with logo and form', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    await expect(loginPage.logo).toBeVisible()
    await expect(loginPage.emailInput).toBeVisible()
    await expect(loginPage.passwordInput).toBeVisible()
    await expect(loginPage.submitButton).toBeVisible()
    await expect(loginPage.submitButton).toHaveText('Anmelden')
  })

  test('shows error on invalid credentials', async ({ page }) => {
    // Brief pause to avoid PocketBase rate limit collision with concurrent auth requests
    await page.waitForTimeout(2_000)

    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login('wrong@example.com', 'wrongpassword')

    await expect(loginPage.errorMessage).toBeVisible({ timeout: 10_000 })
  })

  test('successful login redirects to home', async ({ page }) => {
    // Wait for rate limit window to clear after invalid creds test
    await page.waitForTimeout(3_000)

    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login(
      process.env.TEST_USER_EMAIL!,
      process.env.TEST_USER_PASSWORD!,
    )

    await expect(page).toHaveURL('/', { timeout: 15_000 })
  })
})
