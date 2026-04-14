-- ============================================================
-- KSCW Statistics Views
-- Run: ssh vps "sudo docker exec -i coolify-db psql -U directus -d directus_kscw_prod" < directus/scripts/003-stat-views.sql
-- Dev: ssh vps "sudo docker exec -i coolify-db psql -U directus -d directus_kscw_dev" < directus/scripts/003-stat-views.sql
--
-- After applying: restart Directus so it discovers the new views
--   ssh vps "sudo docker restart directus-kscw-prod"
-- Then in Directus Admin: Settings > Data Model > click each view > enable read permission
-- ============================================================

-- ============================================================
-- 1. MEMBER STATS — global counts by licence, role, status
-- ============================================================
DROP VIEW IF EXISTS stats_members CASCADE;
CREATE VIEW stats_members AS
SELECT
  COUNT(*)                                                        AS total_members,
  COUNT(*) FILTER (WHERE wiedisync_active = true)                 AS active_wiedisync,
  COUNT(*) FILTER (WHERE shell = true)                            AS shell_accounts,
  COUNT(*) FILTER (WHERE shell = false AND wiedisync_active = true) AS registered_users,
  -- Licences (JSON array, check with @> operator)
  COUNT(*) FILTER (WHERE licences::jsonb @> '"scorer_vb"')        AS licence_scorer_vb,
  COUNT(*) FILTER (WHERE licences::jsonb @> '"referee_vb"')       AS licence_referee_vb,
  COUNT(*) FILTER (WHERE licences::jsonb @> '"otr1_bb"')          AS licence_otr1_bb,
  COUNT(*) FILTER (WHERE licences::jsonb @> '"otr2_bb"')          AS licence_otr2_bb,
  -- Roles
  COUNT(*) FILTER (WHERE role::jsonb @> '"superuser"')            AS role_superuser,
  COUNT(*) FILTER (WHERE role::jsonb @> '"admin"')                AS role_admin,
  COUNT(*) FILTER (WHERE role::jsonb @> '"vb_admin"')             AS role_vb_admin,
  COUNT(*) FILTER (WHERE role::jsonb @> '"bb_admin"')             AS role_bb_admin,
  COUNT(*) FILTER (WHERE role::jsonb @> '"vorstand"')             AS role_vorstand
FROM members;

-- ============================================================
-- 2. TEAM ROSTER STATS — per team: member count, coaches, leadership
-- ============================================================
DROP VIEW IF EXISTS stats_team_roster CASCADE;
CREATE VIEW stats_team_roster AS
SELECT
  t.id                                    AS team_id,
  t.name                                  AS team_name,
  t.sport,
  t.league,
  t.active                                AS team_active,
  -- Roster size (current season members, excl. guests)
  COUNT(DISTINCT mt.member)
    FILTER (WHERE mt.guest_level = 0)     AS roster_size,
  -- Guest count
  COUNT(DISTINCT mt.member)
    FILTER (WHERE mt.guest_level > 0)     AS guest_count,
  -- VB licences
  COUNT(DISTINCT mt.member)
    FILTER (WHERE mt.guest_level = 0
      AND m.licences::jsonb @> '"scorer_vb"') AS lic_scorer_vb,
  COUNT(DISTINCT mt.member)
    FILTER (WHERE mt.guest_level = 0
      AND m.licences::jsonb @> '"referee_vb"') AS lic_referee_vb,
  -- BB licences
  COUNT(DISTINCT mt.member)
    FILTER (WHERE mt.guest_level = 0
      AND m.licences::jsonb @> '"otr1_bb"') AS lic_otr1_bb,
  COUNT(DISTINCT mt.member)
    FILTER (WHERE mt.guest_level = 0
      AND m.licences::jsonb @> '"otr2_bb"') AS lic_otr2_bb,
  COUNT(DISTINCT mt.member)
    FILTER (WHERE mt.guest_level = 0
      AND m.licences::jsonb @> '"referee_bb"') AS lic_referee_bb,
  -- Leadership (prod table names — dev uses teams_coach, teams_captain, teams_team_responsible)
  (SELECT COUNT(*) FROM teams_coaches tc WHERE tc.teams_id = t.id)              AS coach_count,
  CASE WHEN t.captain IS NOT NULL THEN 1 ELSE 0 END                            AS captain_count,
  (SELECT COUNT(*) FROM teams_responsibles tc WHERE tc.teams_id = t.id)        AS team_responsible_count
FROM teams t
LEFT JOIN member_teams mt ON mt.team = t.id
LEFT JOIN members m ON m.id = mt.member
WHERE t.active = true
GROUP BY t.id, t.name, t.sport, t.league, t.active;

