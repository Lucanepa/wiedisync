/**
 * Audit log — Superuser-only browser for `user_logs`.
 *
 * Backs `src/modules/admin/AuditLogPage.tsx` at `/admin/audit-log`.
 *
 *   POST /kscw/admin/audit
 *     body: { collection?, action?, level?, actor?, record_id?, search?,
 *             from?, to?, page?, per_page? }
 *     →  { items, total, page, perPage, totalPages, collections }
 *
 *   GET  /kscw/admin/audit/stats
 *     →  { today_events, today_errors, archive_days }
 *
 * Source: `user_logs` (currently fed by the frontend `logActivity()` helper;
 * a server-side action hook in kscw-hooks will replace those calls).
 *
 * Auth: Superuser only — matches the SuperAdminRoute gate on the page.
 *
 * Note on `level` / `actor`: the underlying table has neither column.
 *   - `level` is derived per row (`delete` → warn, `error` → error, else info)
 *     and applied as a post-filter when requested.
 *   - `actor` matches first/last name or email (free-text contains).
 */

const MAX_PER_PAGE = 200
const DEFAULT_PER_PAGE = 50
const ARCHIVE_DAYS = 90

export function registerAudit(router, { database, logger }) {
  const log = logger.child({ endpoint: 'audit' })

  async function requireSuperuser(req, res) {
    if (!req.accountability?.user) {
      res.status(401).json({ error: 'Authentication required' })
      return false
    }
    // Gate on the stable Directus admin_access flag (resolved from the policies
    // attached to the user), not on the mutable string `directus_roles.name`.
    // Any Directus admin who renamed a role to 'Superuser' previously slipped
    // through this check.
    if (req.accountability.admin !== true) {
      log.warn({ msg: 'Audit access denied', userId: req.accountability.user })
      res.status(403).json({ error: 'Superuser access required' })
      return false
    }
    return true
  }

  function levelFor(action) {
    if (action === 'delete') return 'warn'
    if (action === 'error') return 'error'
    return 'info'
  }

  // ── POST /admin/audit ────────────────────────────────────────
  router.post('/admin/audit', async (req, res) => {
    if (!(await requireSuperuser(req, res))) return

    const body = req.body || {}
    const page = Math.max(1, parseInt(body.page) || 1)
    const perPage = Math.min(MAX_PER_PAGE, Math.max(1, parseInt(body.per_page) || DEFAULT_PER_PAGE))
    const { collection, action, level, actor, record_id, search, from, to } = body

    try {
      const tableExists = await database.schema.hasTable('user_logs')
      if (!tableExists) {
        return res.json({ items: [], total: 0, page: 1, perPage, totalPages: 0, collections: [] })
      }

      // Server-side filter on `level` maps to derived action set
      const levelToActions = {
        warn: ['delete'],
        error: ['error'],
        info: ['create', 'update', 'auth', 'system'],
      }

      const base = database('user_logs as l')
        .leftJoin('members as m', 'm.id', 'l.user')

      if (collection) base.where('l.collection_name', collection)
      if (action)     base.where('l.action', action)
      if (level && levelToActions[level]) base.whereIn('l.action', levelToActions[level])
      if (record_id)  base.where('l.record_id', String(record_id))
      if (from)       base.where('l.date_created', '>=', from)
      if (to)         base.where('l.date_created', '<=', to)

      if (actor) {
        const like = `%${actor}%`
        base.where(b => b
          .where('m.first_name', 'ilike', like)
          .orWhere('m.last_name', 'ilike', like)
          .orWhere('m.email', 'ilike', like))
      }

      if (search) {
        const like = `%${search}%`
        base.where(b => b
          .where('l.record_id', 'ilike', like)
          .orWhere('l.collection_name', 'ilike', like)
          .orWhere('l.action', 'ilike', like)
          .orWhere(database.raw('l.data::text ilike ?', [like])))
      }

      const totalRow = await base.clone().count({ c: '*' }).first()
      const total = Number(totalRow?.c ?? 0)

      const rows = await base
        .select(
          'l.id', 'l.date_created as ts', 'l.action', 'l.collection_name as collection',
          'l.record_id', 'l.data', 'l.user as actor_id',
          'm.first_name', 'm.last_name', 'm.email',
        )
        .orderBy('l.date_created', 'desc')
        .limit(perPage)
        .offset((page - 1) * perPage)

      const collections = await database('user_logs')
        .distinct('collection_name')
        .whereNotNull('collection_name')
        .orderBy('collection_name', 'asc')
        .then(r => r.map(x => x.collection_name).filter(Boolean))

      const items = rows.map(r => {
        const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim()
        const actorLabel = name || r.email || (r.actor_id != null ? `member#${r.actor_id}` : 'system')
        return {
          ts: r.ts instanceof Date ? r.ts.toISOString() : r.ts,
          level: levelFor(r.action),
          action: r.action || 'system',
          collection: r.collection || '',
          record_id: r.record_id || '',
          actor: actorLabel,
          details: r.data ?? {},
        }
      })

      res.json({
        items, total, page, perPage,
        totalPages: total === 0 ? 0 : Math.ceil(total / perPage),
        collections,
      })
    } catch (err) {
      log.error({ msg: `audit list: ${err.message}`, stack: err.stack })
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // ── GET /admin/audit/stats ───────────────────────────────────
  router.get('/admin/audit/stats', async (req, res) => {
    if (!(await requireSuperuser(req, res))) return

    try {
      const tableExists = await database.schema.hasTable('user_logs')
      if (!tableExists) {
        return res.json({ today_events: 0, today_errors: 0, archive_days: ARCHIVE_DAYS })
      }

      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
      const todayRow = await database('user_logs')
        .where('date_created', '>=', since)
        .count({ c: '*' }).first()
      const errorsRow = await database('user_logs')
        .where('date_created', '>=', since)
        .where('action', 'error')
        .count({ c: '*' }).first()

      res.json({
        today_events: Number(todayRow?.c ?? 0),
        today_errors: Number(errorsRow?.c ?? 0),
        archive_days: ARCHIVE_DAYS,
      })
    } catch (err) {
      log.error({ msg: `audit stats: ${err.message}`, stack: err.stack })
      res.status(500).json({ error: 'Internal error' })
    }
  })
}
