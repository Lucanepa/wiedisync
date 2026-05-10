-- Migration 045 — Track cron last-run-at independently from data writes.
--
-- The /status page derived staleness from `MAX(games.date_updated)` per
-- source — which only bumps when a game ROW is actually modified. In a
-- steady-state season (no schedule changes) the daily sync is a no-op, so
-- the user sees "41 d ago" / orange even though the cron is firing every
-- night. The detection conflates "did the sync run?" with "did the sync
-- write something?".
--
-- This table tracks the actual cron run — every wrap-aware cron upserts a
-- row on completion (success OR failure), so /status can show the true
-- last-run timestamp regardless of whether any data changed. `status` lets
-- us also flag "ran but errored" distinctly from "never ran in 36h".
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS sync_runs (
  source        text PRIMARY KEY,
  last_run_at   timestamptz NOT NULL DEFAULT NOW(),
  status        text        NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','error')),
  rows_changed  integer     NOT NULL DEFAULT 0,
  duration_ms   integer     NOT NULL DEFAULT 0,
  error_message text
);

COMMENT ON TABLE sync_runs IS 'Per-cron last-run tracker — populated by logCronRun() helper. Read by /status page.';

-- Seed the sources we currently surface on /status. Epoch timestamp so
-- "never run since deploy" shows as stale immediately rather than implying
-- the cron ran the second the table was created. Real cron firing replaces
-- the row within hours.
INSERT INTO sync_runs (source, last_run_at, status) VALUES
  ('sv_sync',   '1970-01-01T00:00:00Z', 'ok'),
  ('bp_sync',   '1970-01-01T00:00:00Z', 'ok'),
  ('svrz_sync', '1970-01-01T00:00:00Z', 'ok'),
  ('vm_sync',   '1970-01-01T00:00:00Z', 'ok'),
  ('gcal_sync', '1970-01-01T00:00:00Z', 'ok')
ON CONFLICT (source) DO NOTHING;

-- Direct DB grants. Only the supabase_admin role (used by cron via knex)
-- writes here. KSCW Members read via the /kscw/admin/sync-status custom
-- endpoint, not Directus collection permissions — keeps the collection
-- private and avoids piling more rows onto setup-permissions.mjs.
REVOKE ALL ON sync_runs FROM PUBLIC;
REVOKE ALL ON sync_runs FROM anon, authenticated;
GRANT  SELECT, INSERT, UPDATE ON sync_runs TO supabase_admin;
