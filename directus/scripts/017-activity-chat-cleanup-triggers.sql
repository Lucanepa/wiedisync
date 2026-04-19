-- 017-activity-chat-cleanup-triggers.sql
-- KSCW Broadcast Plan 02 / Task 3 — delete activity_chat conversations
-- when their underlying event is deleted. FK CASCADE on conversations
-- handles conversation_members / messages / reactions / polls / reports.
--
-- Event-only (Plan 02 scope). Games/trainings never get activity_chat
-- conversations, so no triggers on those tables.

BEGIN;

CREATE OR REPLACE FUNCTION fn_activity_chat_event_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM conversations
   WHERE type          = 'activity_chat'
     AND activity_type = 'event'
     AND activity_id   = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_chat_event_delete ON events;
CREATE TRIGGER trg_activity_chat_event_delete
  AFTER DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION fn_activity_chat_event_delete();

COMMIT;
