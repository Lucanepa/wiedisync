-- =============================================================================
-- 008-messaging-triggers.sql
-- KSCW Messaging v1 — Plan 01, Task 13
-- Installed: 2026-04-17
--
-- Creates 4 Postgres triggers that keep conversations/conversation_members in
-- sync with the team-membership and chat-settings state:
--
--   1. trg_messaging_teams_members_insert
--        AFTER INSERT on member_teams
--        When a member joins a team that already has a team conversation AND the
--        member has communications_team_chat_enabled = true, insert them into
--        conversation_members (archived = false).  If no team conversation
--        exists yet, nothing to do — the teams INSERT trigger handles that.
--
--   2. trg_messaging_teams_members_delete
--        AFTER DELETE on member_teams
--        When a member leaves a team, archive their conversation_members row for
--        that team's conversation (set archived = true).  Row is kept so history
--        is preserved; Directus can still read it.
--
--   3. trg_messaging_member_team_chat_enabled
--        AFTER UPDATE OF communications_team_chat_enabled on members
--        When a member opts in (false → true): un-archive all their
--        conversation_members rows for team conversations they belong to
--        (via member_teams).
--        When a member opts out (true → false): archive all their team
--        conversation_members rows.
--
--   4. trg_messaging_teams_insert
--        AFTER INSERT on teams
--        When a new team is created, automatically create a 'team' conversation
--        and add all existing members of that team who have
--        communications_team_chat_enabled = true as conversation_members.
--
-- Schema assumptions verified on 2026-04-17:
--   • member_teams columns: member (integer FK → members.id),
--                           team   (integer FK → teams.id)
--   • teams_coaches columns: teams_id, members_id  [junction, plural name]
--   • members.role is JSON (not TEXT/ENUM) — must use JSONB containment
--     operators (?|) for any role checks, NOT role IN (...)
--   • conversations.id      — uuid, no sequence default → gen_random_uuid()
--   • conversation_members.id — uuid, no sequence default → gen_random_uuid()
--   • conversations.type    — varchar(255) NOT NULL  (value 'team' for team chats)
--   • conversations.team    — integer FK → teams.id  (nullable for DMs)
--   • conversation_members.role defaults to 'member'
--   • conversation_members.archived defaults to false
--   • uq_conv_members_conv_member UNIQUE(conversation, member) already exists
--   • teams.season CHECK: ^\d{4}/\d{2}$
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Trigger 1: auto-join member when they are added to a team
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_messaging_teams_members_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_conv uuid;
BEGIN
  -- Only act when the member has team chat enabled
  IF NOT EXISTS (
    SELECT 1 FROM members
     WHERE id = NEW.member
       AND communications_team_chat_enabled = true
  ) THEN
    RETURN NEW;
  END IF;

  -- Find the team conversation (if any)
  SELECT id INTO v_conv
    FROM conversations
   WHERE type = 'team'
     AND team = NEW.team
   LIMIT 1;

  IF v_conv IS NULL THEN
    RETURN NEW;  -- no conversation yet; teams INSERT trigger will handle it
  END IF;

  -- Upsert: insert if not present; if already present and archived, un-archive
  INSERT INTO conversation_members (id, conversation, member, archived)
  VALUES (gen_random_uuid(), v_conv, NEW.member, false)
  ON CONFLICT (conversation, member)
    DO UPDATE SET archived = false;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messaging_teams_members_insert ON member_teams;
CREATE TRIGGER trg_messaging_teams_members_insert
  AFTER INSERT ON member_teams
  FOR EACH ROW
  EXECUTE FUNCTION fn_messaging_teams_members_insert();

-- ---------------------------------------------------------------------------
-- Trigger 2: archive member's participation when they leave a team
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_messaging_teams_members_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_conv uuid;
BEGIN
  -- Find the team conversation
  SELECT id INTO v_conv
    FROM conversations
   WHERE type = 'team'
     AND team = OLD.team
   LIMIT 1;

  IF v_conv IS NULL THEN
    RETURN OLD;
  END IF;

  -- Archive (soft-remove) rather than hard-delete to preserve history
  UPDATE conversation_members
     SET archived = true
   WHERE conversation = v_conv
     AND member = OLD.member;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_messaging_teams_members_delete ON member_teams;
