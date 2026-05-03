-- Migration 038: Absence hard-override of existing confirmed/tentative RSVPs
--
-- Background. Until now `autoDeclineForAbsence` (kscw-hooks) skipped any
-- activity where the member already had a participation row, so a member who
-- had RSVP'd ✓ to a Monday training and then created a weekly Monday
-- unavailability still showed as confirmed (green strip on the card). The
-- roster modal showed "Declined (Absence)" because it overlays absences on
-- top of participations — so the two views disagreed.
--
-- Policy decision (2026-05-03): an absence hard-overrides the underlying
-- RSVP. The user updated the hook to UPDATE existing rows on absence
-- create/update; this migration:
--   (1) reshapes the BEFORE UPDATE trigger so the hook can set
--       `status = 'declined'` AND `auto_declined_by = N` in the same UPDATE
--       without the trigger nulling the marker (mirrors the trainings
--       `auto_cancelled_by_closure` trigger pattern);
--   (2) backfills currently-conflicting rows so existing data lines up with
--       the new policy.
--
-- Manual-override semantics are preserved: a user UPDATE that changes
-- `status` while leaving `auto_declined_by` untouched still detaches the row
-- (the marker → NULL), exactly as before.

BEGIN;

-- ── (1) Trigger reshape ──────────────────────────────────────────────────
-- Old behaviour: clear marker on any status change.
-- New behaviour: clear marker only when status changed AND the marker was
-- not changed by the same statement (i.e. a user edit, not a hook write).
CREATE OR REPLACE FUNCTION trg_participations_clear_auto_marker()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.auto_declined_by IS NOT DISTINCT FROM OLD.auto_declined_by THEN
    NEW.auto_declined_by := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger itself stays bound to BEFORE UPDATE, no change needed.

-- ── (2) Backfill ─────────────────────────────────────────────────────────
-- For each absence, find every confirmed / tentative / waitlisted
-- participation it covers (date range + day-of-week for weekly + affects
-- bitmap) and flip it to declined, attaching `auto_declined_by`.
--
-- Conversion rule (matches autoDeclineForAbsence): our days_of_week stores
-- Mon=0..Sun=6 while Postgres EXTRACT(DOW) yields Sun=0..Sat=6 — bridge with
-- (pg_dow + 6) % 7.

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
