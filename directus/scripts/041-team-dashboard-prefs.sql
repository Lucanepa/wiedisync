-- 041-team-dashboard-prefs.sql
-- Per-team Coach Dashboard preferences: date range + league-only toggle.
-- These are user-visible analytics state, not operational team data.
-- Field-level read access guarded via setup-permissions.mjs (NOT added to PUBLIC_TEAM_FIELDS).

BEGIN;

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS dashboard_range_from   date NULL,
  ADD COLUMN IF NOT EXISTS dashboard_range_to     date NULL,
  ADD COLUMN IF NOT EXISTS dashboard_league_only  boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN teams.dashboard_range_from  IS 'Coach Dashboard "From" date (NULL = use rolling default of most recent 01-06 ≤ today)';
COMMENT ON COLUMN teams.dashboard_range_to    IS 'Coach Dashboard "To" date (NULL = use today)';
COMMENT ON COLUMN teams.dashboard_league_only IS 'Coach Dashboard: exclude cup/tournament games from the games attendance count';

COMMIT;
