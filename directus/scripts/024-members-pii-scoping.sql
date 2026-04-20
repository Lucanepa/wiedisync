-- Migration 024 — KSCW Member policy: scope email + phone to self only.
--
-- Bug: the KSCW Member policy had TWO read rows on `members`:
--   7045 — no filter (any member reads any other member), fields included email, phone
--   7046 — filter {user=$CURRENT_USER} (self only), fields: everything (incl. birthdate, ahv_nummer, adresse, etc.)
--
-- Row 7045's field list leaked `email` and `phone` of every member to every other member.
-- The `hide_phone` user-preference flag was only enforced in the UI, not in the policy —
-- so a malicious member could bypass it by calling `/items/members?fields=phone` directly.
--
-- Fix: remove `email` and `phone` from row 7045. They remain on row 7046 (self view),
-- so users still see their own email + phone, and self-edit flows keep working.
-- `/kscw/*` endpoints that need to expose contact info to teammates can do so via
-- server-side checks (admin-scoped ItemsService) without reopening this hole.
--
-- Idempotent. Applied to prod + dev.

UPDATE directus_permissions
SET fields = 'id,first_name,last_name,photo,number,position,licences,user,coach_approved_team,role,language,requested_team,birthdate_visibility,hide_phone,license_nr,sex,licence_category,licence_activated,licence_validated'
WHERE policy = 'cf8ee341-dcd2-4dfe-8da8-7960e9943caa'
  AND collection = 'members'
  AND action = 'read'
  AND permissions IS NULL;  -- row 7045 (no filter)
