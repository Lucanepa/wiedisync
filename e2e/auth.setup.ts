import { test as setup, expect } from '@playwright/test'

const USER_FILE = 'e2e/.auth/user.json'
const ADMIN_FILE = 'e2e/.auth/admin.json'

setup('authenticate as regular user', async ({ page }) => {
  await page.goto('/login')

  // Login page defaults to German before auth
  await page.getByPlaceholder('name@beispiel.ch').fill(process.env.TEST_USER_EMAIL!)
  await page.getByPlaceholder('Passwort eingeben').fill(process.env.TEST_USER_PASSWORD!)
  await page.getByRole('button', { name: 'Anmelden' }).click()

  // Wait for redirect to home page after successful login
  await expect(page).toHaveURL('/', { timeout: 10_000 })

  await page.context().storageState({ path: USER_FILE })
})

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login')

  await page.getByPlaceholder('name@beispiel.ch').fill(process.env.TEST_ADMIN_EMAIL!)
  await page.getByPlaceholder('Passwort eingeben').fill(process.env.TEST_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: 'Anmelden' }).click()

  await expect(page).toHaveURL('/', { timeout: 10_000 })

  await page.context().storageState({ path: ADMIN_FILE })
})
