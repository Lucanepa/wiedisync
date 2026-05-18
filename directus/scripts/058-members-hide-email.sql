-- Migration 058: hide_email privacy flag (mirrors members.hide_phone)
--
-- When true, the member's email is nulled out in `members.items.read` API
-- responses for everyone except admins and the member themselves — exactly
-- the same enforcement path as hide_phone (see kscw-hooks "Member Privacy"
-- filter). Members toggle it from Profile → Privacy.
--
-- Schema-only + idempotent. Permissions for the new field live in
-- setup-permissions.mjs (MEMBER_VISIBLE_FIELDS / MEMBER_EDITABLE_FIELDS).

BEGIN;

ALTER TABLE members ADD COLUMN IF NOT EXISTS hide_email boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN members.hide_email IS
  'When true, the member''s email is nulled in members.items.read for everyone except admins and the member themselves (mirrors hide_phone). Enforced by the kscw-hooks Member Privacy filter.';

-- Directus field metadata so the column is editable from the admin UI.
-- Mirrors the existing hide_phone field row (special=NULL, boolean interface).
INSERT INTO directus_fields (collection, field, special, interface, sort, hidden, note)
SELECT 'members', 'hide_email', NULL, 'boolean', 18, false,
  'Hide email from other members (mirrors hide_phone). Enforced server-side.'
WHERE NOT EXISTS (
  SELECT 1 FROM directus_fields WHERE collection = 'members' AND field = 'hide_email'
);

COMMIT;
