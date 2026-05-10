-- Migration 047 — Split participation edit attribution by field.
--
-- Migration 046 added `last_edited_by` + `last_edited_at` as a general "any
-- field changed" tracker. The roster modal needs to surface status edits
-- and note edits as INDEPENDENT events ("Edited to Confirmed by Coach on
-- 10/05" + "Note edited by Coach on 11/05"), which the general tracker
-- can't express — touching either field overwrites the same pair, losing
-- the other event.
--
-- This migration drops 046's columns and adds two field-specific pairs:
--   last_status_edited_by / last_status_edited_at — set when `status`
--     is in the update payload (or on create with a non-null status).
--   last_note_edited_by   / last_note_edited_at   — set when `note` is
--     in the update payload (or on create with a non-empty note).
--
-- The kscw-hooks `participations.items.{create,update}` filter inspects
-- which fields the client is touching and updates only the matching
-- tracker pair, so editing only the note doesn't reset the status
-- attribution and vice versa.
--
-- Idempotent. Safe to re-apply: DROP IF EXISTS + ADD IF NOT EXISTS.

ALTER TABLE participations
  DROP COLUMN IF EXISTS last_edited_by,
  DROP COLUMN IF EXISTS last_edited_at;

DROP INDEX IF EXISTS idx_participations_last_edited_by;

ALTER TABLE participations
  ADD COLUMN IF NOT EXISTS last_status_edited_by uuid REFERENCES directus_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_status_edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_note_edited_by   uuid REFERENCES directus_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_note_edited_at   timestamptz;

COMMENT ON COLUMN participations.last_status_edited_by IS 'directus_users.id of the writer who last set/changed `status` — set by kscw-hooks filter when `status` is in the create/update payload. Null for system-context writes.';
COMMENT ON COLUMN participations.last_status_edited_at IS 'Wall-clock of the last `status` write by an authenticated session.';
COMMENT ON COLUMN participations.last_note_edited_by   IS 'directus_users.id of the writer who last set/changed `note` — set by kscw-hooks filter when `note` is in the create/update payload. Null for system-context writes.';
COMMENT ON COLUMN participations.last_note_edited_at   IS 'Wall-clock of the last `note` write by an authenticated session.';

CREATE INDEX IF NOT EXISTS idx_participations_last_status_edited_by
  ON participations (last_status_edited_by) WHERE last_status_edited_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_participations_last_note_edited_by
  ON participations (last_note_edited_by)   WHERE last_note_edited_by   IS NOT NULL;
