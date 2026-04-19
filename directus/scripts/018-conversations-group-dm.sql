-- 018-conversations-group-dm.sql
-- Allow 'group_dm' as a conversations.type value.
-- Shape matches existing dm/dm_request: team IS NULL, activity_{type,id} IS NULL.
-- Idempotent: DROP IF EXISTS + ADD.

BEGIN;

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_shape_check;
ALTER TABLE conversations
  ADD CONSTRAINT conversations_shape_check CHECK (
    (type = 'team' AND team IS NOT NULL AND activity_type IS NULL AND activity_id IS NULL) OR
    (type IN ('dm','dm_request','group_dm') AND team IS NULL AND activity_type IS NULL AND activity_id IS NULL) OR
    (type = 'activity_chat' AND team IS NULL AND activity_type IS NOT NULL AND activity_id IS NOT NULL)
  );

COMMIT;
