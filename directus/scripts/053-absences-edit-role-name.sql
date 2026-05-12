-- Migration 053 — Stamp the editor's display name + role on absence rows.
--
-- v4.8.7 introduced third-party absence edits (coach/TR creating an absence
-- for a player). Migration 051 added `last_edited_by` (directus_users uuid)
-- and `last_edited_at` so the row carries an audit trail. But the UI only
-- said "Edited by team staff" — too generic. Members want to know which
-- role touched the row (coach vs team responsible vs admin) and the
-- person's name without doing another round-trip.
--
-- These columns are filled by the kscw-hooks `absences.items.{create,update}`
-- filter at write time. Client-supplied values are ignored (the filter
-- always overwrites). System-context writes (no accountability) leave them
-- null. Existing rows pre-dating this migration also stay null; the UI
-- falls back to the legacy "team staff" string for those.
--
-- Idempotent.

ALTER TABLE absences
  ADD COLUMN IF NOT EXISTS last_edited_name text,
  ADD COLUMN IF NOT EXISTS last_edited_role text;

COMMENT ON COLUMN absences.last_edited_name IS 'Display name of the writer on the most recent create/update — first_name + last_name from directus_users. Stamped by kscw-hooks filter, null for system-context writes and pre-053 rows.';
COMMENT ON COLUMN absences.last_edited_role IS 'Role of the writer relative to the affected member: ''coach'', ''team_responsible'', ''admin'', or ''staff''. Resolved by checking teams_coaches / teams_responsibles for any overlap with the affected member''s teams. Stamped by kscw-hooks filter.';
