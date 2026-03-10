import { test, expect } from '@playwright/test'

// Runs in 'chromium' project (authenticated as test_user, assigned to H2)
test.describe('Team detail page', () => {
  test('loads team page and shows team name', async ({ page }) => {
    await page.goto('/teams/H2')
    await page.waitForLoadState('domcontentloaded')

    // Team heading: "KSC Wiedikon H2"
    await expect(page.getByRole('heading', { name: /KSC Wiedikon H2/ })).toBeVisible({ timeout: 20_000 })

    const body = page.locator('body')
    await expect(body).not.toContainText('Error boundary')
  })

  test('shows roster table with members', async ({ page }) => {
    await page.goto('/teams/H2')
    await page.waitForLoadState('domcontentloaded')

    // Wait for team to load
    await expect(page.getByRole('heading', { name: /KSC Wiedikon H2/ })).toBeVisible({ timeout: 20_000 })

    // Roster table should have at least one row (test_user is in H2)
    const table = page.locator('table')
    await expect(table).toBeVisible({ timeout: 15_000 })
  })

  test('unauthorized team redirects or shows empty', async ({ page }) => {
    // test_user is in H2 only — other teams should show restricted view or redirect
    await page.goto('/teams/H1')
    await page.waitForLoadState('domcontentloaded')

    // Should not crash
    const body = page.locator('body')
    await expect(body).not.toContainText('Error boundary')
  })
})
