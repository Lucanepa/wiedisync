-- Migration 039: Backfill stuck confirmed/tentative/waitlisted participations
-- that occurred AFTER migration 038's one-shot backfill — typically caused by
-- manual overrides clicked from card-level RSVP UIs that did not gate on
-- `hasAbsence` until v4.4.15. The frontend gates now prevent this from
-- recurring, but existing rows need a one-time cleanup.
--
-- Same logic as 038 part 2; safe to re-run.

BEGIN;

-- Trainings
WITH covered AS (
  SELECT p.id AS pid, a.id AS aid, COALESCE(a.reason, '') AS reason
  FROM participations p
  JOIN trainings t ON p.activity_type = 'training' AND p.activity_id = t.id::text
  JOIN absences a ON a.member = p.member
  WHERE p.status IN ('confirmed', 'tentative', 'waitlisted')
    AND t.cancelled = false
    AND t.date >= a.start_date::date AND t.date <= a.end_date::date
    AND (a.affects::jsonb @> '"all"' OR a.affects::jsonb @> '"trainings"')
    AND (a.type != 'weekly' OR a.days_of_week::jsonb @> to_jsonb((EXTRACT(DOW FROM t.date)::int + 6) % 7))
)
UPDATE participations p
SET status = 'declined',
    note = covered.reason,
    auto_declined_by = covered.aid
FROM covered
WHERE p.id = covered.pid;

-- Games
WITH covered AS (
  SELECT p.id AS pid, a.id AS aid, COALESCE(a.reason, '') AS reason
  FROM participations p
  JOIN games g ON p.activity_type = 'game' AND p.activity_id = g.id::text
  JOIN absences a ON a.member = p.member
  WHERE p.status IN ('confirmed', 'tentative', 'waitlisted')
    AND g.kscw_team IS NOT NULL
    AND COALESCE(g.status, '') NOT IN ('completed', 'postponed', 'cancelled')
    AND g.date >= a.start_date::date AND g.date <= a.end_date::date
    AND (a.affects::jsonb @> '"all"' OR a.affects::jsonb @> '"games"')
    AND (a.type != 'weekly' OR a.days_of_week::jsonb @> to_jsonb((EXTRACT(DOW FROM g.date)::int + 6) % 7))
)
UPDATE participations p
SET status = 'declined',
    note = covered.reason,
    auto_declined_by = covered.aid
FROM covered
WHERE p.id = covered.pid;

-- Events
WITH covered AS (
  SELECT p.id AS pid, a.id AS aid, COALESCE(a.reason, '') AS reason
  FROM participations p
  JOIN events e ON p.activity_type = 'event' AND p.activity_id = e.id::text
  JOIN absences a ON a.member = p.member
  WHERE p.status IN ('confirmed', 'tentative', 'waitlisted')
    AND e.start_date::date >= a.start_date::date AND e.start_date::date <= a.end_date::date
    AND (a.affects::jsonb @> '"all"' OR a.affects::jsonb @> '"events"')
    AND (a.type != 'weekly' OR a.days_of_week::jsonb @> to_jsonb((EXTRACT(DOW FROM e.start_date::date)::int + 6) % 7))
)
UPDATE participations p
SET status = 'declined',
    note = covered.reason,
    auto_declined_by = covered.aid
FROM covered
WHERE p.id = covered.pid;

COMMIT;
