-- KSCW Postgres Triggers & Functions
-- Replaces Node.js hooks with zero-RAM Postgres-native logic

-- 1. Slot Claims: prevent past dates + duplicate active claims
CREATE OR REPLACE FUNCTION trg_slot_claims_validate()
RETURNS trigger AS $$
BEGIN
  IF NEW.date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot claim slots in the past';
  END IF;
  IF NEW.status = 'active' AND EXISTS (
    SELECT 1 FROM slot_claims
    WHERE hall_slot = NEW.hall_slot AND date = NEW.date AND status = 'active'
      AND id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'This slot is already claimed for this date';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_slot_claims_validate ON slot_claims;
CREATE TRIGGER trg_slot_claims_validate
  BEFORE INSERT OR UPDATE ON slot_claims
  FOR EACH ROW EXECUTE FUNCTION trg_slot_claims_validate();

-- 2. Shell→full member conversion
CREATE OR REPLACE FUNCTION trg_members_shell_convert()
RETURNS trigger AS $$
BEGIN
  IF OLD.shell = true AND NEW.shell = true
     AND NEW.wiedisync_active = true AND OLD.wiedisync_active = false THEN
    NEW.shell := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_members_shell_convert ON members;
CREATE TRIGGER trg_members_shell_convert
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION trg_members_shell_convert();

-- 3. Coach approval guard
CREATE OR REPLACE FUNCTION trg_members_coach_approval_guard()
RETURNS trigger AS $$
BEGIN
  IF NEW.coach_approved_team = true AND (OLD.coach_approved_team IS DISTINCT FROM true) THEN
    IF NOT EXISTS (SELECT 1 FROM member_teams WHERE member = NEW.id) THEN
      RAISE EXCEPTION 'Cannot approve team coaching without member_teams record';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_members_coach_approval_guard ON members;
CREATE TRIGGER trg_members_coach_approval_guard
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION trg_members_coach_approval_guard();

-- 4. Guest participation block
CREATE OR REPLACE FUNCTION trg_participations_guest_block()
RETURNS trigger AS $$
BEGIN
  IF NEW.activity_type = 'game' AND NEW.status = 'confirmed' AND NEW.member IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM member_teams WHERE member = NEW.member AND guest_level > 0 LIMIT 1
    ) THEN
      RAISE EXCEPTION 'Guests cannot directly confirm game participation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_participations_guest_block ON participations;
CREATE TRIGGER trg_participations_guest_block
  BEFORE INSERT ON participations
  FOR EACH ROW EXECUTE FUNCTION trg_participations_guest_block();

-- 5. Auto-revoke slot claims when training uncancelled
CREATE OR REPLACE FUNCTION trg_trainings_revoke_claims()
RETURNS trigger AS $$
BEGIN
  IF OLD.cancelled = true AND NEW.cancelled = false AND NEW.hall_slot IS NOT NULL THEN
    UPDATE slot_claims SET status = 'revoked'
    WHERE hall_slot = NEW.hall_slot AND date = NEW.date
      AND freed_reason = 'cancelled_training' AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trainings_revoke_claims ON trainings;
CREATE TRIGGER trg_trainings_revoke_claims
  AFTER UPDATE ON trainings
  FOR EACH ROW EXECUTE FUNCTION trg_trainings_revoke_claims();

-- 6. Notifications: games CRUD (batch INSERT...SELECT)
CREATE OR REPLACE FUNCTION trg_games_notify()
RETURNS trigger AS $$
DECLARE
  v_type text; v_title text; v_body text; v_team_id int; v_game_id int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_team_id := NEW.kscw_team; v_game_id := NEW.id;
    IF v_team_id IS NULL THEN RETURN NEW; END IF;
    v_type := 'activity_change';
    v_title := COALESCE(NEW.home_team,'') || ' vs ' || COALESCE(NEW.away_team,'');
    v_body := COALESCE(NEW.date::text, '');
  ELSIF TG_OP = 'UPDATE' THEN
    v_team_id := NEW.kscw_team; v_game_id := NEW.id;
    IF v_team_id IS NULL THEN RETURN NEW; END IF;
    IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
      v_type := 'result_available';
      v_title := COALESCE(NEW.home_team,'') || ' vs ' || COALESCE(NEW.away_team,'');
      v_body := COALESCE(NEW.home_score::text,'0') || ':' || COALESCE(NEW.away_score::text,'0');
    ELSE
      v_type := 'activity_change';
      v_title := COALESCE(NEW.home_team,'') || ' vs ' || COALESCE(NEW.away_team,'');
      v_body := COALESCE(NEW.date::text, '');
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_team_id := OLD.kscw_team; v_game_id := OLD.id;
    IF v_team_id IS NULL THEN RETURN OLD; END IF;
    v_type := 'activity_change';
    v_title := COALESCE(OLD.home_team,'') || ' vs ' || COALESCE(OLD.away_team,'');
    v_body := COALESCE(OLD.date::text, '');
  END IF;

  INSERT INTO notifications (member, type, title, body, activity_type, activity_id, team, read)
  SELECT mt.member, v_type, v_title, v_body, 'game', v_game_id::text, v_team_id, false
  FROM member_teams mt WHERE mt.team = v_team_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_games_notify ON games;
