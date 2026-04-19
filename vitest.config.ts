import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'directus/extensions/**/__tests__/**/*.test.js',
    ],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
})
