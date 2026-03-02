import { test, expect } from '@playwright/test'

// Runs in 'chromium' project which uses storageState: user.json (authenticated)
test.describe('Profile page (authenticated)', () => {
  test('loads user profile without error', async ({ page }) => {
    await page.goto('/profile')
    await page.waitForLoadState('networkidle')

    const body = page.locator('body')
    await expect(body).not.toContainText('Error')

    // ProfilePage shows the user's name and "Edit Profile" button
    // test_user has language=english, so the button says "Edit Profile"
    await expect(page.getByRole('button', { name: /Edit Profile|Profil bearbeiten/ })).toBeVisible({
      timeout: 10_000,
    })
  })
})