CREATE TRIGGER trg_games_notify
  AFTER INSERT OR UPDATE OR DELETE ON games
  FOR EACH ROW EXECUTE FUNCTION trg_games_notify();

-- 7. Notifications: trainings CRUD
CREATE OR REPLACE FUNCTION trg_trainings_notify()
RETURNS trigger AS $$
DECLARE
  v_type text; v_title text; v_body text; v_team_id int; v_id int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_team_id := NEW.team; v_id := NEW.id;
    IF v_team_id IS NULL THEN RETURN NEW; END IF;
    v_type := 'activity_change';
    v_title := 'New training';
    v_body := COALESCE(NEW.date::text,'') || ' ' || COALESCE(NEW.start_time::text,'');
  ELSIF TG_OP = 'UPDATE' THEN
    v_team_id := NEW.team; v_id := NEW.id;
    IF v_team_id IS NULL THEN RETURN NEW; END IF;
    IF NEW.cancelled = true AND OLD.cancelled IS DISTINCT FROM true THEN
      v_type := 'activity_change'; v_title := 'Training cancelled';
    ELSE
      v_type := 'activity_change'; v_title := 'Training updated';
    END IF;
    v_body := COALESCE(NEW.date::text, '');
  ELSIF TG_OP = 'DELETE' THEN
    v_team_id := OLD.team; v_id := OLD.id;
    IF v_team_id IS NULL THEN RETURN OLD; END IF;
    v_type := 'activity_change'; v_title := 'Training deleted';
    v_body := COALESCE(OLD.date::text, '');
  END IF;

  INSERT INTO notifications (member, type, title, body, activity_type, activity_id, team, read)
  SELECT mt.member, v_type, v_title, v_body, 'training', v_id::text, v_team_id, false
  FROM member_teams mt WHERE mt.team = v_team_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trainings_notify ON trainings;
CREATE TRIGGER trg_trainings_notify
  AFTER INSERT OR UPDATE OR DELETE ON trainings
  FOR EACH ROW EXECUTE FUNCTION trg_trainings_notify();

-- 8. Notifications: events CRUD (uses M2M junction)
CREATE OR REPLACE FUNCTION trg_events_notify()
RETURNS trigger AS $$
DECLARE
  v_type text; v_title text; v_id int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_id := NEW.id; v_type := 'activity_change';
    v_title := COALESCE(NEW.title, 'New event');
  ELSIF TG_OP = 'UPDATE' THEN
    v_id := NEW.id; v_type := 'activity_change';
    v_title := COALESCE(NEW.title, 'Event updated');
  ELSIF TG_OP = 'DELETE' THEN
    v_id := OLD.id; v_type := 'activity_change';
    v_title := COALESCE(OLD.title, 'Event deleted');
  END IF;

  INSERT INTO notifications (member, type, title, body, activity_type, activity_id, team, read)
  SELECT DISTINCT mt.member, v_type, v_title, '', 'event', v_id::text, et.teams_id, false
  FROM events_teams et
  JOIN member_teams mt ON mt.team = et.teams_id
  WHERE et.events_id = v_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_notify ON events;
CREATE TRIGGER trg_events_notify
  AFTER INSERT OR UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION trg_events_notify();

-- 9. Scorer delegation: validate + auto-accept same-team
CREATE OR REPLACE FUNCTION trg_scorer_delegation_validate()
RETURNS trigger AS $$
BEGIN
  -- Auto-set same_team flag
  NEW.same_team := (NEW.from_team = NEW.to_team);
  -- Auto-accept same-team delegations
  IF NEW.same_team = true AND (TG_OP = 'INSERT') THEN
    NEW.status := 'accepted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scorer_delegation_validate ON scorer_delegations;
CREATE TRIGGER trg_scorer_delegation_validate
  BEFORE INSERT ON scorer_delegations
  FOR EACH ROW EXECUTE FUNCTION trg_scorer_delegation_validate();
