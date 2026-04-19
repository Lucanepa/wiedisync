-- 015-conversations-activity-chat.sql
-- KSCW Broadcast Plan 02 — activity_chat conversation type (event-only).
-- Adds activity_type + activity_id columns to conversations, plus shape CHECK,
-- event-only value CHECK, and a partial unique index so only one
-- activity_chat exists per event.
--
-- Idempotent: re-runnable with no side effects on dev + prod.

BEGIN;

-- 1. Add columns (nullable)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS activity_type varchar(16),
  ADD COLUMN IF NOT EXISTS activity_id   integer;

-- 2. Shape CHECK — exactly one of (team, DM pair, activity_chat) must be set.
--    Existing 'team' rows have team IS NOT NULL; DMs/dm_requests have team IS NULL;
--    new 'activity_chat' rows will have activity_type + activity_id set.
ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_shape_check;
ALTER TABLE conversations
  ADD CONSTRAINT conversations_shape_check CHECK (
    (type = 'team' AND team IS NOT NULL AND activity_type IS NULL AND activity_id IS NULL) OR
    (type IN ('dm','dm_request') AND team IS NULL AND activity_type IS NULL AND activity_id IS NULL) OR
    (type = 'activity_chat' AND team IS NULL AND activity_type IS NOT NULL AND activity_id IS NOT NULL)
  );

-- 3. Event-only: activity_type must be 'event' when set.
--    (Games/trainings are out of scope for Plan 02.)
ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_activity_type_check;
ALTER TABLE conversations
  ADD CONSTRAINT conversations_activity_type_check CHECK (
    activity_type IS NULL OR activity_type = 'event'
  );

-- 4. One activity_chat per event.
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_one_per_activity
  ON conversations (activity_type, activity_id)
  WHERE type = 'activity_chat';

COMMIT;
