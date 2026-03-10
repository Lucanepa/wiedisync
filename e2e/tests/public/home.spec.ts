import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
  test('loads and shows club branding', async ({ page }) => {
    await page.goto('/')
    // The KSC Wiedikon logo is in the layout header
    await expect(page.getByAltText('KSC Wiedikon')).toBeVisible({ timeout: 10_000 })
  })

  test('shows section headers after data loads', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Home content can vary with remote data, assert semantic page structure renders.
    await expect(page.locator('main')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 30_000 })
  })
})
