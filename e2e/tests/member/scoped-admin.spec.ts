import { test, expect } from '@playwright/test'

const VOLLEYBALL_TEAM_SLUG = 'H1'
const BASKETBALL_TEAM_SLUG = 'DU12'

test.describe('Scoped admin access (vb_admin)', () => {
  test.use({ storageState: 'e2e/.auth/vb-admin.json' })

  test('can access volleyball admin pages', async ({ page }) => {
    await page.goto('/admin/spielplanung')
    await page.waitForLoadState('domcontentloaded')

    await expect(page).toHaveURL('/admin/spielplanung')
    await expect(page.locator('body')).not.toContainText('Error')
  })

  test('can open volleyball and basketball team detail pages without crashing', async ({ page }) => {
    await page.goto(`/teams/${VOLLEYBALL_TEAM_SLUG}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).not.toContainText('Error')

    await page.goto(`/teams/${BASKETBALL_TEAM_SLUG}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).not.toContainText('Error')
  })
})

test.describe('Scoped admin access (bb_admin)', () => {
  test.use({ storageState: 'e2e/.auth/bb-admin.json' })

  test('is blocked from volleyball-only admin routes', async ({ page }) => {
    const blockedRoutes = [
      '/admin/scorer-assign',
      '/admin/terminplanung',
      '/admin/terminplanung/dashboard',
    ]

    for (const route of blockedRoutes) {
      await page.goto(route)
      await page.waitForLoadState('domcontentloaded')
      await expect(page).not.toHaveURL(route)
      await expect(page.locator('body')).not.toContainText('Error')
    }
  })

  test('can open basketball and volleyball team detail pages without crashing', async ({ page }) => {
    await page.goto(`/teams/${BASKETBALL_TEAM_SLUG}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).not.toContainText('Error')

    await page.goto(`/teams/${VOLLEYBALL_TEAM_SLUG}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).not.toContainText('Error')
  })
})
