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

let sentryPromise = null
function getSentry() {
  if (!sentryPromise) {
    sentryPromise = import('./sentry.js').catch(() => null)
  }
  return sentryPromise
}

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
  const status = err.status || 500
  writeErrorLog({
    level: (err.status && err.status < 500) ? 'warn' : 'error',
    project: 'wiedisync',
    event: 'api_error',
    endpoint,
    userId: req?.accountability?.user || null,
    isAdmin: req?.accountability?.admin || false,
    method: req?.method || null,
    status,
    body: req?.body ? scrubPii(req.body) : undefined,
    params: req?.params || undefined,
    query: req?.query || undefined,
    error: err.message,
    stack: err.stack,
  })

  if (status >= 500) {
    getSentry().then(s => s?.captureException(err, {
      endpoint,
      userId: req?.accountability?.user,
      method: req?.method,
      status,
    })).catch(() => {})
  }
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
 * Record a cron last-run heartbeat into the `sync_runs` table.
 *
 * Migration 045 added the table. /status reads `last_run_at` per source so
 * staleness reflects "did the cron actually fire?" rather than "did the cron
 * write a row to games/hall_events?". The previous implementation used the
 * latter and showed orange whenever a cron was a no-op (steady-state season
 * with no schedule changes), which is the common case.
 *
 * Failures here are swallowed: the cron itself must never fail because the
 * health tracker had a hiccup. Tracking is best-effort.
 *
 * @param database - knex instance from the cron's hook context
 * @param source   - stable key (e.g. 'sv_sync', 'bp_sync', 'gcal_sync')
 * @param opts     - { status?: 'ok' | 'error', rowsChanged?: number,
 *                     durationMs?: number, errorMessage?: string | null }
 */
export async function logCronRun(database, source, opts = {}) {
  if (!database || !source) return
  const status = opts.status === 'error' ? 'error' : 'ok'
  try {
    await database('sync_runs')
      .insert({
        source,
        last_run_at: database.fn.now(),
        status,
        rows_changed: Number.isFinite(opts.rowsChanged) ? opts.rowsChanged : 0,
        duration_ms: Number.isFinite(opts.durationMs) ? opts.durationMs : 0,
        error_message: opts.errorMessage ?? null,
      })
      .onConflict('source')
      .merge()
  } catch (err) {
    // Don't crash the cron over health tracking — just record to the file log.
    writeErrorLog({
      level: 'warn',
      project: 'wiedisync',
      event: 'sync_runs_write_failed',
      source,
      error: err.message,
    })
  }
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

  getSentry().then(s => s?.captureException(err, {
    cronName,
    extra,
  })).catch(() => {})
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

  getSentry().then(s => s?.captureMessage(message, 'warning', {
    event,
    extra,
  })).catch(() => {})
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
