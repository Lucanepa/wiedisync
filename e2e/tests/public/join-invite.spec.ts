import { test, expect } from '@playwright/test'

test.describe('QR Invite Join Page', () => {
  test('shows error for invalid token', async ({ page }) => {
    await page.goto('/join/invalid-token-12345')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toContainText(/invalid|expired|ungültig|abgelaufen/i)
  })

  test('join page loads without crashing', async ({ page }) => {
    await page.goto('/join/test-token')
    await page.waitForLoadState('domcontentloaded')
    const body = page.locator('body')
    await expect(body).not.toContainText('Error boundary')
  })
})
