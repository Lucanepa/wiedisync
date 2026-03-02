import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: resolve(__dirname, '.env.test') })

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 30_000,

  use: {
    baseURL: 'http://localhost:1234',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'de-CH',
    timezoneId: 'Europe/Zurich',
  },

  projects: [
    // Auth setup — runs first, saves storageState
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Desktop chromium (authenticated) — member/ tests only
    {
      name: 'chromium',
      testDir: './e2e/tests/member',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Mobile viewport (authenticated, Chromium) — member/ tests only
    {
      name: 'mobile',
      testDir: './e2e/tests/member',
      use: {
        ...devices['Pixel 7'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Unauthenticated tests — public/ and auth/ tests only
    // Depends on setup to avoid rate-limiting from concurrent auth requests
    {
      name: 'unauthenticated',
      testMatch: /tests\/(public|auth)\/.*/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1234',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
