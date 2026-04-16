import { test, expect } from '@playwright/test'
import { VIEWPORTS } from '../../fixtures/test-data'

test.describe('Grid layout — responsive column counts', () => {
  test('TeamsPage grid: 1 col at xs, 2 at sm, 3 at lg', async ({ page }) => {
    // xs viewport — single column
    await page.setViewportSize(VIEWPORTS.xs)
    await page.goto('/teams')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    const grid = page.locator('.grid.gap-4').first()
    if (await grid.isVisible()) {
      let cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns)
      expect(cols.split(' ').filter((c: string) => c !== '0px').length).toBe(1)

      // sm viewport — 2 columns
      await page.setViewportSize(VIEWPORTS.sm)
      await page.waitForTimeout(300)
      cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns)
      expect(cols.split(' ').filter((c: string) => c !== '0px').length).toBe(2)

      // lg viewport — 3 columns
      await page.setViewportSize(VIEWPORTS.lg)
      await page.waitForTimeout(300)
      cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns)
      expect(cols.split(' ').filter((c: string) => c !== '0px').length).toBe(3)
    }
  })

  test('GamesPage card grid: 1 col at xs', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.xs)
    await page.goto('/games')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    const grid = page.locator('.grid.gap-4').first()
    if (await grid.isVisible()) {
      const cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns)
      expect(cols.split(' ').filter((c: string) => c !== '0px').length).toBe(1)
    }
  })

  test('CalendarGrid always renders 7 columns at any viewport', async ({ page }) => {
    for (const [name, vp] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize(vp)
      await page.goto('/calendar')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const dayGrid = page.locator('.grid-cols-7').last()
      if (await dayGrid.isVisible()) {
        const cols = await dayGrid.evaluate((el) => getComputedStyle(el).gridTemplateColumns)
        const colCount = cols.split(' ').filter((c: string) => c !== '0px').length
        expect(colCount, `CalendarGrid should have 7 cols at ${name} (${vp.width}px)`).toBe(7)
      }
    }
  })

  test('EventsPage renders at all viewports without crash', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.xs)
    await page.goto('/events')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 })

    // Desktop
    await page.setViewportSize(VIEWPORTS.lg)
    await page.waitForTimeout(300)
    await expect(page.locator('main')).toBeVisible()
  })
})

test.describe('Grid layout — no overlapping items', () => {
  test('TeamsPage cards do not overlap at sm breakpoint', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.sm)
    await page.goto('/teams')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    const cards = page.locator('.grid.gap-4 > *')
    const count = await cards.count()
    if (count < 2) return

    const boxes: Array<{ x: number; y: number; width: number; height: number }> = []
    for (let i = 0; i < count; i++) {
      const box = await cards.nth(i).boundingBox()
      if (box) boxes.push(box)
    }

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        const overlapsX = a.x < b.x + b.width && a.x + a.width > b.x
        const overlapsY = a.y < b.y + b.height && a.y + a.height > b.y
        expect(overlapsX && overlapsY, `Cards ${i} and ${j} overlap`).toBe(false)
      }
    }
  })
})
