let Sentry = null
let initialized = false

const PII_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const TOKEN_KEYS = new Set([
  'password', 'token', 'access_token', 'refresh_token', 'otp', 'code',
  'authorization', 'cookie', 'secret', 'turnstile_token', 'email',
])

function scrubValue(key, value) {
  if (typeof key === 'string' && TOKEN_KEYS.has(key.toLowerCase())) return '[REDACTED]'
  if (typeof value === 'string') return value.replace(PII_PATTERN, '[email-redacted]')
  return value
}

function scrubData(obj) {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(v => scrubData(v))
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (TOKEN_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]'
    } else if (v && typeof v === 'object') {
      out[k] = scrubData(v)
    } else {
      out[k] = scrubValue(k, v)
    }
  }
  return out
}

export async function initSentry() {
  if (initialized) return
  initialized = true

  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  try {
    Sentry = await import('@sentry/node')
  } catch {
    return
  }

  const publicUrl = process.env.PUBLIC_URL || ''
  const isDev = publicUrl.includes('directus-dev')
  const environment = isDev ? 'development' : 'production'

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: isDev ? 1.0 : 0.2,
    beforeSend(event) {
      if (event.request) {
        if (event.request.headers) event.request.headers = scrubData(event.request.headers)
        if (event.request.data) event.request.data = scrubData(event.request.data)
        if (event.request.query_string) {
          event.request.query_string = typeof event.request.query_string === 'string'
            ? event.request.query_string.replace(PII_PATTERN, '[email-redacted]')
            : event.request.query_string
        }
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(b => {
          if (b.message) b.message = b.message.replace(PII_PATTERN, '[email-redacted]')
          if (b.data) b.data = scrubData(b.data)
          return b
        })
      }
      return event
    },
  })
}

export function captureException(err, context = {}) {
  if (!Sentry) return

  Sentry.withScope(scope => {
    if (context.endpoint) scope.setTag('endpoint', context.endpoint)
    if (context.cronName) scope.setTag('cron', context.cronName)
    if (context.userId) scope.setUser({ id: context.userId })
    if (context.method) scope.setTag('method', context.method)
    if (context.status) scope.setTag('status', String(context.status))

    if (context.extra) {
      for (const [k, v] of Object.entries(context.extra)) {
        scope.setExtra(k, v)
      }
    }

    Sentry.captureException(err)
  })
}

export function captureMessage(msg, level = 'warning', context = {}) {
  if (!Sentry) return

  Sentry.withScope(scope => {
    if (context.endpoint) scope.setTag('endpoint', context.endpoint)
    if (context.cronName) scope.setTag('cron', context.cronName)
    if (context.userId) scope.setUser({ id: context.userId })
    if (context.event) scope.setTag('event', context.event)

    if (context.extra) {
      for (const [k, v] of Object.entries(context.extra)) {
        scope.setExtra(k, v)
      }
    }

    Sentry.captureMessage(msg, level)
  })
}

export function setSentryTag(key, value) {
  if (!Sentry) return
  Sentry.setTag(key, value)
}
