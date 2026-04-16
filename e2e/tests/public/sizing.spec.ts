import { test, expect } from '@playwright/test'
import { VIEWPORTS } from '../../fixtures/test-data'

test.describe('Sizing — login page elements', () => {
  test('login button meets minimum touch target height (40px)', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    const submitBtn = page.getByRole('button', { name: /Anmelden|Sign in/ })
    await expect(submitBtn).toBeVisible({ timeout: 10_000 })

    const box = await submitBtn.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(40)
    expect(box!.width).toBeGreaterThanOrEqual(44)
  })

  test('login inputs have adequate height for touch (36px)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.xs)
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    const inputs = page.locator('input[type="email"], input[type="password"]')
    const count = await inputs.count()
    expect(count).toBe(2)

    for (let i = 0; i < count; i++) {
      const box = await inputs.nth(i).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(36)
    }
  })
})

test.describe('Sizing — images', () => {
  test('club logo has valid dimensions on games page', async ({ page }) => {
    await page.goto('/games')
    await page.waitForLoadState('domcontentloaded')

    const logo = page.getByAltText('KSC Wiedikon')
    await expect(logo).toBeVisible({ timeout: 10_000 })

    const box = await logo.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThan(0)
    expect(box!.height).toBeGreaterThanOrEqual(60)
  })
})
