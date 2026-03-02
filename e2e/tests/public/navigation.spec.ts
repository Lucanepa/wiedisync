import { test, expect } from '@playwright/test'
import { PUBLIC_ROUTES } from '../../fixtures/test-data'

test.describe('Public route smoke tests', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} (${route.path}) loads without error`, async ({ page }) => {
      const response = await page.goto(route.path)
      // Vite dev server returns 200 for all SPA routes
      expect(response?.status()).toBe(200)

      // Wait for the page to render
      await page.waitForLoadState('domcontentloaded')

      // No uncaught React error boundaries
      const body = page.locator('body')
      await expect(body).not.toContainText('Error boundary')
      await expect(body).not.toContainText('Something went wrong')
    })
  }
})
