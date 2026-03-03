import { test, expect } from '@playwright/test'
import { runAxe } from '../../fixtures/axe-helper'
import { PUBLIC_ROUTES } from '../../fixtures/test-data'

test.describe('Accessibility — public pages (axe-core)', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} (${route.path}) — no critical WCAG violations`, async ({ page }) => {
      await page.goto(route.path)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(500)

      const violations = await runAxe(page)
      const critical = violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      )

      if (violations.length > 0) {
        console.log(`[a11y] ${route.name}: ${violations.length} total, ${critical.length} critical/serious`)
        for (const v of violations) {
          console.log(`  - [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`)
        }
      }

      expect(critical, `Critical a11y violations on ${route.path}`).toHaveLength(0)
    })
  }
})

test.describe('Accessibility — login page keyboard navigation', () => {
  test('login form inputs are keyboard navigable', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    // Focus the email input
    const emailInput = page.getByPlaceholder('name@beispiel.ch')
    await expect(emailInput).toBeVisible({ timeout: 10_000 })
    await emailInput.focus()

    // Tab to password field
    await page.keyboard.press('Tab')
    const focused1 = page.locator(':focus')
    await expect(focused1).toHaveAttribute('type', 'password')

    // Tab to submit button
    await page.keyboard.press('Tab')
    const focused2 = page.locator(':focus')
    await expect(focused2).toHaveRole('button')
  })
})

test.describe('Accessibility — heading hierarchy', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} (${route.path}) — heading levels do not skip`, async ({ page }) => {
      await page.goto(route.path)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(500)

      const headingLevels = await page.evaluate(() => {
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
        return Array.from(headings)
          .filter((h) => {
            const style = getComputedStyle(h)
            return style.display !== 'none' && style.visibility !== 'hidden'
          })
          .map((h) => parseInt(h.tagName[1]))
      })

      if (headingLevels.length === 0) return

      // No level skips (e.g. h1 → h3 without h2)
      for (let i = 1; i < headingLevels.length; i++) {
        const diff = headingLevels[i] - headingLevels[i - 1]
        expect(
          diff,
          `Heading skip on ${route.path}: h${headingLevels[i - 1]} → h${headingLevels[i]}`,
        ).toBeLessThanOrEqual(1)
      }
    })
  }
})
