import { test, expect } from '@playwright/test'

test.describe('Games page', () => {
  test('loads without crashing', async ({ page }) => {
    await page.goto('/games')
    await page.waitForLoadState('domcontentloaded')

    // GamesPage renders tab navigation (GameTabs component)
    // Check the page rendered something meaningful
    const body = page.locator('body')
    await expect(body).not.toContainText('Error boundary')
  })

  test('shows team filter or game content', async ({ page }) => {
    await page.goto('/games')
    await page.waitForLoadState('domcontentloaded')

    // Wait for content to appear — games page loads data asynchronously
    const pageContent = page.locator('#root')
    await expect(pageContent).not.toBeEmpty({ timeout: 15_000 })
  })
})
