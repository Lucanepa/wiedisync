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
    sourcemap: 'hidden',  // Uploaded to Sentry but not served publicly
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 1234,
    // `npm run dev:prod` sets VITE_PROD_DATA=1 → all `/directus/*` requests
    // (REST + WS) get reverse-proxied to prod Directus. The browser only
    // ever talks to localhost:1234, so CORS never engages. Writes hit
    // PROD — `src/lib/api.ts` prints a red console banner on startup so
    // this can't be forgotten.
    ...(process.env.VITE_PROD_DATA === '1' && {
      proxy: {
        '/directus': {
          target: 'https://directus.kscw.ch',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/directus/, ''),
          ws: true,
          secure: true,
        },
      },
    }),
  },
})
