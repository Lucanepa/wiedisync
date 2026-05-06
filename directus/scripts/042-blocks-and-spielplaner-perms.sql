-- Migration 042 — Restore self-scoped read perms on `blocks` and
-- `spielplaner_assignments` for all KSCW policies.
--
-- Bug: every non-admin user hits 403 on these two collections on every page
-- load (Layout → useUnreadTotal → useConversations → useBlocks fires
-- `fetchAllItems('blocks')`; useAuth.loadTeamContext fires `fetchAllItems
-- ('spielplaner_assignments')`). The hooks catch the throw silently, but
-- `fetchAllItems` reports each one to Sentry / error logs first — flooding
-- the JSONL log every time a Member opens the app.
--
-- Audit (2026-05-06): the only existing perm row across both collections was
-- `KSCW Coach → spielplaner_assignments.read`. Migrations 009 (messaging
-- perms — KSCW Member blocks.read) and 034 (spielplaner_assignments.read
-- for the four other KSCW policies) were never applied to prod, or were
-- wiped during the 035/036 audit passes.
--
-- Fix: idempotently grant self-scoped READ to the five non-admin KSCW
-- policies. The frontend only ever reads its own row in both cases:
--   - blocks → `blocker._eq: user.id`
--   - spielplaner_assignments → `member._eq: memberId`
-- so the row filter mirrors the query (caller's $CURRENT_USER).
--
-- Mirrors the row filter pattern from 009 (blocks) and 034
-- (spielplaner_assignments). Idempotent via NOT EXISTS guard. Apply on dev
-- first, then prod.

BEGIN;

-- blocks.read — Members see only blocks THEY created. Incoming blocks stay
-- opaque (a member who blocked you shouldn't be discoverable via API probe).
INSERT INTO directus_permissions (collection, action, permissions, fields, policy)
SELECT 'blocks', 'read',
       '{"blocker":{"user":{"_eq":"$CURRENT_USER"}}}'::jsonb,
       '*',
       pol.id
FROM directus_policies pol
WHERE pol.name IN (
  'KSCW Member',
  'KSCW Coach',
  'KSCW Team Responsible',
  'KSCW Vorstand',
  'KSCW Sport Admin'
)
  AND NOT EXISTS (
    SELECT 1 FROM directus_permissions
    WHERE policy = pol.id
      AND collection = 'blocks'
      AND action = 'read'
  );

-- spielplaner_assignments.read — self-scoped (same as 034).
INSERT INTO directus_permissions (collection, action, permissions, fields, policy)
SELECT 'spielplaner_assignments', 'read',
       '{"member":{"user":{"_eq":"$CURRENT_USER"}}}'::jsonb,
       '*',
       pol.id
FROM directus_policies pol
WHERE pol.name IN (
  'KSCW Member',
  'KSCW Coach',
  'KSCW Team Responsible',
  'KSCW Vorstand',
  'KSCW Sport Admin'
)
  AND NOT EXISTS (
    SELECT 1 FROM directus_permissions
    WHERE policy = pol.id
      AND collection = 'spielplaner_assignments'
      AND action = 'read'
  );

COMMIT;

-- Verify (read-only):
-- SELECT pol.name, p.collection, p.action, p.permissions
-- FROM directus_permissions p
-- JOIN directus_policies pol ON pol.id = p.policy
-- WHERE p.collection IN ('blocks','spielplaner_assignments')
-- ORDER BY pol.name, p.collection;
