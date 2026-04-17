/**
 * Sentry error tracking — initialised once in main.tsx.
 *
 * DSN is read from VITE_SENTRY_DSN env var.
 * Source maps are uploaded at build time via @sentry/vite-plugin.
 *
 * Provides rich error context: who (user + role + teams), what (operation),
 * which (collection + record ID), and why (status + response body).
 */

import * as Sentry from '@sentry/react'

const host = typeof window !== 'undefined' ? window.location.hostname : ''
const isProd = host === 'wiedisync.kscw.ch'

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return          // skip in local dev if DSN not set

  Sentry.init({
    dsn,
    tunnel: 'https://sentry-tunnel.kscw.ch/tunnel',
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

    // Don't send events from local dev; scrub PII from breadcrumbs;
    // forward all errors to backend JSONL log
    beforeSend(event) {
      if (host === 'localhost' || host === '127.0.0.1') return null
      // Suppress harmless Directus SDK WebSocket auth errors (no token on /login)
      const errMsg = event.exception?.values?.[0]?.value ?? ''
      if (errMsg.includes('No token for authenticating the websocket') ||
          errMsg.includes('No token for re-authenticating the websocket')) return null
      // Suppress browser-extension DOM manipulation errors (Google Translate, Grammarly, etc.)
      if (errMsg.includes("removeChild' on 'Node'") ||
          errMsg.includes("insertBefore' on 'Node'")) return null
      // Strip email-like strings from breadcrumb messages
      if (event.breadcrumbs) {
        for (const bc of event.breadcrumbs) {
          if (typeof bc.message === 'string') {
            bc.message = bc.message.replace(/[\w.+-]+@[\w.-]+\.\w+/g, '[REDACTED]')
          }
        }
      }

      // Forward unhandled errors to backend log (API/auth errors already forwarded)
      const isUnhandled = event.exception?.values?.[0]?.mechanism?.handled === false
      if (isUnhandled) {
        const ex = event.exception?.values?.[0]
        sendToErrorLog({
          source: 'frontend',
          project: 'wiedisync',
          event: 'unhandled_error',
          error: ex?.value || 'Unknown error',
          type: ex?.type || 'Error',
          page: event.request?.url || (typeof window !== 'undefined' ? window.location.pathname : null),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          stack: ex?.stacktrace?.frames?.slice(-5).map(f => `${f.filename}:${f.lineno}:${f.colno} ${f.function || ''}`).join(' <- '),
        })
      }

      return event
    },
  })
}

// ── User context ─────────────────────────────────────────────────

interface SentryUserContext {
  id: string
  roles?: string[]
  memberTeamIds?: string[]
  coachTeamIds?: string[]
  primarySport?: string
  isAdmin?: boolean
}

/**
 * Set the Sentry user context after login.
 * Includes role, teams, and sport so every error carries WHO context.
 * Call with null on logout.
 */
export function setSentryUser(user: SentryUserContext | null) {
  if (user) {
    // Only send user ID to Sentry — no PII (email/name)
    Sentry.setUser({ id: user.id })
    Sentry.setTag('user.role', user.roles?.join(',') || 'member')
    Sentry.setTag('user.sport', user.primarySport || 'unknown')
    Sentry.setTag('user.is_admin', String(!!user.isAdmin))
    Sentry.setContext('user_teams', {
      member_of: user.memberTeamIds ?? [],
      coach_of: user.coachTeamIds ?? [],
    })
  } else {
    Sentry.setUser(null)
    Sentry.setTag('user.role', undefined)
    Sentry.setTag('user.sport', undefined)
    Sentry.setTag('user.is_admin', undefined)
    Sentry.setContext('user_teams', null)
  }
}

// ── API error capture ────────────────────────────────────────────

/** Structured API error with full context for Sentry + console. */
export class ApiError extends Error {
  status: number
  responseBody: string
  collection: string
  operation: string
  recordId?: string | number

  constructor(opts: {
    message: string
    status: number
    responseBody: string
    collection: string
    operation: string
    recordId?: string | number
  }) {
    super(opts.message)
    this.name = 'ApiError'
    this.status = opts.status
    this.responseBody = opts.responseBody
    this.collection = opts.collection
    this.operation = opts.operation
    this.recordId = opts.recordId
  }
}

/**
 * Capture an API error with full operation context to Sentry + console.
 * Called automatically from api.ts data helpers — no manual wiring needed.
 */
export function captureApiError(
  error: unknown,
  context: {
    operation: string       // e.g. 'fetchItems', 'createRecord', 'kscwApi'
    collection?: string     // e.g. 'games', 'participations'
    recordId?: string | number
    endpoint?: string       // for kscwApi calls
    method?: string         // HTTP method
    status?: number
    responseBody?: string
    payload?: Record<string, unknown>  // request body (PII-scrubbed)
  },
) {
  const err = toError(error)

  // Scrub PII from payload before sending
  const safePayload = context.payload ? scrubPii(context.payload) : undefined

  Sentry.withScope((scope) => {
    scope.setTag('error.operation', context.operation)
    if (context.collection) scope.setTag('error.collection', context.collection)
    if (context.status) scope.setTag('error.status', String(context.status))
    if (context.method) scope.setTag('error.method', context.method)
    scope.setContext('api_error', {
      operation: context.operation,
      collection: context.collection ?? null,
      recordId: context.recordId ?? null,
      endpoint: context.endpoint ?? null,
      method: context.method ?? null,
      status: context.status ?? null,
      responseBody: context.responseBody ? scrubResponseBody(context.responseBody).slice(0, 2000) : null,
      payload: safePayload ?? null,
      page: window.location.pathname,
    })
    scope.setFingerprint([
      context.operation,
      context.collection ?? 'unknown',
      String(context.status ?? 'unknown'),
    ])
    scope.setLevel(context.status && context.status < 500 ? 'warning' : 'error')
    Sentry.captureException(err)
  })

  // Also log to console for dev tools debugging
  console.error(
    `[API Error] ${context.operation}${context.collection ? ` on ${context.collection}` : ''}${context.recordId ? `#${context.recordId}` : ''}`,
    {
      status: context.status,
      endpoint: context.endpoint,
      method: context.method,
      page: window.location.pathname,
      response: context.responseBody?.slice(0, 500),
      payload: safePayload,
      error: err.message,
    },
  )

  // Forward to backend JSONL log
  sendToErrorLog({
    source: 'frontend',
    project: 'wiedisync',
    event: 'api_error',
    operation: context.operation,
    collection: context.collection,
    recordId: context.recordId,
    endpoint: context.endpoint,
    method: context.method,
    status: context.status,
    responseBody: context.responseBody?.slice(0, 1000),
    payload: safePayload,
    page: window.location.pathname,
    userAgent: navigator.userAgent,
    error: err.message,
    stack: err.stack?.slice(0, 2000),
  })
}

