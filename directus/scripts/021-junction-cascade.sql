-- Migration 021 — teams_coaches + teams_responsibles: ON DELETE SET NULL → CASCADE
--
-- Context: 2026-04-20. /games page crashed with 400 "Invalid numeric value." on prod.
-- Root cause: 13 orphan junction rows (7 teams_coaches + 6 teams_responsibles) had
-- teams_id = NULL because the FK was declared ON DELETE SET NULL. When those rows
-- came back from the members→coaches query, `String(null)` → "null" leaked into
-- the frontend's `kscw_team: { _in: [...] }` filter. Directus 11.17 castToNumber
-- throws on any non-numeric element of an _in for an integer column.
--
-- Fix:
--   1. Delete orphan rows (no team = no business meaning)
--   2. Change both FKs (teams_id + members_id) on both junctions to ON DELETE CASCADE
--      so deleting a team or member removes the junction row outright instead of
--      leaving a null-partitioned tombstone
--
-- Also update directus_relations.one_deselect_action to 'delete' so the admin UI
-- stays consistent with the schema behavior. And rename the constraints off the
-- `teams_members_3/4_*` names inherited from Directus' auto-generated junction
-- table names (renamed on 2026-04-05).
--
-- Applied to prod (postgres) + dev (directus_kscw_dev) on 2026-04-20.

BEGIN;

DELETE FROM teams_coaches WHERE teams_id IS NULL;
DELETE FROM teams_responsibles WHERE teams_id IS NULL;

ALTER TABLE teams_coaches DROP CONSTRAINT teams_members_3_teams_id_foreign;
ALTER TABLE teams_coaches DROP CONSTRAINT teams_members_3_members_id_foreign;
ALTER TABLE teams_coaches ADD CONSTRAINT teams_coaches_teams_id_foreign   FOREIGN KEY (teams_id)   REFERENCES teams(id)   ON DELETE CASCADE;
ALTER TABLE teams_coaches ADD CONSTRAINT teams_coaches_members_id_foreign FOREIGN KEY (members_id) REFERENCES members(id) ON DELETE CASCADE;

ALTER TABLE teams_responsibles DROP CONSTRAINT teams_members_4_teams_id_foreign;
ALTER TABLE teams_responsibles DROP CONSTRAINT teams_members_4_members_id_foreign;
ALTER TABLE teams_responsibles ADD CONSTRAINT teams_responsibles_teams_id_foreign   FOREIGN KEY (teams_id)   REFERENCES teams(id)   ON DELETE CASCADE;
ALTER TABLE teams_responsibles ADD CONSTRAINT teams_responsibles_members_id_foreign FOREIGN KEY (members_id) REFERENCES members(id) ON DELETE CASCADE;

UPDATE directus_relations
   SET one_deselect_action = 'delete'
 WHERE many_collection IN ('teams_coaches', 'teams_responsibles')
   AND one_deselect_action = 'nullify';

COMMIT;