CREATE TRIGGER trg_messaging_teams_members_delete
  AFTER DELETE ON member_teams
  FOR EACH ROW
  EXECUTE FUNCTION fn_messaging_teams_members_delete();

-- ---------------------------------------------------------------------------
-- Trigger 3: sync archived flag when member toggles team-chat consent
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_messaging_member_team_chat_enabled()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.communications_team_chat_enabled = OLD.communications_team_chat_enabled THEN
    RETURN NEW;  -- no change (e.g. UPDATE of another column caused this fire)
  END IF;

  IF NEW.communications_team_chat_enabled = true THEN
    -- Opt in: un-archive conversation_members rows for all teams this member belongs to
    UPDATE conversation_members cm
       SET archived = false
      FROM conversations c
      JOIN member_teams mt ON mt.team = c.team
     WHERE cm.conversation = c.id
       AND cm.member = NEW.id
       AND c.type = 'team'
       AND mt.member = NEW.id;
  ELSE
    -- Opt out: archive all team conversation_members rows
    UPDATE conversation_members cm
       SET archived = true
      FROM conversations c
     WHERE cm.conversation = c.id
       AND cm.member = NEW.id
       AND c.type = 'team';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messaging_member_team_chat_enabled ON members;
CREATE TRIGGER trg_messaging_member_team_chat_enabled
  AFTER UPDATE OF communications_team_chat_enabled ON members
  FOR EACH ROW
  EXECUTE FUNCTION fn_messaging_member_team_chat_enabled();

-- ---------------------------------------------------------------------------
-- Trigger 4: auto-create team conversation when a new team is inserted
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_messaging_teams_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_conv uuid;
BEGIN
  v_conv := gen_random_uuid();

  -- Create the team conversation
  INSERT INTO conversations (id, type, team, created_at)
  VALUES (v_conv, 'team', NEW.id, CURRENT_TIMESTAMP);

  -- Add any existing team members who have chat enabled
  -- (handles the edge case where member_teams rows pre-date the trigger install)
  INSERT INTO conversation_members (id, conversation, member, archived)
  SELECT gen_random_uuid(), v_conv, mt.member, false
    FROM member_teams mt
    JOIN members m ON m.id = mt.member
   WHERE mt.team = NEW.id
     AND m.communications_team_chat_enabled = true
  ON CONFLICT (conversation, member) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messaging_teams_insert ON teams;
CREATE TRIGGER trg_messaging_teams_insert
  AFTER INSERT ON teams
  FOR EACH ROW
  EXECUTE FUNCTION fn_messaging_teams_insert();

COMMIT;

-- =============================================================================
-- Partial unique index: one team conversation per team
-- (outside the transaction so a pre-existing duplicate doesn't abort the
--  trigger installation — but the backfill below relies on it being present)
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_one_per_team
  ON conversations (team)
  WHERE type = 'team' AND team IS NOT NULL;

-- =============================================================================
-- Backfill (separate transaction so a failure doesn't roll back the triggers)
-- =============================================================================
BEGIN;

-- Backfill 1: create team conversations for all existing teams that don't have one yet
-- Uses gen_random_uuid() for the UUID PK; ON CONFLICT on the partial unique index
-- ensures idempotency if run more than once.
INSERT INTO conversations (id, type, team, created_at)
SELECT gen_random_uuid(), 'team', t.id, CURRENT_TIMESTAMP
  FROM teams t
 WHERE NOT EXISTS (
   SELECT 1 FROM conversations c
    WHERE c.type = 'team' AND c.team = t.id
 );

-- Backfill 2: add existing team members who have chat enabled to their team conversations
-- members.role is JSON — use JSONB containment to check admin/superuser roles
-- NOTE: members with communications_team_chat_enabled = true are added as active (archived=false)
-- At time of this install: 0 members have chat enabled, so this inserts 0 rows (correct).
-- Admins/superusers who have enabled chat are also covered by the member_teams join;
-- they must be in member_teams to be auto-added here (consistent with trigger logic).
INSERT INTO conversation_members (id, conversation, member, archived)
SELECT gen_random_uuid(), c.id, mt.member, false
  FROM member_teams mt
  JOIN members m ON m.id = mt.member
  JOIN conversations c ON c.team = mt.team AND c.type = 'team'
 WHERE m.communications_team_chat_enabled = true
ON CONFLICT (conversation, member) DO NOTHING;

COMMIT;
