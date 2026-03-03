import { test, expect } from '@playwright/test'
import { PUBLIC_ROUTES, AUTH_ROUTES } from '../../fixtures/test-data'

// Runs in 'mobile' project (Pixel 7 viewport, authenticated as test_user)
test.describe('Mobile UI — navigation', () => {
  test('bottom tab bar is visible', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Bottom tab bar is a <nav> fixed at the bottom
    const tabBar = page.locator('nav').filter({ has: page.getByRole('link', { name: /Home|Startseite/ }) })
    await expect(tabBar).toBeVisible({ timeout: 10_000 })
  })

  test('bottom tab bar shows all primary tabs for authenticated user', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // 5 primary tabs + 1 More button for authenticated users
    // Home, Calendar, Games, Trainings, Teams, More
    const tabBar = page.locator('nav.fixed.bottom-0')
    await expect(tabBar).toBeVisible({ timeout: 10_000 })

    // Count NavLinks + More button inside tab bar
    const tabItems = tabBar.locator('a, button')
    await expect(tabItems).toHaveCount(6)
  })

  test('desktop sidebar is NOT visible on mobile', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Desktop sidebar has w-16 rail — should not render at mobile viewport
    const sidebarRail = page.locator('div.w-16.shrink-0')
    await expect(sidebarRail).toHaveCount(0)
  })

  test('More button opens bottom sheet', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Tap the "More" button in the tab bar
    const moreBtn = page.locator('nav.fixed.bottom-0 button')
    await moreBtn.click()

    // More sheet should appear with secondary nav items
    // "Scorer" link inside the sheet
    await expect(page.getByRole('link', { name: /Scorer/ })).toBeVisible({ timeout: 5_000 })
    // "Absences" / "Absenzen" link
    await expect(page.getByRole('link', { name: /Absences|Absenzen/ })).toBeVisible()
    // "Events" link
    await expect(page.getByRole('link', { name: /Events/ })).toBeVisible()
  })

  test('More sheet shows profile and logout', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const moreBtn = page.locator('nav.fixed.bottom-0 button')
    await moreBtn.click()

    // Profile link: "My Profile" / "Mein Profil"
    await expect(page.getByRole('link', { name: /My Profile|Mein Profil/ })).toBeVisible({ timeout: 5_000 })
    // Logout button
    await expect(page.getByRole('button', { name: /Logout|Abmelden/ })).toBeVisible()
  })

  test('More sheet closes on backdrop tap', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const moreBtn = page.locator('nav.fixed.bottom-0 button')
    await moreBtn.click()

    // Sheet is visible
    await expect(page.getByRole('link', { name: /Scorer/ })).toBeVisible({ timeout: 5_000 })

    // Click the backdrop (fixed inset-0 overlay)
    await page.locator('.fixed.inset-0 > .absolute.inset-0').click({ position: { x: 10, y: 10 } })

    // Sheet should close
    await expect(page.getByRole('link', { name: /Scorer/ })).not.toBeVisible({ timeout: 3_000 })
  })

  test('tab navigation works — tapping tabs changes route', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Tap Calendar tab
    const calendarTab = page.locator('nav.fixed.bottom-0').getByRole('link', { name: /Calendar|Kalender/ })
    await calendarTab.click()
    await expect(page).toHaveURL('/calendar')

    // Tap Games tab
    const gamesTab = page.locator('nav.fixed.bottom-0').getByRole('link', { name: /Games|Spiele/ })
    await gamesTab.click()
    await expect(page).toHaveURL('/games')
  })
})

test.describe('Mobile UI — layout checks', () => {
  const pagesToCheck = [
    ...PUBLIC_ROUTES,
    ...AUTH_ROUTES,
  ]

  for (const route of pagesToCheck) {
    test(`${route.name} (${route.path}) — no horizontal overflow`, async ({ page }) => {
      await page.goto(route.path)
      await page.waitForLoadState('domcontentloaded')

      // Wait for content to render
      await page.waitForTimeout(500)

      // Check that body does not produce horizontal scroll
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(hasOverflow).toBe(false)
    })
  }

  test('main content has bottom padding for tab bar', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Main content area should have pb-24 to not be hidden behind the tab bar
    const main = page.locator('main')
    await expect(main).toBeVisible({ timeout: 10_000 })

    const paddingBottom = await main.evaluate((el) => {
      return parseInt(getComputedStyle(el).paddingBottom, 10)
    })
    // pb-24 = 96px (6rem at 16px base)
    expect(paddingBottom).toBeGreaterThanOrEqual(90)
  })
})

test.describe('Mobile UI — touch targets', () => {
  test('bottom tab bar items meet minimum touch target size', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const tabBar = page.locator('nav.fixed.bottom-0')
    await expect(tabBar).toBeVisible({ timeout: 10_000 })

    // Tab bar height should be at least 64px (h-16)
    const tabBarBox = await tabBar.boundingBox()
    expect(tabBarBox).not.toBeNull()
    expect(tabBarBox!.height).toBeGreaterThanOrEqual(60)

    // Each tab item should have reasonable width (viewport / 6 tabs minimum)
    const firstTab = tabBar.locator('a').first()
    const firstTabBox = await firstTab.boundingBox()
    expect(firstTabBox).not.toBeNull()
    expect(firstTabBox!.width).toBeGreaterThanOrEqual(44)
    expect(firstTabBox!.height).toBeGreaterThanOrEqual(44)
  })

  test('More sheet items meet minimum touch target size (48px)', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const moreBtn = page.locator('nav.fixed.bottom-0 button')
    await moreBtn.click()

    // Wait for sheet
    const scorerLink = page.getByRole('link', { name: /Scorer/ })
    await expect(scorerLink).toBeVisible({ timeout: 5_000 })

    // Check that sheet nav links have min-h-[48px]
    const scorerBox = await scorerLink.boundingBox()
    expect(scorerBox).not.toBeNull()
    expect(scorerBox!.height).toBeGreaterThanOrEqual(44)
  })
})

test.describe('Mobile UI — screenshots', () => {
  test('home page mobile snapshot', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    // Wait for data to settle
    await page.waitForTimeout(1000)

    await expect(page).toHaveScreenshot('home-mobile.png', {
      maxDiffPixelRatio: 0.05,
    })
  })

  test('games page mobile snapshot', async ({ page }) => {
    await page.goto('/games')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    await expect(page).toHaveScreenshot('games-mobile.png', {
      maxDiffPixelRatio: 0.05,
    })
  })

  test('more sheet mobile snapshot', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const moreBtn = page.locator('nav.fixed.bottom-0 button')
    await moreBtn.click()
    await expect(page.getByRole('link', { name: /Scorer/ })).toBeVisible({ timeout: 5_000 })

    await expect(page).toHaveScreenshot('more-sheet-mobile.png', {
      maxDiffPixelRatio: 0.05,
    })
  })
})
