-- Migration 037 — Junction cascade pass 2 (continuing 021).
--
-- Migration 021 fixed `teams_coaches` and `teams_responsibles`. Five other
-- M2M junctions still carry `ON DELETE SET NULL` on their integer FKs:
--   • events_teams       (events_id, teams_id)        — 5 orphan rows on prod
--   • events_members     (events_id, members_id)      — 1 orphan row on prod
--   • hall_events_halls  (hall_events_id, halls_id)
--   • hall_slots_teams   (hall_slots_id, teams_id)
--   • teams_sponsors     (teams_id)                   — sponsors_id has no FK
--
-- Why: per the project's documented gotcha — when Directus deletes a parent
-- row, SET NULL leaves orphan junction rows with NULL FKs. Subsequent reads
-- through `m2m: { junction_field: { _in: [...] } }` filters serialize the
-- NULLs as the literal string `"null"`, which Directus then tries to coerce
-- into an integer column → `Invalid numeric value` → 400. Symptom: random
-- list views go blank after a parent record gets deleted.
--
-- Fix: idempotently rebuild the FK constraints with `ON DELETE CASCADE` and
-- delete the existing orphan rows so the new constraint is satisfiable.
--
-- Apply on dev first.

BEGIN;

-- =============================================================================
-- 1. Delete pre-existing orphan rows.
-- =============================================================================
DELETE FROM events_teams      WHERE events_id IS NULL OR teams_id   IS NULL;
DELETE FROM events_members    WHERE events_id IS NULL OR members_id IS NULL;
DELETE FROM hall_events_halls WHERE hall_events_id IS NULL OR halls_id IS NULL;
DELETE FROM hall_slots_teams  WHERE hall_slots_id  IS NULL OR teams_id IS NULL;
DELETE FROM teams_sponsors    WHERE teams_id IS NULL;

-- =============================================================================
-- 2. events_teams
-- =============================================================================
ALTER TABLE events_teams DROP CONSTRAINT IF EXISTS events_teams_1_events_id_foreign;
ALTER TABLE events_teams DROP CONSTRAINT IF EXISTS events_teams_1_teams_id_foreign;
ALTER TABLE events_teams
  ADD CONSTRAINT events_teams_events_id_foreign FOREIGN KEY (events_id) REFERENCES events(id) ON DELETE CASCADE,
  ADD CONSTRAINT events_teams_teams_id_foreign  FOREIGN KEY (teams_id)  REFERENCES teams(id)  ON DELETE CASCADE;

-- =============================================================================
-- 3. events_members
-- =============================================================================
ALTER TABLE events_members DROP CONSTRAINT IF EXISTS events_members_events_id_foreign;
ALTER TABLE events_members DROP CONSTRAINT IF EXISTS events_members_members_id_foreign;
ALTER TABLE events_members
  ADD CONSTRAINT events_members_events_id_foreign  FOREIGN KEY (events_id)  REFERENCES events(id)  ON DELETE CASCADE,
  ADD CONSTRAINT events_members_members_id_foreign FOREIGN KEY (members_id) REFERENCES members(id) ON DELETE CASCADE;

-- =============================================================================
-- 4. hall_events_halls
-- =============================================================================
ALTER TABLE hall_events_halls DROP CONSTRAINT IF EXISTS hall_events_halls_1_hall_events_id_foreign;
ALTER TABLE hall_events_halls DROP CONSTRAINT IF EXISTS hall_events_halls_1_halls_id_foreign;
ALTER TABLE hall_events_halls
  ADD CONSTRAINT hall_events_halls_hall_events_id_foreign FOREIGN KEY (hall_events_id) REFERENCES hall_events(id) ON DELETE CASCADE,
  ADD CONSTRAINT hall_events_halls_halls_id_foreign       FOREIGN KEY (halls_id)       REFERENCES halls(id)       ON DELETE CASCADE;

-- =============================================================================
-- 5. hall_slots_teams
-- =============================================================================
ALTER TABLE hall_slots_teams DROP CONSTRAINT IF EXISTS hall_slots_teams_hall_slots_id_foreign;
ALTER TABLE hall_slots_teams DROP CONSTRAINT IF EXISTS hall_slots_teams_teams_id_foreign;
ALTER TABLE hall_slots_teams
  ADD CONSTRAINT hall_slots_teams_hall_slots_id_foreign FOREIGN KEY (hall_slots_id) REFERENCES hall_slots(id) ON DELETE CASCADE,
  ADD CONSTRAINT hall_slots_teams_teams_id_foreign      FOREIGN KEY (teams_id)      REFERENCES teams(id)      ON DELETE CASCADE;

-- =============================================================================
-- 6. teams_sponsors (only teams_id has a FK; sponsors_id is unconstrained
--    historically — leaving as-is to keep this migration's scope tight.)
-- =============================================================================
ALTER TABLE teams_sponsors DROP CONSTRAINT IF EXISTS teams_sponsors_1_teams_id_foreign;
ALTER TABLE teams_sponsors
  ADD CONSTRAINT teams_sponsors_teams_id_foreign FOREIGN KEY (teams_id) REFERENCES teams(id) ON DELETE CASCADE;

COMMIT;

-- Sanity check: rerun this and confirm zero rows.
-- SELECT con.conrelid::regclass AS table, con.conname, con.confdeltype FROM pg_constraint con
-- WHERE con.contype='f' AND con.confdeltype='n'
--   AND con.conrelid::regclass::text IN ('events_teams','events_members','hall_events_halls','hall_slots_teams','teams_sponsors');