-- ============================================================
-- 3. SCHREIBER COVERAGE — per team: how many games have duties assigned
-- ============================================================
DROP VIEW IF EXISTS stats_schreiber_coverage CASCADE;
CREATE VIEW stats_schreiber_coverage AS
SELECT
  t.id                                                AS team_id,
  t.name                                              AS team_name,
  t.sport,
  -- Total home games (schreiber duty is for home games)
  COUNT(DISTINCT g.id)                                AS total_home_games,

  -- === VOLLEYBALL duties ===
  COUNT(DISTINCT g.id) FILTER (
    WHERE t.sport = 'volleyball' AND g.scorer_member IS NOT NULL
  )                                                   AS vb_scorer_assigned,
  COUNT(DISTINCT g.id) FILTER (
    WHERE t.sport = 'volleyball' AND g.scoreboard_member IS NOT NULL
  )                                                   AS vb_scoreboard_assigned,
  COUNT(DISTINCT g.id) FILTER (
    WHERE t.sport = 'volleyball' AND g.scorer_scoreboard_member IS NOT NULL
  )                                                   AS vb_scorer_scoreboard_assigned,
  -- VB: games with ANY schreiber duty set
  COUNT(DISTINCT g.id) FILTER (
    WHERE t.sport = 'volleyball' AND (
      g.scorer_member IS NOT NULL
      OR g.scoreboard_member IS NOT NULL
      OR g.scorer_scoreboard_member IS NOT NULL
    )
  )                                                   AS vb_any_duty_assigned,
  -- VB: games MISSING all duties
  COUNT(DISTINCT g.id) FILTER (
    WHERE t.sport = 'volleyball'
      AND g.scorer_member IS NULL
      AND g.scoreboard_member IS NULL
      AND g.scorer_scoreboard_member IS NULL
  )                                                   AS vb_no_duty_assigned,

  -- === BASKETBALL duties ===
  COUNT(DISTINCT g.id) FILTER (
    WHERE t.sport = 'basketball' AND g.bb_scorer_member IS NOT NULL
  )                                                   AS bb_scorer_assigned,
  COUNT(DISTINCT g.id) FILTER (
    WHERE t.sport = 'basketball' AND g.bb_timekeeper_member IS NOT NULL
  )                                                   AS bb_timekeeper_assigned,
  COUNT(DISTINCT g.id) FILTER (
    WHERE t.sport = 'basketball' AND g.bb_24s_official IS NOT NULL
  )                                                   AS bb_24s_assigned,
  -- BB: games with ANY duty set
  COUNT(DISTINCT g.id) FILTER (
    WHERE t.sport = 'basketball' AND (
      g.bb_scorer_member IS NOT NULL
      OR g.bb_timekeeper_member IS NOT NULL
      OR g.bb_24s_official IS NOT NULL
    )
  )                                                   AS bb_any_duty_assigned,
  -- BB: games MISSING all duties
  COUNT(DISTINCT g.id) FILTER (
    WHERE t.sport = 'basketball'
      AND g.bb_scorer_member IS NULL
      AND g.bb_timekeeper_member IS NULL
      AND g.bb_24s_official IS NULL
  )                                                   AS bb_no_duty_assigned

FROM teams t
LEFT JOIN games g ON g.kscw_team = t.id AND g.type = 'home'
WHERE t.active = true
GROUP BY t.id, t.name, t.sport;

-- ============================================================
-- 4. UPCOMING GAMES WITHOUT SCHREIBER — actionable list
-- ============================================================
DROP VIEW IF EXISTS stats_games_missing_schreiber CASCADE;
CREATE VIEW stats_games_missing_schreiber AS
SELECT
  g.id                AS game_id,
  g.date              AS game_date,
  g.time              AS game_time,
  g.home_team,
  g.away_team,
  g.league,
  t.id                AS team_id,
  t.name              AS team_name,
  t.sport,
  -- Which specific roles are missing
  CASE
    WHEN t.sport = 'volleyball' THEN
      CONCAT_WS(', ',
        CASE WHEN g.scorer_member IS NULL AND g.scorer_scoreboard_member IS NULL THEN 'Schreiber' END,
        CASE WHEN g.scoreboard_member IS NULL AND g.scorer_scoreboard_member IS NULL THEN 'Anzeiger' END
      )
    WHEN t.sport = 'basketball' THEN
      CONCAT_WS(', ',
        CASE WHEN g.bb_scorer_member IS NULL THEN 'Scorer' END,
        CASE WHEN g.bb_timekeeper_member IS NULL THEN 'Zeitnehmer' END,
        CASE WHEN g.bb_24s_official IS NULL THEN '24s' END
      )
  END                 AS missing_roles,
  -- Duty team (if a different team should provide the schreiber)
  COALESCE(g.scorer_duty_team, g.bb_duty_team) AS duty_team_id
