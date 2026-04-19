-- =============================================================================
-- 012-migrate-mixed-tournament-to-event-signups.sql
-- KSCW Broadcast Plan 01 — Phase A (Task A2)
--
-- Migrates the 8 rows from `mixed_tournament_signups` into the new generic
-- `event_signups` table created by Task A1 (011-event-signups-schema.sql).
--
-- Mapping:
--   * event       = 5 (Mixed-Turnier 2026)
--   * form_slug   = 'mixed_tournament_2026'
--   * member_id  -> member
--   * teams / position_1 / position_2 / position_3 / notes -> form_data jsonb
--
-- Idempotent: the INSERT only runs when no `event_signups` rows exist yet for
-- form_slug='mixed_tournament_2026'. Re-running the script is a no-op.
--
-- The original `mixed_tournament_signups` table is NOT dropped here — that is
-- Task A5 and requires explicit user approval. Apply to dev Postgres only.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  existing_count integer;
BEGIN
  SELECT COUNT(*) INTO existing_count
  FROM event_signups
  WHERE form_slug = 'mixed_tournament_2026';

  IF existing_count > 0 THEN
    RAISE NOTICE 'Skipping migration: event_signups already has % row(s) for form_slug=mixed_tournament_2026', existing_count;
  ELSE
    INSERT INTO event_signups (event, form_slug, name, email, sex, is_member, member, form_data, date_created)
    SELECT
      5 AS event,                                  -- Mixed-Turnier 2026
      'mixed_tournament_2026' AS form_slug,
      name,
      email,
      sex,
      is_member,
      member_id,
      jsonb_build_object(
        'teams', teams,
        'position_1', position_1,
        'position_2', position_2,
        'position_3', position_3,
        'notes', notes
      ) AS form_data,
      date_created
    FROM mixed_tournament_signups
    ORDER BY id;

    RAISE NOTICE 'Migration complete: % row(s) inserted into event_signups', (SELECT COUNT(*) FROM event_signups WHERE form_slug = 'mixed_tournament_2026');
  END IF;
END $$;

COMMIT;

-- Verify count match (should be 8 = 8 on dev)
SELECT
  (SELECT COUNT(*) FROM mixed_tournament_signups) AS old_count,
  (SELECT COUNT(*) FROM event_signups WHERE form_slug = 'mixed_tournament_2026') AS new_count;
