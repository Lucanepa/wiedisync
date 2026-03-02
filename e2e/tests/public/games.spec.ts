import { test, expect } from '@playwright/test'

test.describe('Games page', () => {
  test('loads without crashing', async ({ page }) => {
    await page.goto('/games')
    await page.waitForLoadState('networkidle')

    // GamesPage renders tab navigation (GameTabs component)
    // Check the page rendered something meaningful
    const body = page.locator('body')
    await expect(body).not.toContainText('Error')
  })

  test('shows team filter or game content', async ({ page }) => {
    await page.goto('/games')
    await page.waitForLoadState('networkidle')

    // The page should contain either game cards or a "no games" message
    // TeamFilterBar renders filter chip buttons
    const pageContent = page.locator('#root')
    await expect(pageContent).not.toBeEmpty()
  })
})
