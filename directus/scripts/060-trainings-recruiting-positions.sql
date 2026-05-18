-- Migration 060: per-trial-training recruiting positions.
--
-- Adds `trainings.recruiting_positions jsonb` (nullable). When a training is a
-- trial (is_trial=true), this holds the MemberPosition[] the team is recruiting
-- for (e.g. ["setter","middle"]). NULL/[] = open to all positions.
--
-- Surfaced publicly via /kscw/public/team/:id (no endpoint change — the trial
-- query selects the full row) for teams with open_for_players=true.
--
-- CRITICAL: migration 056's trg_trainings_trial_transform copies a FIXED set of
-- fields onto an existing regular row when a trial is booked on a date that
-- already has a regular training. recruiting_positions MUST be added to that
-- copy or it is silently dropped on the transform-in-place path. This migration
-- fix-forwards by CREATE OR REPLACE-ing that function (do NOT edit 056). The
-- bound trigger keeps pointing at the replaced function by name. No backfill
-- block is needed: migration 056 already collapsed every legacy
-- (cancelled-regular + active-trial) pair, so there are no pairs left to carry
-- the new column for.
--
-- Idempotent.

BEGIN;

-- ── Column ───────────────────────────────────────────────────────
ALTER TABLE trainings ADD COLUMN IF NOT EXISTS recruiting_positions jsonb;

COMMENT ON COLUMN trainings.recruiting_positions IS
  'Trial trainings only: MemberPosition[] the team is recruiting for (e.g. ["setter","middle"]). NULL/[] = open to all positions. Surfaced on the public team page when open_for_players=true.';

-- Directus field metadata so the column is editable from the admin UI
-- (same pattern as migration 049's is_trial field row).
INSERT INTO directus_fields (collection, field, special, interface, sort, hidden, note)
SELECT 'trainings', 'recruiting_positions', 'cast-json', 'tags', 121, false,
  'Trial training: positions the team is recruiting for. Empty = open to all positions.'
WHERE NOT EXISTS (
  SELECT 1 FROM directus_fields WHERE collection = 'trainings' AND field = 'recruiting_positions'
);

-- ── Fix-forward: extend migration 056's transform trigger ────────
-- Full body reproduced from migration 056 with ONE addition: the live
-- AFTER-INSERT UPDATE block now also copies recruiting_positions onto the
-- transformed regular row. COALESCE(NEW.x, x): a non-null selection from the
-- trial form (including []) wins; NULL leaves the regular's value untouched.
CREATE OR REPLACE FUNCTION trg_trainings_trial_transform()
RETURNS trigger AS $$
DECLARE
  v_existing_id integer;
BEGIN
  -- Skip cancelled inserts and inserts missing the join keys.
  IF NEW.cancelled = true OR NEW.team IS NULL OR NEW.date IS NULL THEN
    RETURN NULL;
  END IF;

  IF NEW.is_trial = true THEN
    -- New is a trial. Look for an existing non-cancelled regular sibling.
    SELECT id INTO v_existing_id
    FROM trainings
    WHERE team = NEW.team
      AND date = NEW.date
      AND id <> NEW.id
      AND is_trial = false
      AND cancelled = false
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      -- Merge participations of the just-inserted trial onto the regular,
      -- then transform the regular and delete the trial.
      INSERT INTO participations (member, activity_type, activity_id, status, note, guest_count, is_staff, auto_declined_by)
      SELECT src.member, 'training', v_existing_id::text, src.status, src.note, src.guest_count, src.is_staff, src.auto_declined_by
      FROM participations src
      WHERE src.activity_type = 'training' AND src.activity_id = NEW.id::text
        AND NOT EXISTS (
          SELECT 1 FROM participations dst
          WHERE dst.activity_type = 'training' AND dst.activity_id = v_existing_id::text
            AND dst.member = src.member
        );

      DELETE FROM participations
      WHERE activity_type = 'training' AND activity_id = NEW.id::text;

      UPDATE trainings
      SET is_trial = true,
          notes = CASE WHEN NEW.notes IS NOT NULL AND NEW.notes <> ''
                       THEN NEW.notes ELSE notes END,
          min_participants = COALESCE(NEW.min_participants, min_participants),
          max_participants = COALESCE(NEW.max_participants, max_participants),
          excluded_guest_levels = COALESCE(NEW.excluded_guest_levels, excluded_guest_levels),
          require_note_if_absent = NEW.require_note_if_absent,
          recruiting_positions = COALESCE(NEW.recruiting_positions, recruiting_positions)
      WHERE id = v_existing_id;

      DELETE FROM trainings WHERE id = NEW.id;
    END IF;
    -- else: trial standalone, no existing regular — leave it alone.

  ELSE
    -- New is a regular. If a trial already covers this date (e.g.
    -- slot-cascade rolling top-up landing post-trial-booking),
    -- discard the duplicate so the trial stays the only row.
    IF EXISTS (
      SELECT 1 FROM trainings
      WHERE team = NEW.team
        AND date = NEW.date
        AND id <> NEW.id
        AND is_trial = true
        AND cancelled = false
    ) THEN
      DELETE FROM participations
      WHERE activity_type = 'training' AND activity_id = NEW.id::text;
      DELETE FROM trainings WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMIT;
