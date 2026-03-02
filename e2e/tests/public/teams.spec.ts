import { test, expect } from '@playwright/test'
import { KNOWN_TEAM_SLUGS } from '../../fixtures/test-data'

test.describe('Teams page', () => {
  test('loads team list', async ({ page }) => {
    await page.goto('/teams')
    await page.waitForLoadState('networkidle')

    // TeamsPage renders a grid of TeamCard components
    const body = page.locator('body')
    await expect(body).not.toContainText('Error')
  })

  test('team detail page loads via slug', async ({ page }) => {
    await page.goto(`/teams/${KNOWN_TEAM_SLUGS[0]}`)
    await page.waitForLoadState('networkidle')

    // TeamDetail resolves the slug and renders team info
    const body = page.locator('body')
    await expect(body).not.toContainText('Error')
    // Should show at least a heading or team name
  })
})
