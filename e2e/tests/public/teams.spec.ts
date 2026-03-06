import { test, expect } from '@playwright/test'
import { KNOWN_TEAM_SLUGS } from '../../fixtures/test-data'

test.describe('Teams page — unauthenticated', () => {
  test('redirects to /login', async ({ page }) => {
    await page.goto('/teams')
    await expect(page).toHaveURL('/login', { timeout: 5_000 })
  })

  test('team detail redirects to /login', async ({ page }) => {
    await page.goto(`/teams/${KNOWN_TEAM_SLUGS[0]}`)
    await expect(page).toHaveURL('/login', { timeout: 5_000 })
  })
})
