-- =============================================================================
-- 009-messaging-dm-autoaccept.sql
-- KSCW Messaging v1 — Plan 03
--
-- Trigger 7: on member_teams INSERT, auto-promote any pending message_requests
-- between the inserted member and any other CURRENT teammate to status='accepted'
-- and conversations.type='dm', UNLESS a block exists either direction.
-- Idempotent; safe to re-run.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION fn_messaging_dm_autoaccept()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT mr.id AS request_id, mr.conversation AS conv_id,
           mr.sender AS sender_id, mr.recipient AS recipient_id
      FROM message_requests mr
      JOIN member_teams other_mt
        ON other_mt.team = NEW.team
       AND other_mt.season = NEW.season
       AND other_mt.member <> NEW.member
     WHERE mr.status = 'pending'
       AND (
         (mr.sender = NEW.member    AND mr.recipient = other_mt.member) OR
         (mr.recipient = NEW.member AND mr.sender    = other_mt.member)
       )
       AND NOT EXISTS (
         SELECT 1 FROM blocks b
          WHERE (b.blocker = mr.sender    AND b.blocked = mr.recipient)
             OR (b.blocker = mr.recipient AND b.blocked = mr.sender)
       )
  LOOP
    UPDATE message_requests
       SET status = 'accepted',
           resolved_at = CURRENT_TIMESTAMP
     WHERE id = r.request_id;
    UPDATE conversations
       SET type = 'dm'
     WHERE id = r.conv_id;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messaging_dm_autoaccept ON member_teams;
CREATE TRIGGER trg_messaging_dm_autoaccept
  AFTER INSERT ON member_teams
  FOR EACH ROW
  EXECUTE FUNCTION fn_messaging_dm_autoaccept();

COMMIT;
