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
