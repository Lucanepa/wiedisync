-- Migration 050 — Scope guest-participation block to the activity's own team.
--
-- The original trg_participations_guest_block (001-postgres-triggers.sql)
-- raised an exception on confirmed game participation whenever the member
-- had ANY member_teams row with guest_level > 0 anywhere in the club. That
-- over-blocks the common case of a senior who occasionally guest-plays for
-- a youth team but is a full-status regular on their primary team — they
-- could never confirm games for their OWN team.
--
-- This migration replaces the trigger so the guest check looks only at the
-- member_teams row for the *game's* team. Same logic, correct scope.
--
-- 2026-05-12 audit Surface 2 finding C2.
--
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP/CREATE TRIGGER.

CREATE OR REPLACE FUNCTION trg_participations_guest_block()
RETURNS trigger AS $$
DECLARE
  v_team integer;
BEGIN
  -- Block guests from confirming game participation (on insert or status
  -- change to confirmed), scoped to the team that owns the game.
  IF NEW.activity_type = 'game' AND NEW.status = 'confirmed' AND NEW.member IS NOT NULL THEN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
      -- Resolve the game's team. If the game row is missing (FK orphan)
      -- we fall back to allowing the write — the FK constraint will catch
      -- the real problem, not this trigger.
      SELECT kscw_team INTO v_team FROM games WHERE id = NEW.activity_id;
      IF v_team IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM member_teams
          WHERE member = NEW.member
            AND team = v_team
            AND guest_level > 0
          LIMIT 1
        ) THEN
          RAISE EXCEPTION 'Guests cannot directly confirm game participation';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_participations_guest_block ON participations;
CREATE TRIGGER trg_participations_guest_block
  BEFORE INSERT OR UPDATE ON participations
  FOR EACH ROW EXECUTE FUNCTION trg_participations_guest_block();
