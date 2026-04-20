-- 020-coach-policy-parity.sql
-- Close gaps on KSCW Coach policy for write paths the coach UI already exposes.
--
-- Context: 019 fixed the events 403 (junction perms). The same class of bug
-- exists elsewhere — the frontend lets coaches act on their own team, but
-- the policy is missing the base collection or its junction:
--
-- 1. `teams.update`            — RosterEditor role/team_picture writes,
--                                TeamDetail.handleUpdateBanner (team_picture_pos).
-- 2. `member_teams.create/update` — TeamDetail.handleApprove / handleApproveRequest
--                                add rows; RosterEditor.handleGuestLevel updates.
--                                `delete` already exists.
-- 3. `team_requests.update`    — TeamDetail.handleApproveRequest /
--                                handleRejectRequest flip status.
-- 4. `hall_slots.create/update` + `hall_slots_teams` CRUD — SlotEditor lets a
--    coach edit their own-team slot or create empty-cell slots; junction write
--    is the same shape that 403'd on events.
-- 5. `polls.create/update/delete` — TeamDetail PollsSection with canManage.
--
-- Idempotent: uses NOT EXISTS guards so re-running is safe.

DO $$
DECLARE
  coach_id uuid;
  col text;
  act text;
BEGIN
  SELECT id INTO coach_id FROM directus_policies WHERE name = 'KSCW Coach';
  IF coach_id IS NULL THEN RAISE EXCEPTION 'KSCW Coach policy not found'; END IF;

  FOR col, act IN VALUES
    ('teams',            'update'),
    ('member_teams',     'create'),
    ('member_teams',     'update'),
    ('team_requests',    'update'),
    ('hall_slots',       'create'),
    ('hall_slots',       'update'),
    ('hall_slots_teams', 'create'),
    ('hall_slots_teams', 'update'),
    ('hall_slots_teams', 'delete'),
    ('polls',            'create'),
    ('polls',            'update'),
    ('polls',            'delete')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM directus_permissions
      WHERE policy = coach_id AND collection = col AND action = act
    ) THEN
      INSERT INTO directus_permissions (policy, collection, action, fields)
      VALUES (coach_id, col, act, '*');
    END IF;
  END LOOP;
END $$;
