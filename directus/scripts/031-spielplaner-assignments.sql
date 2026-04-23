-- Migration 031: spielplaner_assignments collection + svrz_push_status field on games
-- Idempotent: safe to run twice on the same database.
-- Apply on dev: ssh hetzner "sudo docker exec -i supabase-db-vek42jyj0owoutoouq29aisq psql -U supabase_admin -d directus_kscw_dev" < directus/scripts/031-spielplaner-assignments.sql
-- Apply on prod: ssh hetzner "sudo docker exec -i supabase-db-vek42jyj0owoutoouq29aisq psql -U supabase_admin -d postgres" < directus/scripts/031-spielplaner-assignments.sql

BEGIN;

-- ============================================================================
-- 1. spielplaner_assignments table
--    Standalone collection (not an M2M relation on members).
--    Scoped Spielplaners: rows here grant per-team manage access.
--    Club-wide Spielplaners still use the existing members.is_spielplaner flag.
-- ============================================================================
CREATE TABLE IF NOT EXISTS spielplaner_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member        integer NOT NULL REFERENCES members(id)        ON DELETE CASCADE,
  kscw_team     integer NOT NULL REFERENCES teams(id)          ON DELETE CASCADE,
  date_created  timestamptz NOT NULL DEFAULT NOW(),
  user_created  uuid REFERENCES directus_users(id)             ON DELETE SET NULL,
  CONSTRAINT uq_spielplaner_assignments_member_team UNIQUE (member, kscw_team)
);

CREATE INDEX IF NOT EXISTS idx_spielplaner_assignments_member    ON spielplaner_assignments(member);
CREATE INDEX IF NOT EXISTS idx_spielplaner_assignments_kscw_team ON spielplaner_assignments(kscw_team);

-- Gotcha: when the collection is later registered via Directus admin UI,
-- Directus silently recreates member/kscw_team without NOT NULL / FK / UNIQUE.
-- Re-assert them idempotently so re-runs repair the table after registration.
ALTER TABLE spielplaner_assignments ALTER COLUMN member    SET NOT NULL;
ALTER TABLE spielplaner_assignments ALTER COLUMN kscw_team SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE spielplaner_assignments
    ADD CONSTRAINT spielplaner_assignments_member_fkey
    FOREIGN KEY (member) REFERENCES members(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE spielplaner_assignments
    ADD CONSTRAINT spielplaner_assignments_kscw_team_fkey
    FOREIGN KEY (kscw_team) REFERENCES teams(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE spielplaner_assignments
    ADD CONSTRAINT uq_spielplaner_assignments_member_team UNIQUE (member, kscw_team);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2. games.svrz_push_status column (Phase 2 reserved field, nullable today)
--    Reserved for a future SVRZ Volleymanager write-back flow. Phase 1 leaves
--    it null on every row; migrating now avoids a second migration later.
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE svrz_push_status_enum AS ENUM ('pending', 'pushed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS svrz_push_status svrz_push_status_enum;

COMMIT;
