-- 007-messaging-schema.sql
-- Messaging Plan 01 — sentinel system user + deletion protection trigger.
-- Apply to both dev and prod Postgres. Idempotent.
--
-- Sets up a reserved members row (system@kscw.ch) used for system-authored
-- conversations/messages, and installs trg_messaging_protect_sentinel to
-- prevent accidental deletion.
--
-- Note: members.role is a JSON array, not a scalar. The default value for a
-- basic/standard member is '["user"]'. The sentinel uses this same value.
-- There is no unique constraint on members.email, so idempotency uses
-- WHERE NOT EXISTS rather than ON CONFLICT.

BEGIN;

-- Sentinel system user (no unique index on email; use WHERE NOT EXISTS for idempotency).
INSERT INTO members (first_name, last_name, email, role)
SELECT 'KSCW', 'System', 'system@kscw.ch', '["user"]'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE LOWER(email) = 'system@kscw.ch');

-- Protect sentinel from deletion.
CREATE OR REPLACE FUNCTION messaging_protect_sentinel()
RETURNS TRIGGER AS $$
BEGIN
  IF LOWER(OLD.email) = 'system@kscw.ch' THEN
    RAISE EXCEPTION 'Cannot delete messaging sentinel member (%)', OLD.id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_messaging_protect_sentinel ON members;
CREATE TRIGGER trg_messaging_protect_sentinel
  BEFORE DELETE ON members
  FOR EACH ROW EXECUTE FUNCTION messaging_protect_sentinel();

COMMIT;

-- ============================================================
-- Task 12: FK ON DELETE rules for all messaging tables
-- Each constraint is dropped (IF EXISTS) then re-added with
-- the correct ON DELETE action.  The block is idempotent.
-- Also makes conversations.created_by nullable so that
-- ON DELETE SET NULL works at runtime when a member is deleted.
-- ============================================================

BEGIN;

-- conversations.created_by: drop NOT NULL so SET NULL can fire
ALTER TABLE conversations ALTER COLUMN created_by DROP NOT NULL;

-- Sync Directus "required" flag for this field
UPDATE directus_fields
   SET required = false
 WHERE collection = 'conversations' AND field = 'created_by';

-- ---- conversation_members ----
ALTER TABLE conversation_members
  DROP CONSTRAINT IF EXISTS conversation_members_conversation_foreign;
ALTER TABLE conversation_members
  ADD CONSTRAINT conversation_members_conversation_foreign
  FOREIGN KEY (conversation) REFERENCES conversations(id) ON DELETE CASCADE;

ALTER TABLE conversation_members
  DROP CONSTRAINT IF EXISTS conversation_members_member_foreign;
ALTER TABLE conversation_members
  ADD CONSTRAINT conversation_members_member_foreign
  FOREIGN KEY (member) REFERENCES members(id) ON DELETE CASCADE;

-- ---- messages ----
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_conversation_foreign;
ALTER TABLE messages
  ADD CONSTRAINT messages_conversation_foreign
  FOREIGN KEY (conversation) REFERENCES conversations(id) ON DELETE CASCADE;

ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_sender_foreign;
ALTER TABLE messages
  ADD CONSTRAINT messages_sender_foreign
  FOREIGN KEY (sender) REFERENCES members(id) ON DELETE CASCADE;

ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_poll_foreign;
ALTER TABLE messages
  ADD CONSTRAINT messages_poll_foreign
  FOREIGN KEY (poll) REFERENCES polls(id) ON DELETE SET NULL;

-- ---- message_reactions ----
ALTER TABLE message_reactions
  DROP CONSTRAINT IF EXISTS message_reactions_message_foreign;
ALTER TABLE message_reactions
  ADD CONSTRAINT message_reactions_message_foreign
  FOREIGN KEY (message) REFERENCES messages(id) ON DELETE CASCADE;

ALTER TABLE message_reactions
  DROP CONSTRAINT IF EXISTS message_reactions_member_foreign;