FROM games g
JOIN teams t ON t.id = g.kscw_team
WHERE g.type = 'home'
  AND g.date >= CURRENT_DATE
  AND g.status IN ('scheduled', 'live')
  AND (
    -- VB: missing any duty
    (t.sport = 'volleyball'
      AND g.scorer_member IS NULL
      AND g.scoreboard_member IS NULL
      AND g.scorer_scoreboard_member IS NULL)
    OR
    -- BB: missing any duty
    (t.sport = 'basketball'
      AND g.bb_scorer_member IS NULL
      AND g.bb_timekeeper_member IS NULL
      AND g.bb_24s_official IS NULL)
  )
ORDER BY g.date, g.time;

-- ============================================================
-- 5. PARTICIPATION RATES — per team RSVP stats for games & trainings
-- ============================================================
DROP VIEW IF EXISTS stats_participation CASCADE;
CREATE VIEW stats_participation AS
WITH game_rsvp AS (
  SELECT
    g.kscw_team                                       AS team_id,
    COUNT(DISTINCT g.id)                              AS total_games,
    COUNT(DISTINCT p.activity_id)                     AS total_responses,
    COUNT(DISTINCT p.activity_id) FILTER (WHERE p.status = 'confirmed')   AS confirmed,
    COUNT(DISTINCT p.activity_id) FILTER (WHERE p.status = 'declined')    AS declined,
    COUNT(DISTINCT p.activity_id) FILTER (WHERE p.status = 'tentative')   AS tentative
  FROM games g
  LEFT JOIN participations p ON p.activity_type = 'game'
    AND p.activity_id = g.id::text
  WHERE g.date >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY g.kscw_team
),
training_rsvp AS (
  SELECT
    tr.team                                           AS team_id,
    COUNT(DISTINCT tr.id)                             AS total_trainings,
    COUNT(DISTINCT p.activity_id)                     AS total_responses,
    COUNT(DISTINCT p.activity_id) FILTER (WHERE p.status = 'confirmed')   AS confirmed,
    COUNT(DISTINCT p.activity_id) FILTER (WHERE p.status = 'declined')    AS declined,
    COUNT(DISTINCT p.activity_id) FILTER (WHERE p.status = 'tentative')   AS tentative
  FROM trainings tr
  LEFT JOIN participations p ON p.activity_type = 'training'
    AND p.activity_id = tr.id::text
  WHERE tr.date >= CURRENT_DATE - INTERVAL '90 days'
    AND tr.cancelled = false
  GROUP BY tr.team
)
SELECT
  t.id                          AS team_id,
  t.name                        AS team_name,
  t.sport,
  -- Games
  COALESCE(gr.total_games, 0)       AS games_total,
  COALESCE(gr.total_responses, 0)   AS games_responses,
  COALESCE(gr.confirmed, 0)         AS games_confirmed,
  COALESCE(gr.declined, 0)          AS games_declined,
  COALESCE(gr.tentative, 0)         AS games_tentative,
  -- Trainings
  COALESCE(tr.total_trainings, 0)   AS trainings_total,
  COALESCE(tr.total_responses, 0)   AS trainings_responses,
  COALESCE(tr.confirmed, 0)         AS trainings_confirmed,
  COALESCE(tr.declined, 0)          AS trainings_declined,
  COALESCE(tr.tentative, 0)         AS trainings_tentative
FROM teams t
LEFT JOIN game_rsvp gr ON gr.team_id = t.id
LEFT JOIN training_rsvp tr ON tr.team_id = t.id
WHERE t.active = true;

