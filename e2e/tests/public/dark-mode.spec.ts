import { test, expect } from '@playwright/test'

test.describe('Dark mode', () => {
  test('defaults to dark mode in fresh browser', async ({ page }) => {
    // ThemeProvider: stored === 'light' ? 'light' : 'dark'
    // Fresh context has no localStorage → defaults to dark
    await page.goto('/')
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    )
    expect(isDark).toBe(true)
  })

  test('respects light mode from localStorage', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('wiedisync-theme', 'light')
    })
    await page.goto('/')
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    )
    expect(isDark).toBe(false)
  })
})
