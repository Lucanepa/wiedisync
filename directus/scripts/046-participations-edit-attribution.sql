-- Migration 046 — Track who staff-edited a participation and when.
--
-- Roster RSVP rows can be edited by three different actors:
--   1. The member themselves (self-edit)
--   2. A coach / team responsible / admin (staff edit)
--   3. The system (cron auto-decline on absence cover, hall-closure unwind)
--
-- The roster modal needs to surface the second case explicitly — "Edited to
-- Confirmed by Coach Name on 10/05/2026" — so members see when their RSVP
-- has been overridden by a staff member rather than by themselves. The
-- existing `date_updated` column tracks the WHEN but doesn't tell us WHO,
-- and the system path (auto_declined_by is set) shouldn't be misattributed
-- to a human staff member.
--
-- This migration adds two columns. The kscw-hooks `participations.items
-- .{create,update}` filters set `last_edited_by = accountability?.user`
-- and `last_edited_at = NOW()` on every authenticated write. System-context
-- writes (cron, no accountability) leave both null, distinguishing them
-- cleanly from human edits. The frontend renders the attribution line only
-- when `last_edited_by` resolves to a directus_users row whose linked
-- `members.id` differs from the participation's own `member` — i.e. a
-- third party edited the row.
--
-- Idempotent.

ALTER TABLE participations
  ADD COLUMN IF NOT EXISTS last_edited_by uuid REFERENCES directus_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_edited_at timestamptz;

COMMENT ON COLUMN participations.last_edited_by IS 'directus_users.id of the writer on the most recent create/update — set by kscw-hooks filter, null for system-context writes (cron, hall-closure unwind).';
COMMENT ON COLUMN participations.last_edited_at IS 'Wall-clock of the most recent authenticated write. Null when never touched by an authenticated session.';

-- Index for the per-roster fetch — modal pulls participations by activity
-- and renders attribution alongside; no high-cardinality query on these
-- columns warrants a dedicated index, but a partial one helps the rare
-- "show me everything a coach edited" admin query without bloating the
-- common case.
CREATE INDEX IF NOT EXISTS idx_participations_last_edited_by
  ON participations (last_edited_by)
  WHERE last_edited_by IS NOT NULL;
