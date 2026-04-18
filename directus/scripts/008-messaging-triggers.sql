-- =============================================================================
-- 008-messaging-triggers.sql
-- KSCW Messaging v1 — Plan 01, Task 13
-- Installed: 2026-04-17
-- Fixed:     2026-04-17 (Task 13 fix — spec §3 alignment)
--
-- Creates 4 Postgres triggers that keep conversations/conversation_members in
-- sync with the team-membership and chat-settings state.
--
-- KEY DESIGN INVARIANT (corrected from first iteration):
--   Every member in member_teams ALWAYS has a conversation_members row for
--   their team's conversation.  The `archived` flag acts as the visibility
--   toggle (archived = NOT chat_enabled).  Trigger 3 only UPDATEs existing
--   rows — it never INSERTs, so rows MUST already exist.
--
--   1. trg_messaging_teams_members_insert
--        AFTER INSERT on member_teams
--        When a member joins a team that already has a team conversation,
--        ALWAYS insert a conversation_members row (archived reflects
--        communications_team_chat_enabled preference).  Never short-circuits
--        based on the enabled flag.  If no team conversation exists yet,
--        nothing to do — the teams INSERT trigger handles that.
--
--   2. trg_messaging_teams_members_delete
--        AFTER DELETE on member_teams
--        When a member leaves a team, archive their conversation_members row
--        for that team's conversation (set archived = true).  Row is kept so
--        history is preserved; Directus can still read it.
--
--   3. trg_messaging_member_team_chat_enabled
--        AFTER UPDATE OF communications_team_chat_enabled on members
--        When a member opts in (false → true): un-archive all their
--        conversation_members rows for team conversations they belong to
--        (via member_teams).
--        When a member opts out (true → false): archive all their team
--        conversation_members rows.
--        NOTE: relies on rows ALWAYS existing (invariant above).
--
--   4. trg_messaging_teams_insert
--        AFTER INSERT on teams
--        When a new team is created, automatically create a 'team'
--        conversation with created_by resolved via fallback chain
--        (first coach → first admin/superuser → sentinel system@kscw.ch),
--        then add ALL existing team members as conversation_members
--        (archived reflects each member's chat preference).
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
--   • conversations.created_by — integer FK → members.id  (nullable)
--   • conversation_members.role defaults to 'member'
--   • conversation_members.archived defaults to false
--   • uq_conv_members_conv_member UNIQUE(conversation, member) already exists
--   • teams.season CHECK: ^\d{4}/\d{2}$
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Trigger 1: auto-join member when they are added to a team
-- FIX: always insert (archived reflects preference), never short-circuit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_messaging_teams_members_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_conv uuid;
  v_enabled boolean;
BEGIN
  -- Find the team conversation (if any)
  SELECT id INTO v_conv
    FROM conversations
   WHERE type = 'team'
     AND team = NEW.team
   LIMIT 1;

  IF v_conv IS NULL THEN
    RETURN NEW;  -- no conversation yet; teams INSERT trigger will handle it
  END IF;

  -- Look up member's chat preference; default false if NULL
  SELECT communications_team_chat_enabled INTO v_enabled
    FROM members WHERE id = NEW.member;

  -- ALWAYS insert — archived = NOT enabled (false = visible, true = hidden)
  -- Upsert: if somehow a row exists, update archived to reflect current preference
  INSERT INTO conversation_members (id, conversation, member, archived)
  VALUES (gen_random_uuid(), v_conv, NEW.member, NOT COALESCE(v_enabled, false))
  ON CONFLICT (conversation, member)
    DO UPDATE SET archived = EXCLUDED.archived;

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
-- (unchanged — behavior was correct)
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
-- (unchanged — UPDATE-only behavior is correct given the invariant that rows
--  always exist for every team member)
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
-- FIX: resolve created_by via fallback chain (coach → admin/superuser → sentinel)
--      add ALL existing members (not just chat-enabled ones), archived reflects preference
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_messaging_teams_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_conv    uuid;
  v_creator integer;
BEGIN
  v_conv := gen_random_uuid();

  -- Creator fallback 1: first coach of the team
  SELECT tc.members_id INTO v_creator
    FROM teams_coaches tc
   WHERE tc.teams_id = NEW.id
   ORDER BY tc.id
   LIMIT 1;

  -- Creator fallback 2: first admin or superuser (members.role is JSON)
  IF v_creator IS NULL THEN
    SELECT id INTO v_creator
      FROM members
     WHERE role::jsonb ?| ARRAY['admin','superuser']
     ORDER BY id
     LIMIT 1;
  END IF;

  -- Creator fallback 3: sentinel system user
  IF v_creator IS NULL THEN
    SELECT id INTO v_creator
      FROM members
     WHERE LOWER(email) = 'system@kscw.ch'
     LIMIT 1;
  END IF;

  -- Create the team conversation with resolved creator
  INSERT INTO conversations (id, type, team, created_by, created_at)
  VALUES (v_conv, 'team', NEW.id, v_creator, CURRENT_TIMESTAMP);

  -- Add ALL existing team members; archived reflects each member's chat preference
  INSERT INTO conversation_members (id, conversation, member, archived)
  SELECT gen_random_uuid(), v_conv, mt.member,
         NOT COALESCE(m.communications_team_chat_enabled, false)
    FROM member_teams mt
    JOIN members m ON m.id = mt.member
   WHERE mt.team = NEW.id
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
-- FIX: also resolve created_by via the same fallback chain as Trigger 4
INSERT INTO conversations (id, type, team, created_by, created_at)
SELECT gen_random_uuid(),
       'team',
       t.id,
       COALESCE(
         (SELECT tc.members_id FROM teams_coaches tc WHERE tc.teams_id = t.id ORDER BY tc.id LIMIT 1),
         (SELECT id FROM members WHERE role::jsonb ?| ARRAY['admin','superuser'] ORDER BY id LIMIT 1),
         (SELECT id FROM members WHERE LOWER(email) = 'system@kscw.ch' LIMIT 1)
       ),
       CURRENT_TIMESTAMP
  FROM teams t
 WHERE NOT EXISTS (
   SELECT 1 FROM conversations c
    WHERE c.type = 'team' AND c.team = t.id
 );

-- Backfill 2: add ALL existing team members to their team conversations
-- FIX: no filter on communications_team_chat_enabled — EVERY member gets a row;
--      archived = NOT enabled (false = active/visible, true = hidden from chat list)
INSERT INTO conversation_members (id, conversation, member, archived)
SELECT gen_random_uuid(),
       c.id,
       mt.member,
       NOT COALESCE(m.communications_team_chat_enabled, false)
  FROM member_teams mt
  JOIN members m ON m.id = mt.member
  JOIN conversations c ON c.team = mt.team AND c.type = 'team'
ON CONFLICT (conversation, member) DO NOTHING;

-- Corrective: fill in created_by on existing team conversations that were
-- created by the previous-iteration script without a created_by resolver.
UPDATE conversations c
   SET created_by = COALESCE(
         (SELECT tc.members_id FROM teams_coaches tc WHERE tc.teams_id = c.team ORDER BY tc.id LIMIT 1),
         (SELECT id FROM members WHERE role::jsonb ?| ARRAY['admin','superuser'] ORDER BY id LIMIT 1),
         (SELECT id FROM members WHERE LOWER(email) = 'system@kscw.ch' LIMIT 1)
       )
 WHERE c.type = 'team' AND c.created_by IS NULL;

COMMIT;
