import { test, expect } from '@playwright/test'
import { PUBLIC_ROUTES } from '../../fixtures/test-data'

test.describe('Readability — minimum font sizes', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} (${route.path}) — no text smaller than 9px`, async ({ page }) => {
      await page.goto(route.path)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(500)

      const tooSmall = await page.evaluate(() => {
        const results: { text: string; fontSize: string; tag: string }[] = []
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        const seen = new Set<Element>()

        while (walker.nextNode()) {
          const text = walker.currentNode.textContent?.trim()
          if (!text) continue

          const el = walker.currentNode.parentElement
          if (!el || seen.has(el)) continue
          seen.add(el)

          const style = getComputedStyle(el)
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue

          const fontSize = parseFloat(style.fontSize)
          if (fontSize < 9) {
            results.push({
              text: text.slice(0, 50),
              fontSize: style.fontSize,
              tag: el.tagName.toLowerCase(),
            })
          }
        }
        return results
      })

      if (tooSmall.length > 0) {
        console.log(`[readability] ${route.name}: ${tooSmall.length} elements below 9px:`)
        for (const item of tooSmall) {
          console.log(`  - "${item.text}" at ${item.fontSize} (${item.tag})`)
        }
      }
      // Allow a few intentional small text elements (badges, slot labels)
      expect(tooSmall.length).toBeLessThanOrEqual(5)
    })
  }
})

test.describe('Readability — heading sizes', () => {
  test('home page h1 is at least 20px', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 10_000 })

    const fontSize = await heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(fontSize).toBeGreaterThanOrEqual(20)
  })

  test('section headers (h2) are at least 16px', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    const h2s = page.locator('h2')
    const count = await h2s.count()
    if (count === 0) return

    for (let i = 0; i < count; i++) {
      if (!(await h2s.nth(i).isVisible())) continue
      const size = await h2s.nth(i).evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
      expect(size).toBeGreaterThanOrEqual(16)
    }
  })
})

test.describe('Readability — dark mode text visibility', () => {
  test('text is visible in dark mode on home page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    // Default is dark mode
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(isDark).toBe(true)

    const textIssues = await page.evaluate(() => {
      const issues: string[] = []
      const els = document.querySelectorAll('h1, h2, h3, p, span, a, td, th')

      for (const el of els) {
        const style = getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden') continue

        const text = el.textContent?.trim()
        if (!text) continue

        const match = style.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
        if (!match) continue

        const [, r, g, b] = match.map(Number)
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

        // In dark mode, text luminance below 0.15 means nearly black text on dark bg
        if (luminance < 0.15) {
          issues.push(`"${text.slice(0, 30)}" color=${style.color} (lum: ${luminance.toFixed(2)})`)
        }
      }
      return issues
    })

    if (textIssues.length > 0) {
      console.log(`[readability] Dark mode text issues:`)
      for (const issue of textIssues) console.log(`  - ${issue}`)
    }
    expect(textIssues.length).toBeLessThanOrEqual(3)
  })

  test('text is visible in light mode on home page', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('wiedisync-theme', 'light')
    })
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(isDark).toBe(false)

    const textIssues = await page.evaluate(() => {
      const issues: string[] = []
      const els = document.querySelectorAll('h1, h2, h3, p, span, a, td, th')

      for (const el of els) {
        const style = getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden') continue

        const text = el.textContent?.trim()
        if (!text) continue

        const match = style.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
        if (!match) continue

        const [, r, g, b] = match.map(Number)
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

        // In light mode, near-white text on white bg is invisible
        // Use 0.95 threshold to avoid flagging light gray decorative text
        if (luminance > 0.95) {
          issues.push(`"${text.slice(0, 30)}" color=${style.color} (lum: ${luminance.toFixed(2)})`)
        }
      }
      return issues
    })

    if (textIssues.length > 0) {
      console.log(`[readability] Light mode near-invisible text:`)
      for (const issue of textIssues) console.log(`  - ${issue}`)
    }
    // Decorative/secondary text (gray-400, footer links) may exceed threshold
    expect(textIssues.length).toBeLessThanOrEqual(10)
  })
})
