-- Migration 026 — KSCW Coach policy: scope write actions to teams the coach
-- is actually associated with via `teams_coaches` (the existing `teams.coach`
-- M2M alias). Without this, a coach could delete another team's games, events,
-- trainings, hall slot claims, task templates, referee expenses — because the
-- row filter was `{}` (fully open).
--
-- Relation chain used in filters:
--   <collection>.<team_field>  →  teams
--                               →  teams.coach  (M2M alias to teams_coaches)
--                               →  teams_coaches.members_id  (M2O to members)
--                               →  members.user  (M2O to directus_users)
--                               →  directus_users.id  = $CURRENT_USER
--
-- Per-collection team reference:
--   trainings.team               → M2O teams
--   games.kscw_team              → M2O teams
--   task_templates.team          → M2O teams
--   slot_claims.claimed_by_team  → M2O teams
--   referee_expenses.team        → M2O teams
--   events.teams                 → M2M via events_teams (teams_id)
--   event_sessions.event         → M2O events → then teams M2M
--   scorer_delegations           → scoped via from_member.user = me
--
-- Idempotent. Applied to prod + dev.
-- Policy id for KSCW Coach: e7a139e2-813d-46d1-abf6-bdf9015ac1af

-- trainings (create/update/delete)
UPDATE directus_permissions
SET permissions = '{"team":{"coach":{"members_id":{"user":{"_eq":"$CURRENT_USER"}}}}}'::jsonb
WHERE policy = 'e7a139e2-813d-46d1-abf6-bdf9015ac1af'
  AND collection = 'trainings'
  AND action IN ('create','update','delete');

-- games (update only — coaches don't create or delete games in current UX)
UPDATE directus_permissions
SET permissions = '{"kscw_team":{"coach":{"members_id":{"user":{"_eq":"$CURRENT_USER"}}}}}'::jsonb
WHERE policy = 'e7a139e2-813d-46d1-abf6-bdf9015ac1af'
  AND collection = 'games'
  AND action = 'update';

-- task_templates
UPDATE directus_permissions
SET permissions = '{"team":{"coach":{"members_id":{"user":{"_eq":"$CURRENT_USER"}}}}}'::jsonb
WHERE policy = 'e7a139e2-813d-46d1-abf6-bdf9015ac1af'
  AND collection = 'task_templates'
  AND action IN ('create','update','delete');

-- slot_claims — claimed_by_team is the team slot the claim belongs to.
UPDATE directus_permissions
SET permissions = '{"claimed_by_team":{"coach":{"members_id":{"user":{"_eq":"$CURRENT_USER"}}}}}'::jsonb
WHERE policy = 'e7a139e2-813d-46d1-abf6-bdf9015ac1af'
  AND collection = 'slot_claims'
  AND action IN ('create','update','delete');

-- referee_expenses.team — the coach's team that paid
UPDATE directus_permissions
SET permissions = '{"team":{"coach":{"members_id":{"user":{"_eq":"$CURRENT_USER"}}}}}'::jsonb
WHERE policy = 'e7a139e2-813d-46d1-abf6-bdf9015ac1af'
  AND collection = 'referee_expenses'
  AND action IN ('create','update','delete');

-- events — either an invited team is coached by me, OR I created it (personal event).
UPDATE directus_permissions
SET permissions = '{"_or":[{"created_by":{"user":{"_eq":"$CURRENT_USER"}}},{"teams":{"teams_id":{"coach":{"members_id":{"user":{"_eq":"$CURRENT_USER"}}}}}}]}'::jsonb
WHERE policy = 'e7a139e2-813d-46d1-abf6-bdf9015ac1af'
  AND collection = 'events'
  AND action IN ('create','update','delete');

-- event_sessions — scope via the parent event's team membership / creator.
UPDATE directus_permissions
SET permissions = '{"_or":[{"event":{"created_by":{"user":{"_eq":"$CURRENT_USER"}}}},{"event":{"teams":{"teams_id":{"coach":{"members_id":{"user":{"_eq":"$CURRENT_USER"}}}}}}}]}'::jsonb
WHERE policy = 'e7a139e2-813d-46d1-abf6-bdf9015ac1af'
  AND collection = 'event_sessions'
  AND action IN ('create','update','delete');

-- scorer_delegations — coach delegates their OWN scorer duty. Scope by from_member=me
-- (rather than team) so the delegator can cancel their own delegation without being
-- on the team's coach roster (e.g., coach left the team).
UPDATE directus_permissions
SET permissions = '{"from_member":{"user":{"_eq":"$CURRENT_USER"}}}'::jsonb
WHERE policy = 'e7a139e2-813d-46d1-abf6-bdf9015ac1af'
  AND collection = 'scorer_delegations'
  AND action IN ('create','update','delete');