ALTER TABLE message_reactions
  ADD CONSTRAINT message_reactions_member_foreign
  FOREIGN KEY (member) REFERENCES members(id) ON DELETE CASCADE;

-- ---- blocks ----
ALTER TABLE blocks
  DROP CONSTRAINT IF EXISTS blocks_blocker_foreign;
ALTER TABLE blocks
  ADD CONSTRAINT blocks_blocker_foreign
  FOREIGN KEY (blocker) REFERENCES members(id) ON DELETE CASCADE;

ALTER TABLE blocks
  DROP CONSTRAINT IF EXISTS blocks_blocked_foreign;
ALTER TABLE blocks
  ADD CONSTRAINT blocks_blocked_foreign
  FOREIGN KEY (blocked) REFERENCES members(id) ON DELETE CASCADE;

-- ---- message_requests ----
ALTER TABLE message_requests
  DROP CONSTRAINT IF EXISTS message_requests_conversation_foreign;
ALTER TABLE message_requests
  ADD CONSTRAINT message_requests_conversation_foreign
  FOREIGN KEY (conversation) REFERENCES conversations(id) ON DELETE CASCADE;

ALTER TABLE message_requests
  DROP CONSTRAINT IF EXISTS message_requests_sender_foreign;
ALTER TABLE message_requests
  ADD CONSTRAINT message_requests_sender_foreign
  FOREIGN KEY (sender) REFERENCES members(id) ON DELETE CASCADE;

ALTER TABLE message_requests
  DROP CONSTRAINT IF EXISTS message_requests_recipient_foreign;
ALTER TABLE message_requests
  ADD CONSTRAINT message_requests_recipient_foreign
  FOREIGN KEY (recipient) REFERENCES members(id) ON DELETE CASCADE;

-- ---- reports ----
ALTER TABLE reports
  DROP CONSTRAINT IF EXISTS reports_reporter_foreign;
ALTER TABLE reports
  ADD CONSTRAINT reports_reporter_foreign
  FOREIGN KEY (reporter) REFERENCES members(id) ON DELETE SET NULL;

ALTER TABLE reports
  DROP CONSTRAINT IF EXISTS reports_reported_member_foreign;
ALTER TABLE reports
  ADD CONSTRAINT reports_reported_member_foreign
  FOREIGN KEY (reported_member) REFERENCES members(id) ON DELETE SET NULL;

ALTER TABLE reports
  DROP CONSTRAINT IF EXISTS reports_message_foreign;
ALTER TABLE reports
  ADD CONSTRAINT reports_message_foreign
  FOREIGN KEY (message) REFERENCES messages(id) ON DELETE SET NULL;

ALTER TABLE reports
  DROP CONSTRAINT IF EXISTS reports_conversation_foreign;
ALTER TABLE reports
  ADD CONSTRAINT reports_conversation_foreign
  FOREIGN KEY (conversation) REFERENCES conversations(id) ON DELETE SET NULL;

ALTER TABLE reports
  DROP CONSTRAINT IF EXISTS reports_resolved_by_foreign;
ALTER TABLE reports
  ADD CONSTRAINT reports_resolved_by_foreign
  FOREIGN KEY (resolved_by) REFERENCES members(id) ON DELETE SET NULL;

-- ---- polls ----
ALTER TABLE polls
  DROP CONSTRAINT IF EXISTS polls_conversation_foreign;
ALTER TABLE polls
  ADD CONSTRAINT polls_conversation_foreign
  FOREIGN KEY (conversation) REFERENCES conversations(id) ON DELETE CASCADE;

-- ---- conversations ----
ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_created_by_foreign;
ALTER TABLE conversations
  ADD CONSTRAINT conversations_created_by_foreign
  FOREIGN KEY (created_by) REFERENCES members(id) ON DELETE SET NULL;

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_team_foreign;
ALTER TABLE conversations
  ADD CONSTRAINT conversations_team_foreign
  FOREIGN KEY (team) REFERENCES teams(id) ON DELETE CASCADE;

COMMIT;
