import { test, expect, devices } from '@playwright/test'
import { PUBLIC_ROUTES } from '../../fixtures/test-data'

// Use Pixel 7 viewport for mobile tests in the unauthenticated project
test.use({ ...devices['Pixel 7'] })

test.describe('Mobile UI — public pages (unauthenticated)', () => {
  test('bottom tab bar shows limited tabs for unauthenticated user', async ({ page }) => {
    await page.goto('/games')
    await page.waitForLoadState('domcontentloaded')

    const tabBar = page.locator('nav.fixed.bottom-0')
    await expect(tabBar).toBeVisible({ timeout: 10_000 })

    // Unauthenticated users see: Home, Calendar, Games (3 public tabs + More)
    // Auth-required tabs (Trainings, Teams) should NOT be visible
    const tabItems = tabBar.locator('a, button')
    // 3 public NavLinks + 1 More button = 4
    await expect(tabItems).toHaveCount(4)
  })

  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} (${route.path}) — no horizontal overflow on mobile`, async ({ page }) => {
      await page.goto(route.path)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(500)

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(hasOverflow).toBe(false)
    })
  }

  test('no desktop sidebar at mobile viewport', async ({ page }) => {
    await page.goto('/games')
    await page.waitForLoadState('domcontentloaded')

    // Desktop sidebar rail (w-16 shrink-0) should not render
    const sidebarRail = page.locator('div.flex.h-screen > div.w-16.shrink-0')
    await expect(sidebarRail).toHaveCount(0)
  })

  test('public page mobile screenshots', async ({ page }) => {
    await page.goto('/games')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    await expect(page).toHaveScreenshot('games-mobile-public.png', {
      maxDiffPixelRatio: 0.10, // games page has dynamic data that changes daily
    })
  })

  test('login page mobile layout', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    // Login form should be centered and not overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasOverflow).toBe(false)

    // Login button should be visible and touch-friendly
    const loginBtn = page.getByRole('button', { name: /Anmelden|Log in|Sign in/ })
    await expect(loginBtn).toBeVisible({ timeout: 10_000 })

    const btnBox = await loginBtn.boundingBox()
    expect(btnBox).not.toBeNull()
    expect(btnBox!.height).toBeGreaterThanOrEqual(40)
  })
})
