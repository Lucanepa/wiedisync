-- Migration 056: Trial trainings transform the regular row instead of creating a sibling.
--
-- Replaces migration 055's "two rows, cancel one" model with a single-row
-- transform-in-place model. The mental model for end users:
--
--   • Booking a trial on a date the team already trains regularly →
--     the EXISTING regular row gets `is_trial = true`. No duplicate.
--     RSVPs / notes / overrides are preserved.
--   • If a trial is booked on a date the team does NOT regularly train
--     (manual one-off, no slot-cascade match) → a fresh standalone row
--     is created. Same as before.
--   • Slot-cascade rolling top-up landing on a date that already holds a
--     trial → no-op (don't insert a duplicate regular).
--   • Deleting the trial just deletes the row. There is no "reverse"
--     restore — the trial replaced the regular semantically; if you
--     want the regular back, the nightly top-up will fill it on the
--     next pass (for indefinite slots) or you create one manually.
--
-- Why AFTER INSERT (not BEFORE): BEFORE INSERT returning NULL aborts the
-- INSERT, which makes Directus's `INSERT ... RETURNING *` return zero
-- rows → admin UI throws "couldn't insert item". AFTER INSERT lets the
-- statement complete normally; we then merge + delete the just-inserted
-- row. Directus's response still carries the briefly-existing row, the
-- frontend's refetch immediately after `onSave()` finds the transformed
-- regular row, and no UI plumbing is needed.
--
-- Idempotent: triggers DROP+CREATE, backfill uses CTEs that no-op when
-- no pairs remain.

BEGIN;

-- ── Drop migration 055's triggers (replaced by single-row model) ──
DROP TRIGGER IF EXISTS trg_trainings_trial_override ON trainings;
DROP FUNCTION IF EXISTS trg_trainings_trial_override();

DROP TRIGGER IF EXISTS trg_trainings_trial_reverse ON trainings;
DROP FUNCTION IF EXISTS trg_trainings_trial_reverse();

-- The `auto_cancelled_by_trial` column stays for now (historical audit
-- of legacy rows). The clear-marker trigger from migration 055 also
-- stays — covers both markers, harmless when one is always NULL.

-- ── Backfill: collapse existing (cancelled regular + active trial) pairs ──
-- For every active trial that has a sibling regular cancelled with marker:
--   1. Move trial-row participations onto the regular row (ON CONFLICT skip
--      so members who RSVPed on both get only one row kept — preferring
--      the regular's existing participation).
--   2. Flip the regular: is_trial=true, cancelled=false, clear marker,
--      copy notes & limits from the trial if the regular had defaults.
--   3. Delete the trial row.
-- Single transaction. Safe to re-run (empty result set if nothing left).

DO $$
DECLARE
  pair RECORD;
BEGIN
  FOR pair IN
    SELECT tr.id AS trial_id, reg.id AS reg_id, tr.notes AS trial_notes,
           tr.min_participants AS trial_min, tr.max_participants AS trial_max,
           tr.excluded_guest_levels AS trial_excluded
    FROM trainings tr
    JOIN trainings reg
      ON reg.team = tr.team
     AND reg.date = tr.date
     AND reg.is_trial = false
     AND reg.cancelled = true
     AND reg.auto_cancelled_by_trial = tr.id
    WHERE tr.is_trial = true
      AND tr.cancelled = false
  LOOP
    -- 1. Move participations (trial → regular). Skip duplicates.
    INSERT INTO participations (member, activity_type, activity_id, status, note, guest_count, is_staff, auto_declined_by)
    SELECT src.member, 'training', pair.reg_id::text, src.status, src.note, src.guest_count, src.is_staff, src.auto_declined_by
    FROM participations src
    WHERE src.activity_type = 'training' AND src.activity_id = pair.trial_id::text
      AND NOT EXISTS (
        SELECT 1 FROM participations dst
        WHERE dst.activity_type = 'training' AND dst.activity_id = pair.reg_id::text
          AND dst.member = src.member
      );

    DELETE FROM participations
    WHERE activity_type = 'training' AND activity_id = pair.trial_id::text;

    -- 2. Transform the regular row in place.
    UPDATE trainings
    SET is_trial = true,
        cancelled = false,
        cancel_reason = '',
        auto_cancelled_by_trial = NULL,
        notes = CASE WHEN pair.trial_notes IS NOT NULL AND pair.trial_notes <> ''
                     THEN pair.trial_notes ELSE notes END,
        min_participants = COALESCE(pair.trial_min, min_participants),
        max_participants = COALESCE(pair.trial_max, max_participants),
        excluded_guest_levels = COALESCE(pair.trial_excluded, excluded_guest_levels)
    WHERE id = pair.reg_id;

    -- 3. Delete the trial sibling.
    DELETE FROM trainings WHERE id = pair.trial_id;
  END LOOP;
END $$;

-- ── AFTER INSERT: transform existing regular OR skip duplicate regular ──
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
          require_note_if_absent = NEW.require_note_if_absent
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

DROP TRIGGER IF EXISTS trg_trainings_trial_transform ON trainings;
CREATE TRIGGER trg_trainings_trial_transform
  AFTER INSERT ON trainings
  FOR EACH ROW EXECUTE FUNCTION trg_trainings_trial_transform();

COMMIT;
