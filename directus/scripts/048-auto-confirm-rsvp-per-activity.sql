-- Migration 048: per-activity auto-confirm RSVP override
--
-- Adds `trainings.auto_confirm_rsvp` and `games.auto_confirm_rsvp` (nullable
-- boolean). NULL = inherit team default (`features_enabled.training_auto_confirm`
-- / `features_enabled.game_auto_confirm`). true/false = explicit per-activity
-- override.
--
-- Used by:
--   - `trainings.items.create` / `games.items.create` action hooks — compute
--     effective auto-confirm as `activity.auto_confirm_rsvp ?? team_default`
--   - `trainings.items.update` / `games.items.update` action hooks — when the
--     field flips to true, backfill confirmed participations on the activity
--   - `teams.items.update` action hook — when team toggle flips to true,
--     backfill all future activities for that team where `auto_confirm_rsvp IS NULL`
--
-- Idempotent.

BEGIN;

ALTER TABLE trainings ADD COLUMN IF NOT EXISTS auto_confirm_rsvp boolean;
ALTER TABLE games     ADD COLUMN IF NOT EXISTS auto_confirm_rsvp boolean;

COMMENT ON COLUMN trainings.auto_confirm_rsvp IS
  'NULL = inherit teams.features_enabled.training_auto_confirm. true/false = per-activity override.';
COMMENT ON COLUMN games.auto_confirm_rsvp IS
  'NULL = inherit teams.features_enabled.game_auto_confirm. true/false = per-activity override.';

-- Directus field metadata so the column is recognized by the schema + editable
-- from the admin UI.
INSERT INTO directus_fields (collection, field, special, interface, sort, hidden, note)
SELECT 'trainings', 'auto_confirm_rsvp', 'cast-boolean', 'boolean', 110, false,
  'NULL = inherit team default (features_enabled.training_auto_confirm). true/false = override.'
WHERE NOT EXISTS (
  SELECT 1 FROM directus_fields WHERE collection = 'trainings' AND field = 'auto_confirm_rsvp'
);

INSERT INTO directus_fields (collection, field, special, interface, sort, hidden, note)
SELECT 'games', 'auto_confirm_rsvp', 'cast-boolean', 'boolean', 110, false,
  'NULL = inherit team default (features_enabled.game_auto_confirm). true/false = override.'
WHERE NOT EXISTS (
  SELECT 1 FROM directus_fields WHERE collection = 'games' AND field = 'auto_confirm_rsvp'
);

COMMIT;
