import type { Page, Locator } from '@playwright/test'

/**
 * Page Object Model for the Login page.
 * Labels are in German (the app defaults to 'de' before login).
 */
export class LoginPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator
  readonly logo: Locator
  readonly rememberMeCheckbox: Locator

  constructor(page: Page) {
    this.page = page
    // The LoginPage uses <label> + <input> without htmlFor/id,
    // so we target inputs by placeholder text (from de/auth.ts)
    this.emailInput = page.getByPlaceholder('name@beispiel.ch')
    this.passwordInput = page.getByPlaceholder('Passwort eingeben')
    this.submitButton = page.getByRole('button', { name: 'Anmelden', exact: true })
    this.errorMessage = page.locator('p').filter({ hasText: /Ungültige|Invalid/ })
    this.logo = page.getByAltText('KSC Wiedikon')
    this.rememberMeCheckbox = page.getByRole('checkbox', { name: /Angemeldet bleiben/ })
  }

  async goto() {
    await this.page.goto('/login')
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }
}
