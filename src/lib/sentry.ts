/**
 * Sentry error tracking — initialised once in main.tsx.
 *
 * DSN is read from VITE_SENTRY_DSN env var.
 * Source maps are uploaded at build time via @sentry/vite-plugin.
 */

import * as Sentry from '@sentry/react'

const host = typeof window !== 'undefined' ? window.location.hostname : ''
const isProd = host === 'wiedisync.kscw.ch'

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return          // skip in local dev if DSN not set

  Sentry.init({
    dsn,
    environment: isProd ? 'production' : 'preview',
    release: import.meta.env.VITE_APP_VERSION || undefined,

    // Performance — sample 20% of transactions in prod, 100% in preview
    tracesSampleRate: isProd ? 0.2 : 1.0,

    // Session replay — capture 10% normally, 100% on error
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],

    // Don't send events from local dev
    beforeSend(event) {
      if (host === 'localhost' || host === '127.0.0.1') return null
      return event
    },
  })
}

/**
 * Set the Sentry user context after login.
 * Call with null on logout.
 */
export function setSentryUser(user: { id: string; email?: string; name?: string } | null) {
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email, username: user.name })
  } else {
    Sentry.setUser(null)
  }
}

/** Re-export ErrorBoundary for use in App.tsx */
export const SentryErrorBoundary = Sentry.ErrorBoundary
