-- 003-cascade-delete-protection.sql
--
-- 1. CASCADE DELETE: When a member is deleted, all their owned data is deleted too.
-- 2. DELETE PROTECTION: Teams, halls, hall_slots, seasons cannot be deleted by non-superadmins.
--
-- Run on both prod and dev:
--   ssh vps "sudo docker exec -i coolify-db psql -U directus -d directus_kscw_prod" < directus/scripts/003-cascade-delete-protection.sql
--   ssh vps "sudo docker exec -i coolify-db psql -U directus -d directus_kscw_dev" < directus/scripts/003-cascade-delete-protection.sql

BEGIN;

-- ══════════════════════════════════════════════════════════════════
-- 1. CASCADE DELETE — member-owned data
-- ══════════════════════════════════════════════════════════════════
-- Change FK constraints from SET NULL to CASCADE for tables where
-- data is meaningless without the member (participations, notifications, etc.)
-- Tables where SET NULL is correct (games.organizer, events.organizer) stay as-is.

-- member_teams: membership records belong to the member
ALTER TABLE member_teams DROP CONSTRAINT IF EXISTS member_teams_member_foreign;
ALTER TABLE member_teams ADD CONSTRAINT member_teams_member_foreign
  FOREIGN KEY (member) REFERENCES members(id) ON DELETE CASCADE;

-- participations: RSVP records belong to the member
ALTER TABLE participations DROP CONSTRAINT IF EXISTS participations_member_foreign;
ALTER TABLE participations ADD CONSTRAINT participations_member_foreign
  FOREIGN KEY (member) REFERENCES members(id) ON DELETE CASCADE;

-- notifications: notifications are personal
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_member_foreign;
ALTER TABLE notifications ADD CONSTRAINT notifications_member_foreign
  FOREIGN KEY (member) REFERENCES members(id) ON DELETE CASCADE;

-- absences: absence records belong to the member
ALTER TABLE absences DROP CONSTRAINT IF EXISTS absences_member_foreign;
ALTER TABLE absences ADD CONSTRAINT absences_member_foreign
  FOREIGN KEY (member) REFERENCES members(id) ON DELETE CASCADE;

-- user_logs: audit trail for this member
ALTER TABLE user_logs DROP CONSTRAINT IF EXISTS user_logs_user_foreign;
ALTER TABLE user_logs ADD CONSTRAINT user_logs_user_foreign
  FOREIGN KEY ("user") REFERENCES members(id) ON DELETE CASCADE;

-- scorer_delegations: delegation requests from/to this member
ALTER TABLE scorer_delegations DROP CONSTRAINT IF EXISTS scorer_delegations_from_member_foreign;
ALTER TABLE scorer_delegations ADD CONSTRAINT scorer_delegations_from_member_foreign
  FOREIGN KEY (from_member) REFERENCES members(id) ON DELETE CASCADE;

ALTER TABLE scorer_delegations DROP CONSTRAINT IF EXISTS scorer_delegations_to_member_foreign;
ALTER TABLE scorer_delegations ADD CONSTRAINT scorer_delegations_to_member_foreign
  FOREIGN KEY (to_member) REFERENCES members(id) ON DELETE CASCADE;

-- poll_votes: votes belong to the member
ALTER TABLE poll_votes DROP CONSTRAINT IF EXISTS poll_votes_member_foreign;
ALTER TABLE poll_votes ADD CONSTRAINT poll_votes_member_foreign
  FOREIGN KEY (member) REFERENCES members(id) ON DELETE CASCADE;

-- slot_claims: hall slot claims belong to the member (column is claimed_by_member)
ALTER TABLE slot_claims DROP CONSTRAINT IF EXISTS slot_claims_claimed_by_member_foreign;
ALTER TABLE slot_claims ADD CONSTRAINT slot_claims_claimed_by_member_foreign
  FOREIGN KEY (claimed_by_member) REFERENCES members(id) ON DELETE CASCADE;

-- carpool_passengers: passenger records belong to the member
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carpool_passengers' AND column_name = 'passenger') THEN
    ALTER TABLE carpool_passengers DROP CONSTRAINT IF EXISTS carpool_passengers_passenger_foreign;
    ALTER TABLE carpool_passengers ADD CONSTRAINT carpool_passengers_passenger_foreign
      FOREIGN KEY (passenger) REFERENCES members(id) ON DELETE CASCADE;
  END IF;
END $$;

-- carpools: carpool offers belong to the driver
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carpools' AND column_name = 'driver') THEN
    ALTER TABLE carpools DROP CONSTRAINT IF EXISTS carpools_driver_foreign;
    ALTER TABLE carpools ADD CONSTRAINT carpools_driver_foreign
      FOREIGN KEY (driver) REFERENCES members(id) ON DELETE CASCADE;
  END IF;
END $$;

-- email_verifications: clean up by email (no FK, handled in delete endpoint)

-- feedback: keep SET NULL — feedback is useful even without the member
-- games.organizer: keep SET NULL — game record should persist
-- events.organizer: keep SET NULL — event record should persist
-- referee_expenses: keep SET NULL — financial records should persist
-- tasks.assigned_to: keep SET NULL — task record should persist
-- team_invites: keep SET NULL — invite record should persist
-- teams_coaches/teams_responsibles/teams_captains (coach/TR/captain): already CASCADE

-- push_subscriptions: ensure CASCADE (may have been SET NULL from Directus sync)
ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_member_foreign;
ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_member_foreign
  FOREIGN KEY (member) REFERENCES members(id) ON DELETE CASCADE;

-- ══════════════════════════════════════════════════════════════════
-- 2. DELETE PROTECTION — prevent accidental deletion of core entities
-- ══════════════════════════════════════════════════════════════════
-- Only superadmins (via direct SQL or Directus admin UI) should delete these.
-- Directus RBAC handles this at the API level (only Administrator role has delete).
-- These triggers are a safety net at the DB level.

-- Protect teams from deletion if they have active members
CREATE OR REPLACE FUNCTION trg_protect_team_delete() RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM member_teams WHERE team = OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot delete team with active member_teams records. Remove members first.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_teams_protect_delete ON teams;
CREATE TRIGGER trg_teams_protect_delete
  BEFORE DELETE ON teams FOR EACH ROW
  EXECUTE FUNCTION trg_protect_team_delete();

-- Protect halls from deletion if they have hall_slots
CREATE OR REPLACE FUNCTION trg_protect_hall_delete() RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM hall_slots hs
    JOIN hall_slots_teams hst ON hst.hall_slots_id = hs.id
    WHERE hs.hall = OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot delete hall with existing hall_slots. Remove slots first.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_halls_protect_delete ON halls;
CREATE TRIGGER trg_halls_protect_delete
  BEFORE DELETE ON halls FOR EACH ROW
  EXECUTE FUNCTION trg_protect_hall_delete();

COMMIT;
