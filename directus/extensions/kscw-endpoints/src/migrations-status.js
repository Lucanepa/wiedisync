/**
 * Migrations status — admin-only health endpoint.
 *
 * GET /kscw/admin/migrations-status
 *   {
 *     applied: <count of rows in kscw_migrations>,
 *     pending: ['044-name.sql', …],   // files on disk not yet recorded
 *     latest: '043-security-hardening.sql',
 *     latest_applied_at: '2026-05-06T…Z',
 *   }
 *
 * Backs the Migration tracker card on /admin/infra so dev/prod sync
 * status is visible at a glance.
 */

import { readdir } from 'node:fs/promises'

const SCRIPTS_DIR = '/directus/scripts'

export function registerMigrationsStatus(router, { database, logger }) {
  const log = logger.child({ endpoint: 'migrations-status' })

  router.get('/admin/migrations-status', async (req, res) => {
    if (!req.accountability?.admin) {
      return res.status(403).json({ error: 'Admin only' })
    }
    try {
      // Tracker may not exist on dev/prod yet (bootstrap runs on first
      // db:migrate). Return zero-state in that case rather than 500.
      const trackerExists = await database.schema.hasTable('kscw_migrations')
      if (!trackerExists) {
        return res.json({ applied: 0, pending: [], latest: null, latest_applied_at: null, tracker_initialised: false })
      }

      const rows = await database('kscw_migrations')
        .select('filename', 'applied_at')
        .orderBy('filename', 'desc')
      const appliedSet = new Set(rows.map(r => r.filename))
      const latest = rows[0]

      let onDisk = []
      try {
        onDisk = (await readdir(SCRIPTS_DIR))
          .filter(f => /^\d{3}-.+\.(sql|mjs)$/.test(f))
          .sort()
      } catch { /* scripts dir missing — leave onDisk empty */ }

      const pending = onDisk.filter(name => !appliedSet.has(name))

      return res.json({
        applied: rows.length,
        pending,
        latest: latest?.filename || null,
        latest_applied_at: latest?.applied_at || null,
        tracker_initialised: true,
      })
    } catch (err) {
      log.error({ msg: `migrations-status: ${err.message}`, stack: err.stack })
      res.status(500).json({ error: 'Internal error' })
    }
  })
}
