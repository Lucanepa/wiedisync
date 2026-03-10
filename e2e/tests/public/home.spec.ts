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

    // HomePage renders section headers from de/home.ts translations
    // At least one of these should be visible: "Nächste Spiele", "Letzte Resultate", "Events"
    const sections = page.locator('h2')
    await expect(sections.first()).toBeVisible({ timeout: 30_000 })
  })
})
