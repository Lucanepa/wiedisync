-- Migration 055: Trial training overrides the regular training slot.
--
-- Behaviour: at most one active (non-cancelled) training per (team, date).
-- A trial training (`is_trial = true`) ALWAYS wins:
--   • Insert a trial on a date where the team already has a regular
--     training → the regular row is auto-cancelled with
--     `cancel_reason = 'replaced_by_trial'` and
--     `auto_cancelled_by_trial = <trial.id>`.
--   • Insert a regular training (e.g. slot-cascade rolling top-up) on a
--     date where a trial already exists → the new regular row is
--     auto-cancelled the same way.
--   • Delete the trial → all rows it had auto-cancelled are un-cancelled
--     (mirrors the closure-auto-cancel pattern from migration 028).
--
-- Why a DB trigger and not a JS hook: the slot-cascade does raw
-- knex inserts on `trainings` that bypass Directus item hooks. Putting
-- the override in the DB keeps both paths (admin UI + cascade) honest
-- without duplicating logic.
--
-- Manual edits still win: the existing
-- `trg_trainings_clear_auto_cancel_marker` trigger (extended below to
-- cover the new marker) detaches the row from auto-origin as soon as a
-- user toggles `cancelled` themselves, so a later trial deletion won't
-- silently uncancel a user-owned cancel.
--
-- Idempotent.

BEGIN;

-- ── Marker column ────────────────────────────────────────────────
ALTER TABLE trainings
  ADD COLUMN IF NOT EXISTS auto_cancelled_by_trial integer NULL;

CREATE INDEX IF NOT EXISTS idx_trainings_auto_cancelled_by_trial
  ON trainings (auto_cancelled_by_trial)
  WHERE auto_cancelled_by_trial IS NOT NULL;

COMMENT ON COLUMN trainings.auto_cancelled_by_trial IS
  'When non-null, this training was auto-cancelled because trial training id=<this> exists for the same team+date. Cleared automatically by trg_trainings_clear_auto_cancel_marker when a user manually toggles `cancelled`.';

-- ── Extend the clear-marker trigger to cover the new column ──────
-- Migration 028 created this trigger for `auto_cancelled_by_closure`.
-- We replace it so it clears EITHER marker when a user manually flips
-- `cancelled` without also touching the corresponding marker. The hook
-- always writes `cancelled` + marker together, so an unchanged marker
-- alongside a flipped `cancelled` is the signature of a manual edit.
CREATE OR REPLACE FUNCTION trg_trainings_clear_auto_cancel_marker()
RETURNS trigger AS $$
BEGIN
  IF NEW.cancelled IS DISTINCT FROM OLD.cancelled THEN
    IF NEW.auto_cancelled_by_closure IS NOT DISTINCT FROM OLD.auto_cancelled_by_closure THEN
      NEW.auto_cancelled_by_closure := NULL;
    END IF;
    IF NEW.auto_cancelled_by_trial IS NOT DISTINCT FROM OLD.auto_cancelled_by_trial THEN
      NEW.auto_cancelled_by_trial := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger binding from migration 028 is unchanged; OR REPLACE on the
-- function is enough since the trigger references it by name.

-- ── AFTER INSERT: enforce "trial wins" on insert ─────────────────
CREATE OR REPLACE FUNCTION trg_trainings_trial_override()
RETURNS trigger AS $$
DECLARE
  v_trial_id integer;
BEGIN
  -- Nothing to do for cancelled rows or rows missing the join keys.
  IF NEW.cancelled = true OR NEW.team IS NULL OR NEW.date IS NULL THEN
    RETURN NULL;
  END IF;

  IF NEW.is_trial = true THEN
    -- New row is a trial → cancel any active regular siblings.
    UPDATE trainings
    SET cancelled = true,
        cancel_reason = 'Replaced by trial training',
        auto_cancelled_by_trial = NEW.id
    WHERE team = NEW.team
      AND date = NEW.date
      AND id <> NEW.id
      AND is_trial = false
      AND cancelled = false;
  ELSE
    -- New row is regular → if a trial already covers this slot, cancel
    -- the new row. (Covers slot-cascade rolling top-up landing on a
    -- date the admin already booked as a trial.)
    SELECT id INTO v_trial_id
    FROM trainings
    WHERE team = NEW.team
      AND date = NEW.date
      AND id <> NEW.id
      AND is_trial = true
      AND cancelled = false
    LIMIT 1;

    IF v_trial_id IS NOT NULL THEN
      UPDATE trainings
      SET cancelled = true,
          cancel_reason = 'Replaced by trial training',
          auto_cancelled_by_trial = v_trial_id
      WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_trainings_trial_override ON trainings;
CREATE TRIGGER trg_trainings_trial_override
  AFTER INSERT ON trainings
  FOR EACH ROW EXECUTE FUNCTION trg_trainings_trial_override();

-- ── AFTER DELETE: reverse cancellations when the trial is removed ─
CREATE OR REPLACE FUNCTION trg_trainings_trial_reverse()
RETURNS trigger AS $$
BEGIN
  IF OLD.is_trial = true THEN
    UPDATE trainings
    SET cancelled = false,
        cancel_reason = '',
        auto_cancelled_by_trial = NULL
    WHERE auto_cancelled_by_trial = OLD.id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_trainings_trial_reverse ON trainings;
CREATE TRIGGER trg_trainings_trial_reverse
  AFTER DELETE ON trainings
  FOR EACH ROW EXECUTE FUNCTION trg_trainings_trial_reverse();

-- ── Backfill: existing trials that already coincide with a regular ─
-- One-time pass so trials that were created before this migration also
-- correctly override their same-day regular sibling.
UPDATE trainings reg
SET cancelled = true,
    cancel_reason = 'Replaced by trial training',
    auto_cancelled_by_trial = tr.id
FROM trainings tr
WHERE tr.is_trial = true
  AND tr.cancelled = false
  AND reg.team = tr.team
  AND reg.date = tr.date
  AND reg.id <> tr.id
  AND reg.is_trial = false
  AND reg.cancelled = false;

COMMIT;
