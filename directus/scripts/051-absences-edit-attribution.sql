-- Migration 051 — Track who staff-edited an absence (mirror of 046 on participations).
--
-- v4.8.3 / migration 050 granted LEADER (Coach/TR) create/update/delete on
-- `absences` scoped to their team members. To preserve the "did someone else
-- touch this?" signal we add the same edit-attribution columns we put on
-- participations in migration 046:
--
--   • `last_edited_by` — directus_users.id of the writer on the most recent
--     create/update. Set by the kscw-hooks `absences.items.{create,update}`
--     filter, null for system-context writes.
--   • `last_edited_at` — wall-clock of that write.
--
-- The frontend renders an italic attribution line under the row when
-- `last_edited_by` resolves to a directus_users row whose linked
-- `members.id` differs from the absence's `member` — i.e. a third party
-- (coach, TR, admin) edited the row. The kscw-hooks action also fires an
-- in-app notification to the affected member naming the editor.
--
-- Idempotent.

ALTER TABLE absences
  ADD COLUMN IF NOT EXISTS last_edited_by uuid REFERENCES directus_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_edited_at timestamptz;

COMMENT ON COLUMN absences.last_edited_by IS 'directus_users.id of the writer on the most recent create/update — set by kscw-hooks filter, null for system-context writes.';
COMMENT ON COLUMN absences.last_edited_at IS 'Wall-clock of the most recent authenticated write. Null when never touched by an authenticated session.';

CREATE INDEX IF NOT EXISTS idx_absences_last_edited_by
  ON absences (last_edited_by)
  WHERE last_edited_by IS NOT NULL;