-- ============================================================
-- 6. GAME RESULTS SUMMARY — per team W/L/D record
-- ============================================================
DROP VIEW IF EXISTS stats_game_results CASCADE;
CREATE VIEW stats_game_results AS
SELECT
  t.id                                                AS team_id,
  t.name                                              AS team_name,
  t.sport,
  g.season,
  COUNT(*)                                            AS games_played,
  COUNT(*) FILTER (WHERE g.home_score > g.away_score
    AND g.type = 'home')                              AS home_wins,
  COUNT(*) FILTER (WHERE g.home_score < g.away_score
    AND g.type = 'home')                              AS home_losses,
  COUNT(*) FILTER (WHERE g.away_score > g.home_score
    AND g.type = 'away')                              AS away_wins,
  COUNT(*) FILTER (WHERE g.away_score < g.home_score
    AND g.type = 'away')                              AS away_losses,
  -- Total wins/losses regardless of home/away
  COUNT(*) FILTER (WHERE
    (g.type = 'home' AND g.home_score > g.away_score)
    OR (g.type = 'away' AND g.away_score > g.home_score)
  )                                                   AS total_wins,
  COUNT(*) FILTER (WHERE
    (g.type = 'home' AND g.home_score < g.away_score)
    OR (g.type = 'away' AND g.away_score < g.home_score)
  )                                                   AS total_losses
FROM teams t
JOIN games g ON g.kscw_team = t.id
WHERE g.status = 'completed'
  AND g.home_score IS NOT NULL
  AND g.away_score IS NOT NULL
GROUP BY t.id, t.name, t.sport, g.season;

-- ============================================================
-- 7. DELEGATION STATS — scorer delegation activity
-- ============================================================
DROP VIEW IF EXISTS stats_delegations CASCADE;
CREATE VIEW stats_delegations AS
SELECT
  t.id                                                AS team_id,
  t.name                                              AS team_name,
  t.sport,
  COUNT(*)                                            AS total_delegations,
  COUNT(*) FILTER (WHERE sd.status = 'accepted')      AS accepted,
  COUNT(*) FILTER (WHERE sd.status = 'declined')      AS declined_count,
  COUNT(*) FILTER (WHERE sd.status = 'pending')       AS pending,
  COUNT(*) FILTER (WHERE sd.status = 'expired')       AS expired,
  COUNT(*) FILTER (WHERE sd.same_team = true)          AS same_team_transfers,
  COUNT(*) FILTER (WHERE sd.same_team = false)         AS cross_team_transfers
FROM teams t
JOIN scorer_delegations sd ON sd.from_team = t.id
GROUP BY t.id, t.name, t.sport;

-- ============================================================
-- 8. CLUB OVERVIEW — single-row summary for dashboard header
-- ============================================================
DROP VIEW IF EXISTS stats_club_overview CASCADE;
CREATE VIEW stats_club_overview AS
SELECT
  (SELECT COUNT(*) FROM members WHERE wiedisync_active = true)    AS active_members,
  (SELECT COUNT(*) FROM teams WHERE active = true)                AS active_teams,
  (SELECT COUNT(*) FROM teams WHERE active = true AND sport = 'volleyball')  AS vb_teams,
  (SELECT COUNT(*) FROM teams WHERE active = true AND sport = 'basketball')  AS bb_teams,
  (SELECT COUNT(*) FROM games WHERE date >= CURRENT_DATE AND status = 'scheduled') AS upcoming_games,
  (SELECT COUNT(*) FROM games WHERE status = 'completed')         AS completed_games,
  (SELECT COUNT(*) FROM trainings WHERE date >= CURRENT_DATE AND cancelled = false) AS upcoming_trainings,
  (SELECT COUNT(*) FROM events WHERE start_date >= NOW())         AS upcoming_events,
  -- Schreiber coverage for upcoming home games
  (SELECT COUNT(*) FROM games
    WHERE type = 'home' AND date >= CURRENT_DATE AND status = 'scheduled') AS upcoming_home_games,
  (SELECT COUNT(*) FROM games g
    JOIN teams t ON t.id = g.kscw_team
    WHERE g.type = 'home' AND g.date >= CURRENT_DATE AND g.status = 'scheduled'
    AND (
      (t.sport = 'volleyball' AND g.scorer_member IS NULL AND g.scoreboard_member IS NULL AND g.scorer_scoreboard_member IS NULL)
      OR (t.sport = 'basketball' AND g.bb_scorer_member IS NULL AND g.bb_timekeeper_member IS NULL AND g.bb_24s_official IS NULL)
    )
  ) AS upcoming_home_games_no_schreiber;

-- ============================================================
-- Done! Views created:
--   stats_members                  — global member/licence/role counts
--   stats_team_roster              — per-team roster size + leadership
--   stats_schreiber_coverage       — per-team schreiber assignment rates
--   stats_games_missing_schreiber  — actionable list of upcoming games needing duties
--   stats_participation            — per-team RSVP rates (last 90 days)
--   stats_game_results             — per-team W/L record by season
--   stats_delegations              — scorer delegation activity per team
--   stats_club_overview            — single-row club dashboard summary
-- ============================================================
