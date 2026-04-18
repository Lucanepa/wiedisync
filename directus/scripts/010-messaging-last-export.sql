-- =============================================================================
-- 010-messaging-last-export.sql
-- KSCW Messaging v1 — Plan 05
--
-- Adds members.last_export_at (nullable timestamptz) for the 1/day rate limit
-- on POST /kscw/messaging/export. Idempotent — safe to re-run.
-- =============================================================================

BEGIN;

ALTER TABLE members ADD COLUMN IF NOT EXISTS last_export_at timestamptz;

COMMIT;
