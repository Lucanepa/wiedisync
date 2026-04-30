-- Migration 035 — Second-pass permissions audit (continuing 032/033/034).
--
-- Findings the first pass missed:
--   1. Public ($t:public_label) still reads several sensitive collections:
--        • participations  — every RSVP across the club, all fields
--        • events          — every event row, all fields
--        • events_teams    — every event-team mapping
--        • slot_claims     — internal hall claim records
--      Public website (kscw-website.pages.dev) is on a separate dev/preview
--      deploy per CLAUDE.md and does not consume these. Removing.
--      Keeping public reads on:
--        games (curated 17 fields), members (curated 29 fields), halls,
--        hall_slots(_teams), hall_closures, hall_events(_halls), rankings,
--        sponsors, teams_coaches, teams_sponsors — all needed by the website.
--
--   2. KSCW Member reads with NULL filter where the row is team-internal:
--        • tasks            — coach/TR task lists per team
--        • polls            — team polls, votes already scoped to own
--        • referee_expenses — per-team financial data
--      Frontend already filters by team_id but it isn't a security boundary.
--      Scope to my-teams.
--
--   3. KSCW Coach reads with NULL filter that should be team-scoped (CUDs
--      were scoped in migration 026 but reads were left open):
--        • participations
--        • absences
--        • polls
--      Coach scope: any team I coach via teams_coaches.
--
--   4. Postgres-level: `event_signups` table has SELECT to anon/authenticated.
--      Migration 011 revoked anon/auth on the public schema but `event_signups`
--      was added afterwards (during the messaging phase) and inherited the
--      Supabase default grants. PostgREST is stopped (INFRA.md), so this is
--      defense-in-depth — closing it.
--
-- Idempotent. Apply on dev first.

BEGIN;

-- =============================================================================
-- 1. Drop public reads on sensitive collections.
-- =============================================================================
DELETE FROM directus_permissions
WHERE policy = (SELECT id FROM directus_policies WHERE name = '$t:public_label')
  AND action = 'read'
  AND collection IN ('participations','events','events_teams','slot_claims');

-- =============================================================================
-- 2. KSCW Member: scope team-internal reads.
-- =============================================================================

-- (skipping tasks: no `team` column, only activity_type/activity_id as
-- string identifiers; without a FK we can't express the team filter cleanly.
-- Tasks are low-sensitivity team to-do items — leaving open for now.)

-- polls: same — team I'm on.
UPDATE directus_permissions
SET permissions = '{"team":{"members":{"member":{"user":{"_eq":"$CURRENT_USER"}}}}}'::jsonb
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Member')
  AND collection = 'polls'
  AND action = 'read'
  AND permissions IS NULL;

-- referee_expenses: same — team I'm on. (paid_by_member.user could also be a
-- valid escape hatch, but coaches/TRs read via their own policies anyway.)
UPDATE directus_permissions
SET permissions = '{"team":{"members":{"member":{"user":{"_eq":"$CURRENT_USER"}}}}}'::jsonb
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Member')
  AND collection = 'referee_expenses'
  AND action = 'read'
  AND permissions IS NULL;

-- =============================================================================
-- 3. KSCW Coach: scope reads to teams I coach (mirrors the CUD scoping in 026).
-- =============================================================================
UPDATE directus_permissions
SET permissions = (
  '{"_or":[' ||
    '{"member":{"user":{"_eq":"$CURRENT_USER"}}},' ||
    '{"member":{"member_teams":{"team":{"coach":{"members_id":{"user":{"_eq":"$CURRENT_USER"}}}}}}}' ||
  ']}'
)::jsonb
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Coach')
  AND collection IN ('participations','absences')
  AND action = 'read'
  AND permissions IS NULL;

UPDATE directus_permissions
SET permissions = '{"team":{"coach":{"members_id":{"user":{"_eq":"$CURRENT_USER"}}}}}'::jsonb
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Coach')
  AND collection = 'polls'
  AND action IN ('create','update','delete')
  AND permissions IS NULL;

-- =============================================================================
-- 4. Postgres-level revoke on event_signups (defense in depth).
-- =============================================================================
REVOKE ALL ON event_signups FROM anon, authenticated;

COMMIT;
