/**
 * Sync status — auth-required health endpoint backing /status.
 *
 * GET /kscw/admin/sync-status
 *   {
 *     runs: [
 *       { source: 'sv_sync',   last_run_at: ISO, status: 'ok' | 'error',
 *         age_seconds: number, error_message: string | null,
 *         rows_changed: number, duration_ms: number },
 *       …
 *     ]
 *   }
 *
 * Reads from `sync_runs` (migration 045). Each cron upserts a row on
 * completion via logCronRun(). Until migration 045 runs and the first cron
 * fires, the table either doesn't exist or rows still hold the seeded
 * 1970-01-01 timestamps — both surface as "stale" upstream.
 *
 * Permission model: any authenticated KSCW Member, since /status is
 * member-facing. No PII, no internal URLs, just timestamps + status.
 */

export function registerSyncStatus(router, { database, logger }) {
  const log = logger.child({ endpoint: 'sync-status' })

  router.get('/admin/sync-status', async (req, res) => {
    if (!req.accountability?.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    try {
      const tableExists = await database.schema.hasTable('sync_runs')
      if (!tableExists) {
        // Fresh DB / migration not yet applied — pretend the table is empty
        // rather than 500. /status will render every source as "loading".
        return res.json({ runs: [] })
      }

      const rows = await database('sync_runs')
        .select('source', 'last_run_at', 'status', 'rows_changed', 'duration_ms', 'error_message')
        .orderBy('source', 'asc')

      const now = Date.now()
      const runs = rows.map((r) => ({
        source: r.source,
        last_run_at: r.last_run_at instanceof Date ? r.last_run_at.toISOString() : r.last_run_at,
        status: r.status,
        rows_changed: r.rows_changed ?? 0,
        duration_ms: r.duration_ms ?? 0,
        error_message: r.error_message ?? null,
        age_seconds: r.last_run_at ? Math.floor((now - new Date(r.last_run_at).getTime()) / 1000) : null,
      }))

      return res.json({ runs })
    } catch (err) {
      log.error({ msg: `sync-status: ${err.message}`, stack: err.stack })
      res.status(500).json({ error: 'Internal error' })
    }
  })
}
