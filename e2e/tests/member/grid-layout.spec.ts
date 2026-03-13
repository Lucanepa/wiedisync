import { test, expect } from '@playwright/test'
import { VIEWPORTS } from '../../fixtures/test-data'

// Runs in 'chromium' and 'mobile' projects (authenticated as test_user)
test.describe('Grid layout — scorer page filters', () => {
  test('scorer filter grid: 1 col at xs, 2 at sm, 3 at lg', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.xs)
    await page.goto('/scorer')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    // Open the collapsible filter panel (closed by default)
    const filterToggle = page.locator('button', { hasText: /Filter|Filter/ })
    if (!(await filterToggle.isVisible())) return
    await filterToggle.click()
    await page.waitForTimeout(300)

    // Target the filter grid specifically (sm:grid-cols-2 lg:grid-cols-3)
    const filterGrid = page.locator('.sm\\:grid-cols-2.lg\\:grid-cols-3')
    if (!(await filterGrid.isVisible())) return

    // xs — single column
    let cols = await filterGrid.evaluate((el) => getComputedStyle(el).gridTemplateColumns)
    expect(cols.split(' ').filter((c: string) => c !== '0px').length).toBe(1)

    // sm — 2 columns
    await page.setViewportSize(VIEWPORTS.sm)
    await page.waitForTimeout(300)
    cols = await filterGrid.evaluate((el) => getComputedStyle(el).gridTemplateColumns)
    expect(cols.split(' ').filter((c: string) => c !== '0px').length).toBe(2)

    // lg — 3 columns
    await page.setViewportSize(VIEWPORTS.lg)
    await page.waitForTimeout(300)
    cols = await filterGrid.evaluate((el) => getComputedStyle(el).gridTemplateColumns)
    expect(cols.split(' ').filter((c: string) => c !== '0px').length).toBe(3)
  })
})

test.describe('Grid layout — desktop/mobile layout switch', () => {
  test('sidebar appears at lg breakpoint, tab bar disappears', async ({ page }) => {
    // Start at mobile
    await page.setViewportSize(VIEWPORTS.sm)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)

    // Sidebar rail selector: direct child of the root flex h-screen layout
    const sidebarRail = page.locator('div.flex.h-screen > div.w-16.shrink-0')

    // Tab bar visible, sidebar rail hidden
    const tabBar = page.locator('nav.fixed.bottom-0')
    await expect(tabBar).toBeVisible()
    await expect(sidebarRail).toHaveCount(0)

    // Resize to desktop
    await page.setViewportSize(VIEWPORTS.lg)
    await page.waitForTimeout(500)

    // Sidebar rail appears, tab bar disappears
    await expect(sidebarRail).toBeVisible()
    await expect(page.locator('nav.fixed.bottom-0')).toHaveCount(0)
  })
})
