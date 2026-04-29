-- Migration 033 — Continue the audit started in 032.
--
-- 032 closed the trainings leak. This closes the next three:
--   • absences      → previously every member could see every member's absences (privacy)
--   • participations → every member could see every member's RSVPs across all activities
--   • events        → every member could see every event regardless of audience
--
-- Out of scope (intentional):
--   • games           — KSCW match schedule is club-public information; the public
--                       policy already publishes a curated subset, member visibility
--                       is unchanged.
--   • member_teams,
--     teams_coaches,
--     teams_responsibles,
--     teams,
--     hall_slots(_teams),
--     hall_closures,
--     halls,
--     hall_events,
--     news, announcements,
--     polls, sponsors,
--     rankings,
--     referee_expenses
--                     — club-wide reference data; intentional cross-team visibility.
--
-- Adds the `members.member_teams` o2m alias (counterpart to the `teams.members`
-- alias added in migration 032) so filters can traverse:
--   <subject_member> → member_teams → team → members → member.user = me
-- (i.e., does the subject member share at least one team with me?)
--
-- Side-effects:
--   • Privately-scoped events (event_type ∉ {verein, tournament} with no team /
--     member attachment) become invisible to non-creators. Today only
--     `trainingsweekend` events are shaped that way, and those should always be
--     attached to the participating teams. Admins: keep attaching teams.
--   • Coaches/Team Responsibles/Sport Admins/Vorstand are unaffected — they read
--     via their own policies which already cover what they need.
--
-- Idempotent. Apply on dev first, restart container, smoke-test, then prod.
-- Apply on dev:  ssh hetzner "sudo docker exec -i supabase-db-vek42jyj0owoutoouq29aisq psql -U supabase_admin -d directus_kscw_dev" < directus/scripts/033-member-read-team-scoping.sql
-- Apply on prod: ssh hetzner "sudo docker exec -i supabase-db-vek42jyj0owoutoouq29aisq psql -U supabase_admin -d postgres"          < directus/scripts/033-member-read-team-scoping.sql
-- Restart: ssh hetzner "sudo docker restart directus-kscw-dev"  /  "directus-kscw"

BEGIN;

-- 1. members.member_teams o2m alias (metadata-only).
INSERT INTO directus_fields (collection, field, special, interface, hidden)
SELECT 'members', 'member_teams', 'o2m', 'list-o2m', false
WHERE NOT EXISTS (
  SELECT 1 FROM directus_fields WHERE collection = 'members' AND field = 'member_teams'
);

UPDATE directus_relations
SET one_field = 'member_teams'
WHERE many_collection = 'member_teams'
  AND many_field      = 'member'
  AND (one_field IS NULL OR one_field <> 'member_teams');

-- 2. KSCW Member × absences × read — own + same team.
UPDATE directus_permissions
SET permissions = (
  '{"_or":[' ||
    '{"member":{"user":{"_eq":"$CURRENT_USER"}}},' ||
    '{"member":{"member_teams":{"team":{"members":{"member":{"user":{"_eq":"$CURRENT_USER"}}}}}}}' ||
  ']}'
)::jsonb
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Member')
  AND collection  = 'absences'
  AND action      = 'read'
  AND permissions IS NULL;

-- 3. KSCW Member × participations × read — own + same team.
UPDATE directus_permissions
SET permissions = (
  '{"_or":[' ||
    '{"member":{"user":{"_eq":"$CURRENT_USER"}}},' ||
    '{"member":{"member_teams":{"team":{"members":{"member":{"user":{"_eq":"$CURRENT_USER"}}}}}}}' ||
  ']}'
)::jsonb
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Member')
  AND collection  = 'participations'
  AND action      = 'read'
  AND permissions IS NULL;

-- 4. KSCW Member × events × read — own / club-wide / my teams / directly invited.
UPDATE directus_permissions
SET permissions = (
  '{"_or":[' ||
    '{"created_by":{"user":{"_eq":"$CURRENT_USER"}}},' ||
    '{"event_type":{"_in":["verein","tournament"]}},' ||
    '{"teams":{"teams_id":{"members":{"member":{"user":{"_eq":"$CURRENT_USER"}}}}}},' ||
    '{"invited_members":{"members_id":{"user":{"_eq":"$CURRENT_USER"}}}}' ||
  ']}'
)::jsonb
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Member')
  AND collection  = 'events'
  AND action      = 'read'
  AND permissions IS NULL;

COMMIT;