/**
 * Log an auth-related event (login failure, token refresh failure, OAuth error).
 */
export function captureAuthError(
  error: unknown,
  context: {
    action: string          // e.g. 'login', 'token_refresh', 'oauth_callback'
    method?: string         // 'password', 'oauth', 'otp'
  },
) {
  const err = toError(error)
  Sentry.withScope((scope) => {
    scope.setTag('auth.action', context.action)
    if (context.method) scope.setTag('auth.method', context.method)
    scope.setContext('auth_error', {
      action: context.action,
      method: context.method ?? null,
      page: window.location.pathname,
    })
    scope.setLevel('warning')
    Sentry.captureException(err)
  })
  console.error(`[Auth Error] ${context.action}`, { method: context.method, error: err.message })

  // Forward to backend JSONL log
  sendToErrorLog({
    source: 'frontend',
    project: 'wiedisync',
    event: 'auth_error',
    action: context.action,
    method: context.method,
    page: window.location.pathname,
    userAgent: navigator.userAgent,
    error: err.message,
    stack: err.stack?.slice(0, 2000),
  })
}

/**
 * Add a navigation breadcrumb for debugging context.
 * Called from route changes so Sentry knows what page the user was on.
 */
export function addBreadcrumb(message: string, data?: Record<string, unknown>) {
  Sentry.addBreadcrumb({
    category: 'app',
    message,
    data,
    level: 'info',
  })
}

// ── Error normalization ──────────────────────────────────────────

/**
 * Convert any thrown value into a proper Error with a readable message.
 * Directus SDK throws plain objects like { errors: [{ message: '...' }] }
 * which stringify as "[object Object]" in Sentry.
 */
function toError(error: unknown): Error {
  if (error instanceof Error) return error
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>
    // Directus SDK: { errors: [{ message: '...' }] }
    if (Array.isArray(obj.errors) && obj.errors[0]?.message) {
      return new Error(String(obj.errors[0].message))
    }
    // Generic: { message: '...' }
    if (typeof obj.message === 'string') {
      return new Error(obj.message)
    }
    // Last resort: JSON.stringify
    try { return new Error(JSON.stringify(error).slice(0, 500)) } catch { /* fall through */ }
  }
  return new Error(String(error))
}

// ── PII scrubbing ────────────────────────────────────────────────

const PII_FIELDS = new Set([
  'email', 'password', 'phone', 'birthdate', 'first_name', 'last_name',
  'address', 'iban', 'token', 'access_token', 'refresh_token', 'otp',
])

function scrubPii(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(obj)) {
    if (PII_FIELDS.has(key)) {
      result[key] = '[REDACTED]'
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = scrubPii(val as Record<string, unknown>)
    } else {
      result[key] = val
    }
  }
  return result
}

/**
 * Scrub PII from response body strings before sending to Sentry.
 * Handles both JSON and plain-text responses safely.
 */
function scrubResponseBody(body: string): string {
  try {
    const parsed = JSON.parse(body)
    if (parsed && typeof parsed === 'object') {
      return JSON.stringify(scrubPii(parsed as Record<string, unknown>))
    }
  } catch { /* not JSON — fall through to regex scrub */ }
  // Plain-text fallback: redact email-like strings
  return body.replace(/[\w.+-]+@[\w.-]+\.\w+/g, '[REDACTED]')
}

// ── Forward client errors to backend JSONL log ──────────────────

const API_BASE = (typeof window !== 'undefined' && window.location.hostname === 'wiedisync.kscw.ch')
  ? 'https://directus.kscw.ch'
  : (import.meta.env.VITE_DIRECTUS_URL || 'https://directus-dev.kscw.ch')

/**
 * Fire-and-forget: send a client error to the backend JSONL log.
 * Never throws — logging should not break the app.
 */
function sendToErrorLog(entry: Record<string, unknown>) {
  try {
    // Skip in local dev
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) return

    // Skip empty entries — backend would log them as null-field noise
    if (!entry.error && !entry.stack && !entry.type && !entry.responseBody) return

    const token = (() => {
      try {
        const raw = localStorage.getItem('directus_auth') || sessionStorage.getItem('directus_auth')
        return raw ? JSON.parse(raw)?.access_token : null
      } catch { return null }
    })()

    fetch(`${API_BASE}/kscw/client-error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(entry),
      keepalive: true, // survives page unload
    }).catch(() => {}) // truly fire-and-forget
  } catch { /* never block */ }
}

/** Re-export ErrorBoundary for use in App.tsx */
export const SentryErrorBoundary = Sentry.ErrorBoundary
