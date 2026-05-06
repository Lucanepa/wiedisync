-- Migration 043 — Security hardening pass (2026-05-06).
--
-- Closes the structural gaps surfaced by the deep permission + Postgres audit:
--
--   1. sv_vm_check.read — KSCW Member could read every member's row (Swiss
--      Volley association_id, nationality_code, is_foreigner, licence dates).
--      Scope to own member row.
--
--   2. tasks.read — unfiltered for KSCW Member. Migration 035 deferred this
--      with "no team FK". Tasks have `assigned_to` and `claimed_by` member
--      FKs already used by the matching update permission — reuse them.
--
--   3. feedback.read — unfiltered for KSCW Member. Members could enumerate
--      every submitter's name + email + complaint text.
--
--   4. teams.update — Coach + Team Responsible policies had no row filter
--      (only "filter at API" comment). A coach on Team H3 could PATCH
--      /items/teams/<other-team-id>.
--
--   5. teams_sponsors.sponsors_id — was created without an FK constraint
--      (migration 037 explicitly deferred). Same `"null"` integer-filter
--      class as 021/037. Add ON DELETE CASCADE after orphan cleanup.
--
--   6. member_teams.read — exposed `guest_level` cross-team. Strip the
--      field from cross-member reads (kept on own row).
--
--   7. messaging trigger functions (008, 009, 016, 017, plus
--      messaging_protect_sentinel in 007) created without
--      `SET search_path = public`. The original 001 file did this
--      consistently — the messaging functions added later regressed.
--      Patch each in place via ALTER FUNCTION.
--
--   8. bugfix_jobs — defense-in-depth explicit REVOKE FROM anon,
--      authenticated. Migration 011 covers this via a generic loop, but
--      006 created the table without an explicit revoke, so a partial
--      apply order leaks the table to PostgREST.
--
-- Idempotent. Apply on dev first, then prod.

BEGIN;

-- =============================================================================
-- 1. sv_vm_check — scope to own member row.
-- =============================================================================
-- The FK chain is sv_vm_check.member → members.id → members.user → directus_users.
-- (Verify the FK shape with: SELECT many_field FROM directus_relations
--  WHERE many_collection = 'sv_vm_check'; before applying.)

UPDATE directus_permissions
SET permissions = '{"member":{"user":{"_eq":"$CURRENT_USER"}}}'::jsonb
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Member')
  AND collection = 'sv_vm_check'
  AND action     = 'read'
  AND (permissions IS NULL OR permissions::text = '{}');

-- =============================================================================
-- 2. tasks — scope read to own assignments / claims (mirrors update perm).
-- =============================================================================

UPDATE directus_permissions
SET permissions = (
  '{"_or":[' ||
    '{"assigned_to":{"user":{"_eq":"$CURRENT_USER"}}},' ||
    '{"claimed_by":{"user":{"_eq":"$CURRENT_USER"}}}' ||
  ']}'
)::jsonb
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Member')
  AND collection = 'tasks'
  AND action     = 'read'
  AND (permissions IS NULL OR permissions::text = '{}');

-- =============================================================================
-- 3. feedback — scope read to own submissions.
-- =============================================================================
-- Self-bounded by submitter email matching the caller's auth email.
-- Anonymous submissions (no email) drop out, which is fine — the admin views
-- run under the admin policy and see everything.

UPDATE directus_permissions
SET permissions = (
  '{"email":{"_eq":"$CURRENT_USER.email"}}'
)::jsonb
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Member')
  AND collection = 'feedback'
  AND action     = 'read'
  AND (permissions IS NULL OR permissions::text = '{}');

-- =============================================================================
-- 4. teams.update — scope Coach + Team Responsible to their own teams.
-- =============================================================================

UPDATE directus_permissions
SET permissions = '{"coach":{"members_id":{"user":{"_eq":"$CURRENT_USER"}}}}'::jsonb
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Coach')
  AND collection = 'teams'
  AND action     = 'update'
  AND (permissions IS NULL OR permissions::text = '{}');

UPDATE directus_permissions
SET permissions = '{"team_responsible":{"members_id":{"user":{"_eq":"$CURRENT_USER"}}}}'::jsonb
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Team Responsible')
  AND collection = 'teams'
  AND action     = 'update'
  AND (permissions IS NULL OR permissions::text = '{}');

-- =============================================================================
-- 5. teams_sponsors.sponsors_id — add missing FK with ON DELETE CASCADE.
-- =============================================================================
-- Closes the deferred half of migration 037.

DELETE FROM teams_sponsors
WHERE sponsors_id IS NOT NULL
  AND sponsors_id NOT IN (SELECT id FROM sponsors);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'teams_sponsors'::regclass
      AND contype = 'f'
      AND conname = 'teams_sponsors_sponsors_id_foreign'
  ) THEN
    ALTER TABLE teams_sponsors
      ADD CONSTRAINT teams_sponsors_sponsors_id_foreign
      FOREIGN KEY (sponsors_id) REFERENCES sponsors(id) ON DELETE CASCADE;
  END IF;
END $$;

-- =============================================================================
-- 6. member_teams.read — strip guest_level from cross-team field set.
-- =============================================================================
-- Keep `id, member, team, season` for cross-team directory needs (per the
-- migration 036 "intentionally open" decision). guest_level is internal
-- routing data that lets a member discover who is a guest on which team.

UPDATE directus_permissions
SET fields = 'id,member,team,season'
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Member')
  AND collection = 'member_teams'
  AND action     = 'read'
  AND (fields IS NULL OR fields = '*' OR fields LIKE '%guest_level%');

-- =============================================================================
-- 7. Messaging trigger functions — add SET search_path = public.
-- =============================================================================
-- Patch in place; ALTER FUNCTION ... SET search_path is idempotent.

ALTER FUNCTION messaging_protect_sentinel() SET search_path = public;
ALTER FUNCTION fn_messaging_teams_members_insert() SET search_path = public;
ALTER FUNCTION fn_messaging_teams_members_delete() SET search_path = public;
ALTER FUNCTION fn_messaging_member_team_chat_enabled() SET search_path = public;
ALTER FUNCTION fn_messaging_teams_insert() SET search_path = public;
ALTER FUNCTION fn_messaging_dm_autoaccept() SET search_path = public;
ALTER FUNCTION fn_participations_activity_chat_sync() SET search_path = public;
ALTER FUNCTION fn_activity_chat_event_delete() SET search_path = public;

-- =============================================================================
-- 8. bugfix_jobs — explicit revoke from PostgREST roles.
-- =============================================================================

REVOKE ALL ON bugfix_jobs FROM anon;
REVOKE ALL ON bugfix_jobs FROM authenticated;

COMMIT;

-- =============================================================================
-- Verification queries (read-only):
-- =============================================================================
-- 1. sv_vm_check + tasks + feedback + teams scoping:
-- SELECT pol.name, p.collection, p.action, p.permissions, p.fields
-- FROM directus_permissions p
-- JOIN directus_policies pol ON pol.id = p.policy
-- WHERE (p.collection IN ('sv_vm_check','tasks','feedback','teams','member_teams'))
-- ORDER BY pol.name, p.collection, p.action;
--
-- 2. teams_sponsors FK present:
-- SELECT conname, confdeltype FROM pg_constraint
-- WHERE conrelid = 'teams_sponsors'::regclass AND contype = 'f';
--
-- 3. messaging functions have search_path:
-- SELECT proname, proconfig FROM pg_proc WHERE proname LIKE 'fn_messaging%' OR proname = 'messaging_protect_sentinel';
