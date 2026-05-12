-- Migration 049: flag a training as a "trial training" (Probetraining)
--
-- Adds `trainings.is_trial BOOLEAN DEFAULT false`. When true, the training is:
--   - publicly visible on the kscw-website team page next to the
--     "Get in touch" CTA (only when the team has `open_for_players=true`)
--   - returned in `/public/team/:id` under `trial_trainings`
--
-- Created from the wiedisync admin "+ New trial training" button in
-- TeamSettings → Website (visible only when "Open for new players" is on).
--
-- Idempotent.

BEGIN;

ALTER TABLE trainings ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN trainings.is_trial IS
  'When true, the training is a public trial training (Probetraining) — surfaced on the kscw-website team page next to the "Get in touch" CTA for teams with open_for_players=true.';

CREATE INDEX IF NOT EXISTS trainings_is_trial_idx ON trainings (is_trial) WHERE is_trial = true;

-- Directus field metadata so the column is editable from the admin UI.
INSERT INTO directus_fields (collection, field, special, interface, sort, hidden, note)
SELECT 'trainings', 'is_trial', 'cast-boolean', 'boolean', 120, false,
  'Trial training (Probetraining): publicly visible on the website when the team is open for new players.'
WHERE NOT EXISTS (
  SELECT 1 FROM directus_fields WHERE collection = 'trainings' AND field = 'is_trial'
);

COMMIT;
