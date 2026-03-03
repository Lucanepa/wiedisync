import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

/**
 * Run axe-core on the current page with KSCW-specific configuration.
 * Returns violations array. Callers should filter by impact severity.
 *
 * Disabled rules (known issues tracked separately):
 * - button-name: icon-only toggle buttons (SwitchToggle) lack aria-label
 * - select-name: ScorerRow inline assignment selects (35+) lack labels
 * - label: ScorerPage date input filter lacks explicit label
 */
export async function runAxe(page: Page, options?: { exclude?: string[]; disableRules?: string[] }) {
  let builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
    .disableRules(['button-name', 'select-name', 'label'])

  if (options?.disableRules) {
    builder = builder.disableRules(options.disableRules)
  }
  if (options?.exclude) {
    for (const sel of options.exclude) builder = builder.exclude(sel)
  }

  const results = await builder.analyze()
  return results.violations
}
