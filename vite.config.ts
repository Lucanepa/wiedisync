import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Sentry must be last — uploads source maps on production build
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Only upload on CI builds (SENTRY_AUTH_TOKEN set)
      disable: !process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  build: {
    sourcemap: true,  // Required for Sentry source maps
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 1234,
  },
})
