-- 016-participations-activity-chat-sync.sql
-- KSCW Broadcast Plan 02 / Task 2 — keep conversation_members in sync with
-- event participations for activity_chat conversations.
--
-- Design:
--   • Event-only. Fires for all participations rows but early-exits if
--     activity_type <> 'event'. (Games/trainings never have activity_chat.)
--   • Only maintains membership when an activity_chat conversation ALREADY
--     exists. The broadcast endpoint is the sole conversation creator —
--     this trigger never INSERTs into conversations. If no conversation
--     exists for the event, the trigger is a no-op.
--   • On confirmed/tentative status: upsert conversation_members, with
--     archived = NOT communications_team_chat_enabled. Sender/member opted
--     out of team chat → archived=true (hidden from inbox) but still
--     present so they can un-archive later.
--   • On any other status, or on DELETE: archive the conversation_members
--     row (soft-remove).
--   • Banned members (communications_banned=true): their row is DELETED
--     outright (not just archived). Never surface a banned user.
--   • participations.activity_id is text; conversations.activity_id is int.
--     Cast on comparison.

BEGIN;

CREATE OR REPLACE FUNCTION fn_participations_activity_chat_sync()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_row            participations%ROWTYPE;
  v_is_insert_upd  boolean;
  v_activity_id    integer;
  v_conv           uuid;
  v_banned         boolean;
  v_team_enabled   boolean;
  v_in_audience    boolean;
BEGIN
  -- Resolve which row to inspect for NEW vs. OLD (DELETE uses OLD).
  IF TG_OP = 'DELETE' THEN
    v_row := OLD;
    v_is_insert_upd := false;
  ELSE
    v_row := NEW;
    v_is_insert_upd := true;
  END IF;

  -- Event-only early exit
  IF v_row.activity_type IS DISTINCT FROM 'event' THEN
    RETURN v_row;
  END IF;

  -- activity_id cast: text → int; silently skip if non-numeric
  BEGIN
    v_activity_id := v_row.activity_id::integer;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN v_row;
  END;

  -- Resolve conversation (must already exist; broadcast endpoint is sole creator)
  SELECT id INTO v_conv
    FROM conversations
   WHERE type = 'activity_chat'
     AND activity_type = 'event'
     AND activity_id = v_activity_id
   LIMIT 1;

  IF v_conv IS NULL THEN
    RETURN v_row;  -- no conversation → nothing to sync
  END IF;

  -- Load member flags
  SELECT communications_banned, communications_team_chat_enabled
    INTO v_banned, v_team_enabled
    FROM members
   WHERE id = v_row.member;

  IF NOT FOUND THEN
    RETURN v_row;  -- orphan member reference; shouldn't happen but be safe
  END IF;

  -- Banned: always remove
  IF v_banned = true THEN
    DELETE FROM conversation_members
     WHERE conversation = v_conv
       AND member       = v_row.member;
    RETURN v_row;
  END IF;

  -- Determine if this status+op keeps the member in the audience
  v_in_audience := v_is_insert_upd
                   AND v_row.status IN ('confirmed', 'tentative');

  IF v_in_audience THEN
    -- Upsert with archived reflecting team_chat preference
    INSERT INTO conversation_members
      (id, conversation, member, archived, role, joined_at)
    VALUES
      (gen_random_uuid(), v_conv, v_row.member,
       NOT COALESCE(v_team_enabled, false),
       'member', NOW())
    ON CONFLICT (conversation, member)
      DO UPDATE SET archived = EXCLUDED.archived;
  ELSE
    -- Not in audience (declined/waitlist/invited, or DELETE): archive (soft)
    UPDATE conversation_members
       SET archived = true
     WHERE conversation = v_conv
       AND member       = v_row.member;
  END IF;

  RETURN v_row;
END;
$$;

DROP TRIGGER IF EXISTS trg_participations_activity_chat_sync ON participations;
CREATE TRIGGER trg_participations_activity_chat_sync
  AFTER INSERT OR UPDATE OR DELETE ON participations
  FOR EACH ROW EXECUTE FUNCTION fn_participations_activity_chat_sync();

COMMIT;
