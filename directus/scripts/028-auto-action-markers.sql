-- Migration 028: Auto-action markers for reversible hooks
--
-- Adds marker columns so the Directus hooks in kscw-hooks can distinguish
-- auto-generated side-effects from manual user actions and reverse them
-- cleanly when the trigger (absence / hall_closure) is shortened or deleted.
--
-- Q1: trainings.auto_cancelled_by_closure → integer pointer to hall_closures.id.
--     Plain int (no FK) so the hook can drive the reverse UPDATE itself; a
--     BEFORE UPDATE trigger auto-clears the marker when a user manually
--     toggles `cancelled` so later unwinds never touch a user-owned row.
-- Q3: participations.auto_declined_by → integer pointer to absences.id.
--     Same pattern: trigger clears the marker on any user-driven status change.

BEGIN;

-- ── Participations ────────────────────────────────────────────────
ALTER TABLE participations
  ADD COLUMN IF NOT EXISTS auto_declined_by integer NULL;

CREATE INDEX IF NOT EXISTS idx_participations_auto_declined_by
  ON participations (auto_declined_by)
  WHERE auto_declined_by IS NOT NULL;

-- Clear the marker on any user-driven status change. Our hooks only INSERT
-- or DELETE participations (never UPDATE), so any UPDATE that flips `status`
-- is a manual override and must detach from the auto-origin.
CREATE OR REPLACE FUNCTION trg_participations_clear_auto_marker()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.auto_declined_by := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_participations_clear_auto_marker ON participations;
CREATE TRIGGER trg_participations_clear_auto_marker
  BEFORE UPDATE ON participations
  FOR EACH ROW EXECUTE FUNCTION trg_participations_clear_auto_marker();

-- ── Trainings ─────────────────────────────────────────────────────
ALTER TABLE trainings
  ADD COLUMN IF NOT EXISTS auto_cancelled_by_closure integer NULL;

CREATE INDEX IF NOT EXISTS idx_trainings_auto_cancelled_by_closure
  ON trainings (auto_cancelled_by_closure)
  WHERE auto_cancelled_by_closure IS NOT NULL;

-- Clear the marker when a user manually toggles `cancelled`. Our hook updates
-- `cancelled` AND `auto_cancelled_by_closure` in the same statement, so if the
-- marker itself is unchanged while `cancelled` flipped, it's a user edit.
CREATE OR REPLACE FUNCTION trg_trainings_clear_auto_cancel_marker()
RETURNS trigger AS $$
BEGIN
  IF NEW.cancelled IS DISTINCT FROM OLD.cancelled
     AND NEW.auto_cancelled_by_closure IS NOT DISTINCT FROM OLD.auto_cancelled_by_closure THEN
    NEW.auto_cancelled_by_closure := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_trainings_clear_auto_cancel_marker ON trainings;
CREATE TRIGGER trg_trainings_clear_auto_cancel_marker
  BEFORE UPDATE ON trainings
  FOR EACH ROW EXECUTE FUNCTION trg_trainings_clear_auto_cancel_marker();

COMMIT;
