import { test, expect } from '@playwright/test'
import { AUTH_ROUTES, ADMIN_ROUTES } from '../../fixtures/test-data'

// Run in 'unauthenticated' project — no saved auth state
test.describe('Auth guards — unauthenticated user', () => {
  for (const route of AUTH_ROUTES) {
    test(`${route.name} (${route.path}) redirects to /login`, async ({ page }) => {
      await page.goto(route.path)
      await expect(page).toHaveURL('/login', { timeout: 5_000 })
    })
  }

  for (const route of ADMIN_ROUTES) {
    test(`Admin: ${route.name} (${route.path}) redirects away`, async ({ page }) => {
      await page.goto(route.path)
      // AdminRoute redirects non-admins to /
      await expect(page).not.toHaveURL(route.path, { timeout: 5_000 })
    })
  }
})
