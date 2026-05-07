-- Migration 044 — Prevent duplicate (member, team) rows in member_teams.
--
-- Same member + same team must always be one row only. The screenshot in
-- the prod admin UI showed Hanna Baumgartner appearing twice on D4
-- volleyball, both rows season=2025/26, guest_level=0 — created by two
-- successive frontend create() calls with no DB-level guard.
--
-- Insertion sites (frontend, all admin/coach paths):
--   • TeamDetail.tsx:193  handleApprove (coach approves pending request)
--   • TeamDetail.tsx:233  handleApproveRequest (team_request approval)
--   • RosterEditor.tsx:103 handleAdd (manual roster add)
-- None pre-check; a double-tap, refetch race, or two coaches both hitting
-- "approve" produces twins.
--
-- Fix:
--   1. Run dedupe-member-teams.mjs (REST script) BEFORE this migration to
--      delete duplicate rows, keeping the lowest-id (preferring highest
--      guest_level on tie). The constraint will reject creation otherwise.
--   2. Add a UNIQUE constraint on (member, team). Season is metadata, not
--      part of the identity — a member moving across seasons reuses the
--      same row. NULLs in member or team are tolerated (Postgres treats
--      NULL as distinct in UNIQUE), but those rows are already nonsense
--      and surface elsewhere.
--
-- Idempotent.

BEGIN;

-- Sanity check: bail loudly if duplicates remain.
DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT member, team
    FROM member_teams
    WHERE member IS NOT NULL AND team IS NOT NULL
    GROUP BY member, team
    HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'member_teams still has % duplicate (member, team) pairs. Run directus/scripts/dedupe-member-teams.mjs <env> --apply first.', dup_count;
  END IF;
END $$;

-- Add the unique constraint (idempotent via DO block).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'member_teams_member_team_unique'
      AND conrelid = 'public.member_teams'::regclass
  ) THEN
    ALTER TABLE public.member_teams
      ADD CONSTRAINT member_teams_member_team_unique UNIQUE (member, team);
  END IF;
END $$;

COMMIT;
