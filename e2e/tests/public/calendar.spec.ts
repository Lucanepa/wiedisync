import { test, expect } from '@playwright/test'

// Runs in 'unauthenticated' project — calendar is public, defaults to German
test.describe('Calendar page', () => {
  test('loads and shows title', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForLoadState('domcontentloaded')

    // German: "Kalender"
    await expect(page.getByRole('heading', { name: 'Kalender' })).toBeVisible({ timeout: 10_000 })
  })

  test('shows view toggle buttons', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForLoadState('domcontentloaded')

    // Two view options: "Halle", "Kalender" (de)
    await expect(page.getByRole('button', { name: 'Halle', exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Kalender', exact: true })).toBeVisible()
  })

  test('can switch to month view', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: 'Kalender', exact: true }).click()

    // Should not crash after switching views
    const body = page.locator('body')
    await expect(body).not.toContainText('Error boundary')
  })

  test('shows filter chips for games in month view', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForLoadState('domcontentloaded')

    // Switch to month/calendar view to see filters
    await page.getByRole('button', { name: 'Kalender', exact: true }).click()

    // Unauthenticated user should see filter chips
    // German: "Heimspiele", "Auswärtsspiele"
    await expect(page.getByRole('button', { name: 'Heimspiele' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Auswärtsspiele' })).toBeVisible()
  })
})
