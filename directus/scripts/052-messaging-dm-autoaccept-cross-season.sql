-- Migration 052: relax fn_messaging_dm_autoaccept season filter.
--
-- Audit 2026-05-12 finding #25. The trigger from 009 also required
-- `other_mt.season = NEW.season`, which meant pending DM requests between
-- members who once played on the same team but in DIFFERENT seasons stayed
-- pending forever — even after both rejoined the same team next season.
-- The trigger fires on a NEW member_teams insert; matching the team alone
-- (regardless of which seasons each side recorded) is the intended UX:
-- "if you're on the same team now, accept any pending request between you".
--
-- Idempotent (CREATE OR REPLACE FUNCTION).

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

COMMIT;
