/**
 * Persistent JSONL error log — writes ALL errors to /directus/logs/errors.jsonl
 *
 * Every error, auth denial, CAPTCHA failure, cron failure, and push failure
 * gets appended as a single JSON line. Daily rotation keeps files manageable.
 *
 * Format per line:
 * {"ts":"2026-03-31T12:00:00.000Z","level":"error","event":"api_error","endpoint":"/check-email","userId":"abc","method":"POST","status":500,"body":{...},"error":"...","stack":"..."}
 *
 * Used by both kscw-endpoints and kscw-hooks extensions.
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const LOG_DIR = process.env.ERROR_LOG_DIR || '/directus/logs'
const MAX_AGE_DAYS = 30

// Ensure log directory exists
try { fs.mkdirSync(LOG_DIR, { recursive: true }) } catch { /* ignore */ }

function getLogPath() {
  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  return path.join(LOG_DIR, `errors-${date}.jsonl`)
}

/**
 * Append a structured error entry to the JSONL log file.
 * Non-blocking — errors in logging itself are silently ignored.
 */
export function writeErrorLog(entry) {
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      ...entry,
    }) + '\n'
    fs.appendFile(getLogPath(), line, () => {})
  } catch { /* never block the request for logging */ }
}

/**
 * Log an endpoint error with full request context.
 * Drop-in companion to logEndpointError() — writes to file in addition to Directus logger.
 */
export function logErrorToFile(endpoint, err, req) {
  writeErrorLog({
    level: (err.status && err.status < 500) ? 'warn' : 'error',
    project: 'wiedisync',
    event: 'api_error',
    endpoint,
    userId: req?.accountability?.user || null,
    isAdmin: req?.accountability?.admin || false,
    method: req?.method || null,
    status: err.status || 500,
    body: req?.body ? scrubPii(req.body) : undefined,
    params: req?.params || undefined,
    query: req?.query || undefined,
    error: err.message,
    stack: err.stack,
  })
}

/**
 * Log an auth denial (401/403).
 */
export function logAuthDenial(endpoint, req, reason) {
  writeErrorLog({
    level: 'warn',
    project: 'wiedisync',
    event: 'auth_denied',
    endpoint,
    reason,
    userId: req?.accountability?.user || null,
    method: req?.method || null,
    ip: req?.ip || req?.headers?.['x-forwarded-for'] || null,
  })
}

/**
 * Log a cron/background job error.
 */
export function logCronError(cronName, err, extra) {
  writeErrorLog({
    level: 'error',
    project: 'wiedisync',
    event: 'cron_error',
    cron: cronName,
    error: err.message,
    stack: err.stack,
    ...extra,
  })
}

/**
 * Log a generic warning (CAPTCHA failures, push failures, etc).
 */
export function logWarning(event, message, extra) {
  writeErrorLog({
    level: 'warn',
    project: 'wiedisync',
    event,
    message,
    ...extra,
  })
}

/**
 * Compute a stable hash for a log entry.
 * Uses ts|event|error — unique per entry since ts is millisecond-precision.
 */
export function computeErrorHash(entry) {
  const key = `${entry.ts || ''}|${entry.event || ''}|${entry.error || ''}`
  return crypto.createHash('md5').update(key).digest('hex')
}

/**
 * Clean up log files older than MAX_AGE_DAYS.
 * Call once daily from a cron.
 */
export function cleanOldLogs() {
  try {
    const files = fs.readdirSync(LOG_DIR)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    for (const file of files) {
      if (!file.startsWith('errors-') || !file.endsWith('.jsonl')) continue
      const dateStr = file.replace('errors-', '').replace('.jsonl', '')
      if (dateStr < cutoffStr) {
        fs.unlinkSync(path.join(LOG_DIR, file))
      }
    }
  } catch { /* ignore */ }
}

// ── PII scrubbing ──────────────────────────────────────────────

const PII_KEYS = new Set([
  'email', 'password', 'phone', 'birthdate', 'first_name', 'last_name',
  'token', 'otp', 'code', 'turnstile_token', 'access_token', 'refresh_token',
])

function scrubPii(obj) {
  if (!obj || typeof obj !== 'object') return obj
  const safe = {}
  for (const [k, v] of Object.entries(obj)) {
    if (PII_KEYS.has(k)) {
      safe[k] = '[REDACTED]'
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      safe[k] = scrubPii(v)
    } else {
      safe[k] = v
    }
  }
  return safe
}
