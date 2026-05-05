-- Migration 040: per-training exclusion of guests by level
--
-- Adds `trainings.excluded_guest_levels` jsonb (default `[]`). Values are
-- a subset of [1,2,3]; e.g. [1,2,3] excludes all guests, [1] excludes only
-- the strictest tier, [] (default) lets every guest sign up.
--
-- The frontend hides Yes/Maybe for excluded users and a hook filter on
-- `participations.items.create` (kscw-hooks) double-checks server-side.
-- Games are handled separately by hardcoded UI + filter (guests never
-- allowed). Events have no exclusion mechanism — they remain open.

BEGIN;

ALTER TABLE trainings
  ADD COLUMN IF NOT EXISTS excluded_guest_levels jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Directus field metadata so the column is recognized by the schema and
-- editable from the admin UI (raw JSON for now; the React form provides a
-- proper checkbox UI).
INSERT INTO directus_fields (collection, field, special, interface, options, sort, hidden, note)
SELECT
  'trainings',
  'excluded_guest_levels',
  'cast-json',
  'input-code',
  '{"language":"json"}',
  100,
  false,
  'JSON array of guest_level values blocked from confirming/tentative on this training. Default [] = open to everyone. [1,2,3] = no guests at all.'
WHERE NOT EXISTS (
  SELECT 1 FROM directus_fields WHERE collection = 'trainings' AND field = 'excluded_guest_levels'
);

COMMIT;
