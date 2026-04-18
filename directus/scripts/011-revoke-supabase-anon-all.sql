-- 011-revoke-supabase-anon-all.sql
--
-- Revoke ALL table privileges from the Supabase anon + authenticated PG roles
-- on every user table and view in the public schema.
--
-- Background: this DB runs the full Supabase stack (Kong on port 8000, PostgREST
-- on 3000, GoTrue, Storage, Studio). Port 8000 is exposed to 0.0.0.0 with no host
-- firewall, so Kong is publicly reachable. The anon and authenticated PG roles
-- are wired to PostgREST; any grants left on them are effectively world-readable
-- once someone obtains the anon JWT (which Supabase publishes by design for its
-- REST API).
--
-- Our project does NOT use Supabase REST/Auth — we use Directus (via its own
-- DB user). So anon + authenticated should have ZERO rights on our tables.
-- The earlier 004-supabase-security-fixes.sql covered a curated list; this one
-- is the belt-and-suspenders, loop-all version so nothing can drift.
--
-- Directus is unaffected because Directus connects as supabase_admin (or the
-- owner role), not as anon/authenticated.
--
-- Idempotent. Run on both prod and dev:
--   ssh hetzner "sudo docker exec -i supabase-db-vek42jyj0owoutoouq29aisq psql -U supabase_admin -d postgres" < directus/scripts/011-revoke-supabase-anon-all.sql
--   ssh hetzner "sudo docker exec -i supabase-db-vek42jyj0owoutoouq29aisq psql -U supabase_admin -d directus_kscw_dev" < directus/scripts/011-revoke-supabase-anon-all.sql

BEGIN;

-- Revoke on every BASE TABLE in public (including directus_* — they shouldn't be
-- exposed to PostgREST either).
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename
      FROM pg_tables
     WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- Revoke on every VIEW in public too (stats_*, members_with_photo, etc.)
DO $$
DECLARE
  v text;
BEGIN
  FOR v IN
    SELECT viewname
      FROM pg_views
     WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', v);
  END LOOP;
END $$;

-- Revoke on sequences too (pk nextval functions) — PostgREST doesn't typically
-- need these, and leaving them open lets a caller advance sequences arbitrarily.
DO $$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT sequence_name
      FROM information_schema.sequences
     WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE %I FROM anon, authenticated', s);
  END LOOP;
END $$;

-- Revoke schema-level USAGE too, so even future tables inherit the lockdown.
REVOKE USAGE ON SCHEMA public FROM anon, authenticated;

-- Revoke default privileges on future objects created in public (belt + suspenders
-- for any future migration that forgets to lock down new tables).
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

COMMIT;
