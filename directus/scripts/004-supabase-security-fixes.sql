-- 004-supabase-security-fixes.sql
--
-- Fixes Supabase security linter warnings:
--   1. SECURITY DEFINER views -> SECURITY INVOKER
--   2. Revoke PostgREST access on Directus system + junction tables
--   3. Fix orphan notify_event_change function search_path
--
-- Run on both prod and dev:
--   ssh hetzner "sudo docker exec -i supabase-db-vek42jyj0owoutoouq29aisq psql -U supabase_admin -d postgres" < directus/scripts/004-supabase-security-fixes.sql
--   ssh hetzner "sudo docker exec -i supabase-db-vek42jyj0owoutoouq29aisq psql -U supabase_admin -d directus_kscw_dev" < directus/scripts/004-supabase-security-fixes.sql

BEGIN;

-- ══════════════════════════════════════════════════════════════════
-- 1. SECURITY DEFINER views -> SECURITY INVOKER
-- ══════════════════════════════════════════════════════════════════
-- Supabase flags views without explicit security_invoker as SECURITY
-- DEFINER, which runs queries as the view owner (typically postgres/
-- directus superuser) instead of the calling role. This bypasses RLS.
-- Fix: set security_invoker = true so views respect the caller's role.

DO $$
DECLARE
  v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'members_with_photo', 'sponsors_with_logo', 'stats_club_overview',
    'stats_delegations', 'stats_game_results', 'stats_games_missing_schreiber',
    'stats_members', 'stats_participation', 'stats_schreiber_coverage'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = v) THEN
      EXECUTE format('ALTER VIEW %I SET (security_invoker = true)', v);
    END IF;
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════
-- 2. Revoke PostgREST access on Directus system + junction tables
-- ══════════════════════════════════════════════════════════════════
-- Directus tables sit in the public schema which Supabase exposes via
-- PostgREST. Block access from anon and authenticated roles so these
-- internal tables are not queryable through the Supabase REST API.

-- Directus system tables
REVOKE ALL ON directus_extensions FROM anon, authenticated;
REVOKE ALL ON directus_fields FROM anon, authenticated;
REVOKE ALL ON directus_migrations FROM anon, authenticated;
REVOKE ALL ON directus_relations FROM anon, authenticated;
REVOKE ALL ON directus_translations FROM anon, authenticated;
REVOKE ALL ON directus_policies FROM anon, authenticated;
REVOKE ALL ON directus_access FROM anon, authenticated;
REVOKE ALL ON directus_roles FROM anon, authenticated;
REVOKE ALL ON directus_users FROM anon, authenticated;
REVOKE ALL ON directus_collections FROM anon, authenticated;
REVOKE ALL ON directus_comments FROM anon, authenticated;
REVOKE ALL ON directus_dashboards FROM anon, authenticated;
REVOKE ALL ON directus_deployments FROM anon, authenticated;
REVOKE ALL ON directus_deployment_projects FROM anon, authenticated;
REVOKE ALL ON directus_deployment_runs FROM anon, authenticated;
REVOKE ALL ON directus_folders FROM anon, authenticated;
REVOKE ALL ON directus_files FROM anon, authenticated;
REVOKE ALL ON directus_flows FROM anon, authenticated;
REVOKE ALL ON directus_notifications FROM anon, authenticated;
REVOKE ALL ON directus_operations FROM anon, authenticated;
REVOKE ALL ON directus_panels FROM anon, authenticated;
REVOKE ALL ON directus_permissions FROM anon, authenticated;
REVOKE ALL ON directus_presets FROM anon, authenticated;
REVOKE ALL ON directus_activity FROM anon, authenticated;
REVOKE ALL ON directus_revisions FROM anon, authenticated;
REVOKE ALL ON directus_versions FROM anon, authenticated;
REVOKE ALL ON directus_shares FROM anon, authenticated;
REVOKE ALL ON directus_sessions FROM anon, authenticated;
REVOKE ALL ON directus_settings FROM anon, authenticated;

-- Junction tables (internal M2M, not for public access)
-- Names differ between prod and dev, so use IF EXISTS pattern
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'teams_coaches', 'teams_coach',
    'teams_responsibles', 'teams_team_responsible',
    'teams_captains', 'teams_captain',
    'events_teams', 'events_teams_1',
    'hall_events_halls', 'hall_events_halls_1',
    'teams_sponsors', 'teams_sponsors_1',
    -- Domain tables: block direct PostgREST access (all access must go through Directus)
    'members', 'member_teams', 'games', 'trainings', 'events',
    'hall_slots', 'hall_events', 'halls', 'hall_closures',
    'participations', 'notifications', 'scorer_delegations',
    'rankings', 'sponsors', 'absences', 'news',
    'push_subscriptions', 'email_verifications', 'error_annotations',
    'app_settings', 'feedback', 'user_logs',
    'newsletter_subscribers', 'scheduling_slots', 'scheduling_bookings'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════
-- 3. Fix orphan notify_event_change function search_path
-- ══════════════════════════════════════════════════════════════════
-- This function may have been auto-created by Directus or left over
-- from a previous migration. Fix its search_path if it exists.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'notify_event_change') THEN
    ALTER FUNCTION notify_event_change() SET search_path = public;
  END IF;
END $$;

COMMIT;
