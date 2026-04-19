-- Plan 01 Phase A — Task A5
-- Drop the legacy mixed_tournament_signups table after verifying all rows
-- migrated into the generic event_signups table (form_slug='mixed_tournament_2026').
-- Pre-condition: A1 (event_signups schema), A2 (data migration), A3 (Directus
-- writers cut over), A4 (kscw-website form repointed) all applied + verified.
-- Idempotent: silently skips if the table doesn't exist.

BEGIN;

DO $$
DECLARE
  old_count int := 0;
  new_count int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='mixed_tournament_signups') THEN
    RAISE NOTICE 'mixed_tournament_signups already dropped, nothing to do';
    RETURN;
  END IF;

  EXECUTE 'SELECT COUNT(*) FROM mixed_tournament_signups' INTO old_count;
  SELECT COUNT(*) INTO new_count FROM event_signups WHERE form_slug='mixed_tournament_2026';

  IF old_count != new_count THEN
    RAISE EXCEPTION 'Aborting drop: row count mismatch (old=%, new=%) — investigate before dropping', old_count, new_count;
  END IF;

  -- Strip Directus metadata first (otherwise admin UI will keep referencing a non-existent table)
  DELETE FROM directus_permissions WHERE collection = 'mixed_tournament_signups';
  DELETE FROM directus_fields      WHERE collection = 'mixed_tournament_signups';
  DELETE FROM directus_relations   WHERE many_collection = 'mixed_tournament_signups' OR one_collection = 'mixed_tournament_signups';
  DELETE FROM directus_collections WHERE collection = 'mixed_tournament_signups';

  EXECUTE 'DROP TABLE mixed_tournament_signups CASCADE';
  RAISE NOTICE 'Dropped mixed_tournament_signups (% rows already mirrored in event_signups)', old_count;
END $$;

COMMIT;
