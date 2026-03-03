import { test, expect } from '@playwright/test'
import { PUBLIC_ROUTES, VIEWPORTS } from '../../fixtures/test-data'

test.describe('Overflow — public pages at 320px', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} (${route.path}) — no horizontal overflow at 320px`, async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.xs)
      await page.goto(route.path)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(500)

      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(hasOverflow).toBe(false)
    })
  }
})

test.describe('Overflow — vertical layout', () => {
  test('footer is reachable by scrolling on home page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    const footer = page.locator('footer')
    await expect(footer).toBeAttached()
    await footer.scrollIntoViewIfNeeded()
    await expect(footer).toBeVisible()
  })

  test('content not hidden behind tab bar on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.xs)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const main = page.locator('main')
    await expect(main).toBeVisible({ timeout: 10_000 })

    const paddingBottom = await main.evaluate((el) => parseInt(getComputedStyle(el).paddingBottom))
    expect(paddingBottom).toBeGreaterThanOrEqual(90)

    const tabBar = page.locator('nav.fixed.bottom-0')
    if (await tabBar.isVisible()) {
      const tabBarBox = await tabBar.boundingBox()
      expect(tabBarBox).not.toBeNull()
      expect(paddingBottom).toBeGreaterThanOrEqual(tabBarBox!.height - 10)
    }
  })
})

test.describe('Overflow — scroll containers', () => {
  test('calendar grid does not overflow at 320px', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.xs)
    await page.goto('/calendar')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(hasOverflow).toBe(false)
  })

  test('games page rankings table has overflow-x-auto wrapper', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.xs)
    await page.goto('/games')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    // Switch to rankings tab if it exists
    const rankingsTab = page.getByRole('button', { name: /Rankings|Rangliste/ })
    if (await rankingsTab.isVisible()) {
      await rankingsTab.click()
      await page.waitForTimeout(500)

      const tableWrappers = page.locator('.overflow-x-auto')
      const count = await tableWrappers.count()
      if (count > 0) {
        const overflowX = await tableWrappers.first().evaluate(
          (el) => getComputedStyle(el).overflowX,
        )
        expect(overflowX).toBe('auto')
      }
    }
  })
})
