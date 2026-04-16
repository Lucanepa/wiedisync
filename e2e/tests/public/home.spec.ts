import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('login page loads and shows form', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('button', { name: /Anmelden|Sign in/ })).toBeVisible({ timeout: 10_000 })
  })
})
