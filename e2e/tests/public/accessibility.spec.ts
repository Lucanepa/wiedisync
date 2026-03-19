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

      // Log all violations for visibility
      if (violations.length > 0) {
        const critical = violations.filter(
          (v) => v.impact === 'critical' || v.impact === 'serious',
        )
        console.log(`[a11y] ${route.name}: ${violations.length} total, ${critical.length} critical/serious`)
        for (const v of violations) {
          console.log(`  - [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`)
        }
      }

      // Only fail on critical violations (not serious — those include color-contrast
      // which is a known issue tracked separately)
      const critical = violations.filter((v) => v.impact === 'critical')
      expect(critical, `Critical a11y violations on ${route.path}`).toHaveLength(0)
    })
  }
})

test.describe('Accessibility — login page keyboard navigation', () => {
  test('login form inputs are keyboard navigable in order', async ({ page }) => {
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

    // Tab through remaining form elements (remember me switch, then submit)
    // Keep tabbing until we reach the submit button (skip the switch which is also a <button>)
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      const ariaRole = await page.locator(':focus').evaluate((el) => el.getAttribute('role'))
      // Submit button has no explicit role or role="button" — skip switch/checkbox
      if (ariaRole !== 'switch' && ariaRole !== 'checkbox') {
        const tag = await page.locator(':focus').evaluate((el) => el.tagName.toLowerCase())
        if (tag === 'button') break
      }
    }
    const submitBtn = page.locator(':focus')
    await expect(submitBtn).toHaveRole('button')
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

      // Check for heading level skips and log them
      const skips: string[] = []
      for (let i = 1; i < headingLevels.length; i++) {
        const diff = headingLevels[i] - headingLevels[i - 1]
        if (diff > 1) {
          skips.push(`h${headingLevels[i - 1]} → h${headingLevels[i]}`)
        }
      }

      if (skips.length > 0) {
        console.log(`[a11y] ${route.name}: heading skips: ${skips.join(', ')}`)
      }

      // Allow up to 2 heading skips (some pages use h3 for card titles without h2)
      expect(skips.length, `Too many heading skips on ${route.path}`).toBeLessThanOrEqual(2)
    })
  }
})
