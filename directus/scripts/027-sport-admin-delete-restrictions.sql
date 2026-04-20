-- Migration 027 — KSCW Sport Admin: remove `delete` on `members` and `teams`.
--
-- Sport Admin is a trusted role, but two delete actions have club-wide
-- blast radius: deleting a member row wipes their licence + membership
-- history; deleting a team cascades to games/trainings/standings. These
-- should only be performed by KSCW Admin (full admin_access). Sport
-- Admins still have update + create on both collections (intake workflows
-- and profile edits still work).
--
-- Policy id for KSCW Sport Admin: d3a062d4-80c3-4103-8125-6d213a299b80
-- Idempotent.

DELETE FROM directus_permissions
WHERE policy = 'd3a062d4-80c3-4103-8125-6d213a299b80'
  AND collection IN ('members', 'teams')
  AND action = 'delete';
