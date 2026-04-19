-- =============================================================================
-- 011-event-signups-schema.sql
-- KSCW Broadcast Plan 01 — Phase A (Task A1)
--
-- Creates the generic `event_signups` table for public-facing signup forms.
-- Replaces the single-purpose `mixed_tournament_signups` table; data migration
-- is performed by Task A2, writers are switched in A3, and the old table is
-- dropped in A5. Apply to dev Postgres only (not prod) — idempotent.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS event_signups (
  id            serial PRIMARY KEY,
  event         integer REFERENCES events(id) ON DELETE CASCADE,
  form_slug     varchar(64) NOT NULL,
  name          varchar(255) NOT NULL,
  email         varchar(255) NOT NULL,
  sex           varchar(16),
  language      varchar(16),
  is_member     boolean NOT NULL DEFAULT false,
  member        integer REFERENCES members(id) ON DELETE SET NULL,
  form_data     jsonb,
  consent       jsonb,
  date_created  timestamptz NOT NULL DEFAULT NOW(),
  date_updated  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_event_signups_event       ON event_signups(event);
CREATE INDEX IF NOT EXISTS idx_event_signups_form_slug   ON event_signups(form_slug);
CREATE INDEX IF NOT EXISTS idx_event_signups_email_lower ON event_signups(LOWER(email));

COMMIT;
