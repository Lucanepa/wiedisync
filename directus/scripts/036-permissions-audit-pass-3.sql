-- Migration 036 — Third-pass audit. Closes the follow-ups from 035.
--
-- 1. Coach + Team Responsible `members.update` (fields=position,number) was
--    NULL-filtered. Scope to members on a team I coach / am responsible for.
--
-- 2. KSCW Member reads on `event_sessions` and `events_members` were NULL.
--    Scope via the parent event using the same filter as `events.read`
--    (own / club-wide / my-teams / directly-invited).
--
-- 3. KSCW Coach reads on `event_sessions` and `events_members` were NULL,
--    even though CUDs were already scoped. Scope reads to mirror CUDs.
--
-- 4. KSCW Member also has duplicate `event_sessions` / `events_members` rows
--    (M2M re-creation leftovers). The leftover NULL rows would silently
--    re-open the collection — clean them up after rewriting the canonical row.
--
-- Out of scope (intentionally open):
--   • member_teams / teams_coaches / teams_responsibles / teams_sponsors
--     reads — directory-level info; the whole-club app legitimately needs
--     cross-team rosters.
--   • Sport Admin / Vorstand wide-open reads — broad scope is the role.
--   • tasks (no team FK to traverse — see comment in 035).
--
-- Idempotent. Apply on dev first.

BEGIN;

-- =============================================================================
-- 1. Coach + Team Responsible: members.update scoped to my teams.
-- =============================================================================

-- Coach: I can update position/number for members on a team I coach.
UPDATE directus_permissions
SET permissions = '{"member_teams":{"team":{"coach":{"members_id":{"user":{"_eq":"$CURRENT_USER"}}}}}}'::jsonb
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Coach')
  AND collection = 'members'
  AND action     = 'update'
  AND permissions IS NULL;

-- Team Responsible: similarly via the team_responsible alias.
UPDATE directus_permissions
SET permissions = '{"member_teams":{"team":{"team_responsible":{"members_id":{"user":{"_eq":"$CURRENT_USER"}}}}}}'::jsonb
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Team Responsible')
  AND collection = 'members'
  AND action     = 'update'
  AND permissions IS NULL;

-- =============================================================================
-- 2. KSCW Member reads on event_sessions / events_members.
--    Filter mirrors the events.read filter from 033, traversed via `event` /
--    `events_id`.
-- =============================================================================

-- event_sessions.event → events
-- Use the union form: event scope = own / verein / tournament / my-teams / invited
-- Update the FIRST matching row, then delete any other duplicate NULL row.
WITH target AS (
  SELECT id FROM directus_permissions
  WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Member')
    AND collection = 'event_sessions'
    AND action     = 'read'
  ORDER BY id ASC
  LIMIT 1
)
UPDATE directus_permissions
SET permissions = (
  '{"event":{"_or":[' ||
    '{"created_by":{"user":{"_eq":"$CURRENT_USER"}}},' ||
    '{"event_type":{"_in":["verein","tournament"]}},' ||
    '{"teams":{"teams_id":{"members":{"member":{"user":{"_eq":"$CURRENT_USER"}}}}}},' ||
    '{"invited_members":{"members_id":{"user":{"_eq":"$CURRENT_USER"}}}}' ||
  ']}}'
)::jsonb,
    fields = '*'
WHERE id = (SELECT id FROM target);

DELETE FROM directus_permissions
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Member')
  AND collection = 'event_sessions'
  AND action     = 'read'
  AND permissions IS NULL;

-- events_members: same scope, traversed via `events_id`.
WITH target AS (
  SELECT id FROM directus_permissions
  WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Member')
    AND collection = 'events_members'
    AND action     = 'read'
  ORDER BY id ASC
  LIMIT 1
)
UPDATE directus_permissions
SET permissions = (
  '{"events_id":{"_or":[' ||
    '{"created_by":{"user":{"_eq":"$CURRENT_USER"}}},' ||
    '{"event_type":{"_in":["verein","tournament"]}},' ||
    '{"teams":{"teams_id":{"members":{"member":{"user":{"_eq":"$CURRENT_USER"}}}}}},' ||
    '{"invited_members":{"members_id":{"user":{"_eq":"$CURRENT_USER"}}}}' ||
  ']}}'
)::jsonb,
    fields = '*'
WHERE id = (SELECT id FROM target);

DELETE FROM directus_permissions
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Member')
  AND collection = 'events_members'
  AND action     = 'read'
  AND permissions IS NULL;

-- Also clean up the duplicate events_teams read rows (cosmetic — same NULL
-- filter on both, but keeping a single canonical row makes audits readable).
-- Note: KSCW Member events_teams is NULL today; we leave it NULL because it's
-- needed by the events.teams filter traversal and the visibility is bounded
-- by the events row filter Directus injects upstream.
DELETE FROM directus_permissions
WHERE id IN (
  SELECT id FROM directus_permissions
  WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Member')
    AND collection = 'events_teams'
    AND action     = 'read'
    AND permissions IS NULL
  ORDER BY id ASC
  OFFSET 1
);

-- Same dedup for hall_events_halls (M2M re-creation leftover).
DELETE FROM directus_permissions
WHERE id IN (
  SELECT id FROM directus_permissions
  WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Member')
    AND collection = 'hall_events_halls'
    AND action     = 'read'
    AND permissions IS NULL
  ORDER BY id ASC
  OFFSET 1
);

-- =============================================================================
-- 3. KSCW Coach reads on event_sessions / events_members.
-- =============================================================================
UPDATE directus_permissions
SET permissions = (
  '{"_or":[' ||
    '{"event":{"created_by":{"user":{"_eq":"$CURRENT_USER"}}}},' ||
    '{"event":{"teams":{"teams_id":{"coach":{"members_id":{"user":{"_eq":"$CURRENT_USER"}}}}}}}' ||
  ']}'
)::jsonb
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Coach')
  AND collection = 'event_sessions'
  AND action     = 'read'
  AND permissions IS NULL;

UPDATE directus_permissions
SET permissions = (
  '{"_or":[' ||
    '{"events_id":{"created_by":{"user":{"_eq":"$CURRENT_USER"}}}},' ||
    '{"events_id":{"teams":{"teams_id":{"coach":{"members_id":{"user":{"_eq":"$CURRENT_USER"}}}}}}}' ||
  ']}'
)::jsonb
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Coach')
  AND collection = 'events_members'
  AND action     = 'read'
  AND permissions IS NULL;

-- Also scope Coach create/update/delete on events_members (currently NULL).
UPDATE directus_permissions
SET permissions = (
  '{"_or":[' ||
    '{"events_id":{"created_by":{"user":{"_eq":"$CURRENT_USER"}}}},' ||
    '{"events_id":{"teams":{"teams_id":{"coach":{"members_id":{"user":{"_eq":"$CURRENT_USER"}}}}}}}' ||
  ']}'
)::jsonb
WHERE policy = (SELECT id FROM directus_policies WHERE name = 'KSCW Coach')
  AND collection = 'events_members'
  AND action     IN ('create','update','delete')
  AND permissions IS NULL;

COMMIT;
