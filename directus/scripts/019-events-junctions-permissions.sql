-- 019-events-junctions-permissions.sql
-- Grant missing M2M junction permissions for events on Coach + Administrator policies.
--
-- Root cause: KSCW Coach policy had `events` CRUD but only `read` on the
-- `events_teams` and `events_members` junctions. Creating an event while
-- attaching any team or invited member 403'd on the nested junction write.
-- Administrator policy had the same gap; admin_access=true on the Administrator
-- policy did not bypass in this scenario (observed empirically with the user's
-- token), so we grant the perms explicitly for belt-and-suspenders parity.
--
-- Also tops up `event_sessions` and `events_members` read for Administrator for
-- consistency with Coach/Sport Admin (who already had them).
--
-- Idempotent: uses NOT EXISTS guards so re-running is safe.

DO $$
DECLARE
  coach_id uuid;
  admin_id uuid;
  col text;
  act text;
BEGIN
  SELECT id INTO coach_id FROM directus_policies WHERE name = 'KSCW Coach';
  SELECT id INTO admin_id FROM directus_policies WHERE name = 'Administrator';

  IF coach_id IS NULL THEN RAISE EXCEPTION 'KSCW Coach policy not found'; END IF;
  IF admin_id IS NULL THEN RAISE EXCEPTION 'Administrator policy not found'; END IF;

  -- Coach: events_teams CRUD (read already exists), events_members CRUD.
  FOR col, act IN VALUES
    ('events_teams', 'create'),
    ('events_teams', 'update'),
    ('events_teams', 'delete'),
    ('events_members', 'create'),
    ('events_members', 'read'),
    ('events_members', 'update'),
    ('events_members', 'delete')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM directus_permissions
      WHERE policy = coach_id AND collection = col AND action = act
    ) THEN
      INSERT INTO directus_permissions (policy, collection, action, fields)
      VALUES (coach_id, col, act, '*');
    END IF;
  END LOOP;

  -- Administrator: parity CRUD on events junctions (admin_access=t should
  -- bypass but empirically doesn't for M2M nested writes when other
  -- non-admin policies are layered on the same role).
  FOR col, act IN VALUES
    ('events_teams', 'create'),
    ('events_teams', 'update'),
    ('events_teams', 'delete'),
    ('events_members', 'create'),
    ('events_members', 'read'),
    ('events_members', 'update'),
    ('events_members', 'delete'),
    ('event_sessions', 'create'),
    ('event_sessions', 'read'),
    ('event_sessions', 'update'),
    ('event_sessions', 'delete')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM directus_permissions
      WHERE policy = admin_id AND collection = col AND action = act
    ) THEN
      INSERT INTO directus_permissions (policy, collection, action, fields)
      VALUES (admin_id, col, act, '*');
    END IF;
  END LOOP;
END $$;
