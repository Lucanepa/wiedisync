-- Migration 032 — Lock down `trainings.read` to user's teams + remove public exposure.
--
-- Discovered while auditing why Alex Leonhardt (Member, only on team H3) was
-- seeing all 175 future trainings instead of his team's 11. Root cause:
--   • KSCW Member × trainings × read had `permissions = NULL` (no row filter)
--   • Public ($t:public_label) × trainings × read also `permissions = NULL`,
--     fields = '*' — anyone unauthenticated could fetch every training row.
--
-- Frontend already has the correct UX (TrainingsPage scopes via TeamFilter +
-- effectiveFilter), but it isn't a security boundary: other pages query
-- `/items/trainings` without a team filter (Hallenplan, Calendar, ScorerAssign,
-- PlayerProfile, ExplorerCache) and rely on backend RBAC to enforce scope.
--
-- This migration:
--   1. Adds a `teams.members` o2m alias so the row filter can traverse
--      teams → member_teams → members → directus_users (mirrors how
--      `teams.coach` enables the existing coach-side filters).
--   2. Replaces the NULL row filter on KSCW Member × trainings × read with
--      `{team:{members:{member:{user:{_eq:"$CURRENT_USER"}}}}}` — a member
--      sees a training iff they are on its team via member_teams.
--   3. Deletes the Public × trainings × read permission row entirely. The
--      public website (kscw-website.pages.dev) and scoreboard never read
--      `trainings`; only `games` is needed for public schedules.
--
-- Side-effect: Hallenplan + Calendar will only show the requesting member's
-- own teams' trainings going forward. If users complain that hall occupancy
-- looks empty for other teams' slots, follow-up by adding a SECOND read row
-- with row filter NULL but fields restricted to occupancy-only metadata
-- (id, date, start_time, end_time, hall, team).
--
-- Idempotent. Apply on dev first, restart the dev container, smoke-test,
-- then apply on prod.
-- Apply on dev: ssh hetzner "sudo docker exec -i supabase-db-vek42jyj0owoutoouq29aisq psql -U supabase_admin -d directus_kscw_dev" < directus/scripts/032-trainings-team-scoping.sql
-- Apply on prod: ssh hetzner "sudo docker exec -i supabase-db-vek42jyj0owoutoouq29aisq psql -U supabase_admin -d postgres" < directus/scripts/032-trainings-team-scoping.sql
-- Restart: ssh hetzner "sudo docker restart directus-kscw-dev" / "directus-kscw"

BEGIN;

-- 1. Inverse alias `teams.members` for member_teams.team (metadata-only).
INSERT INTO directus_fields (collection, field, special, interface, hidden)
SELECT 'teams', 'members', 'o2m', 'list-o2m', false
WHERE NOT EXISTS (
  SELECT 1 FROM directus_fields WHERE collection = 'teams' AND field = 'members'
);

UPDATE directus_relations
SET one_field = 'members'
WHERE many_collection = 'member_teams'
  AND many_field      = 'team'
  AND (one_field IS NULL OR one_field <> 'members');

-- 2. Tighten KSCW Member × trainings × read.
UPDATE directus_permissions
SET permissions = '{"team":{"members":{"member":{"user":{"_eq":"$CURRENT_USER"}}}}}'::jsonb
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Member')
  AND collection  = 'trainings'
  AND action      = 'read'
  AND permissions IS NULL;

-- 3. Remove Public × trainings × read.
DELETE FROM directus_permissions
WHERE policy = (SELECT id FROM directus_policies WHERE name = '$t:public_label')
  AND collection = 'trainings'
  AND action     = 'read';

COMMIT;
