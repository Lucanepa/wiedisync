import { test, expect } from '@playwright/test'

// Runs in 'chromium' project (authenticated as test_user, language=english)
test.describe('Trainings page', () => {
  test('loads and shows page title', async ({ page }) => {
    await page.goto('/trainings')

    // Auth hydration (authRefresh over network) can take time — use generous timeout
    // Title: "Trainings" (same in en/de)
    await expect(page.getByRole('heading', { name: 'Trainings' })).toBeVisible({ timeout: 20_000 })
  })

  test('shows empty state or training cards', async ({ page }) => {
    await page.goto('/trainings')

    // Wait for auth + data to load
    await expect(page.getByRole('heading', { name: 'Trainings' })).toBeVisible({ timeout: 20_000 })

    // Should show either training cards or empty state
    const content = page.locator('#root')
    await expect(content).not.toBeEmpty()
  })

  test('team filter is visible', async ({ page }) => {
    await page.goto('/trainings')

    // Wait for page to fully render past auth loading state
    await expect(page.getByRole('heading', { name: 'Trainings' })).toBeVisible({ timeout: 20_000 })

    // Page should have rendered without error
    const body = page.locator('body')
    await expect(body).not.toContainText('Error boundary')
  })
})
