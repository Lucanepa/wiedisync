import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

/**
 * Run axe-core on the current page with KSCW-specific configuration.
 * Returns violations array. Callers should filter by impact severity.
 */
export async function runAxe(page: Page, options?: { exclude?: string[] }) {
  let builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'best-practice'])

  if (options?.exclude) {
    for (const sel of options.exclude) builder = builder.exclude(sel)
  }

  const results = await builder.analyze()
  return results.violations
}
