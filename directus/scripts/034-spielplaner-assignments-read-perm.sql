-- Migration 034 — Grant `spielplaner_assignments.read` to non-admin policies.
--
-- Migration 031 created the `spielplaner_assignments` collection but never
-- inserted permission rows for the KSCW policies. Result: every non-admin
-- user's `loadTeamContext` (src/hooks/useAuth.tsx) silently failed inside
-- a `Promise.all`, blowing up the whole bundle and leaving `memberTeamIds=[]`.
--
-- This bug was masked until 4.4.2 / 4.4.3: the wide-open backend reads on
-- trainings/games/events/etc. returned all rows regardless of `memberTeamIds`,
-- so users still saw data — just *all* data, not their team's. Once the audit
-- tightened those reads to require team match, the upstream Promise.all
-- failure stopped being silent and members started seeing nothing instead.
--
-- Fix: grant self-scoped `read` on `spielplaner_assignments` to every KSCW
-- policy that loadTeamContext touches. Frontend only ever reads its own row
-- (`{member: {_eq: memberId}}`), so the rule is `member.user = $CURRENT_USER`.
--
-- Idempotent. Apply on dev first, restart, smoke-test, then prod.

BEGIN;

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
