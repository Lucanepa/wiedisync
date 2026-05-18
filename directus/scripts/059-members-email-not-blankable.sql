-- Migration 059: prevent blanking an existing members.email
--
-- Backstop for the data-integrity bug where a member could clear their email
-- in Profile → Edit and wipe their only contact channel (breaks notifications,
-- password reset, ClubDesk sync). The frontend now requires it, but this is
-- the server-side guard against any other write path (direct API, imports,
-- future code). It only blocks set->blank; legitimately *changing* an email
-- to a new non-empty value is unaffected, and rows that never had an email
-- (shell invites / youth members with NULL) stay editable.
--
-- Schema-only (trigger) + idempotent.

BEGIN;

CREATE OR REPLACE FUNCTION members_prevent_email_blanking()
RETURNS trigger AS $$
BEGIN
  IF OLD.email IS NOT NULL AND btrim(OLD.email) <> ''
     AND (NEW.email IS NULL OR btrim(NEW.email) = '') THEN
    RAISE EXCEPTION
      'members.email cannot be cleared once set (member id %): it is the member''s only contact channel and is required for notifications and ClubDesk sync', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_members_prevent_email_blanking ON members;
CREATE TRIGGER trg_members_prevent_email_blanking
  BEFORE UPDATE OF email ON members
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION members_prevent_email_blanking();

COMMIT;
