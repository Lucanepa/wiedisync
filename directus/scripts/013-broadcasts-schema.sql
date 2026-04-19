-- =============================================================================
-- 013-broadcasts-schema.sql
-- KSCW Broadcast Plan 01 — Phase B (Task B1)
--
-- Creates the `broadcasts` audit table that records every broadcast send
-- (sender, audience snapshot, channels, recipient list, message body, and
-- delivery results) per nFADP audit requirements. Permissions for this
-- collection are configured in B11/B12 (Directus admin UI / setup-permissions).
-- Apply to BOTH dev and prod Postgres — idempotent.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS broadcasts (
  id               serial PRIMARY KEY,
  activity_type    varchar(16) NOT NULL CHECK (activity_type IN ('event','game','training')),
  activity_id      integer NOT NULL,
  sender           integer REFERENCES members(id) ON DELETE SET NULL,
  channels_sent    jsonb NOT NULL,
  audience_filter  jsonb NOT NULL,
  recipient_count  integer NOT NULL,
  recipient_ids    jsonb NOT NULL,
  subject          varchar(255),
  message          text NOT NULL,
  delivery_results jsonb,
  sent_at          timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_activity ON broadcasts(activity_type, activity_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcasts_sender   ON broadcasts(sender, sent_at DESC);

COMMIT;
