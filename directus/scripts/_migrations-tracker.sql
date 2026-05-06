-- Migration tracker — records which numbered migrations have been applied.
-- Bootstrap step: applied automatically by `apply-migrations.mjs` before
-- any other migration runs. Idempotent.
--
-- Schema:
--   filename    text PRIMARY KEY  -- e.g. '001-postgres-triggers.sql'
--   sha256      text NOT NULL     -- digest of the file content at apply time
--   applied_at  timestamptz       -- when it ran
--   applied_by  text              -- $USER (or $SUDO_USER) on the host that ran it
--
-- A re-application is rejected if `sha256` differs (someone modified an
-- already-applied migration). To intentionally re-apply, manually
--   DELETE FROM kscw_migrations WHERE filename = 'NNN-name.sql';
-- before running again.

CREATE TABLE IF NOT EXISTS kscw_migrations (
  filename    text PRIMARY KEY,
  sha256      text NOT NULL,
  applied_at  timestamptz NOT NULL DEFAULT now(),
  applied_by  text NOT NULL DEFAULT current_user
);

-- Backfill: mark all existing 0NN-*.sql as applied with sha 'unknown' so
-- we don't try to re-run them on environments that have already been
-- patched manually. The runner detects 'unknown' shas and skips strict
-- comparison (treats them as historical).
INSERT INTO kscw_migrations (filename, sha256, applied_by)
SELECT fname, 'unknown', 'backfill'
FROM (VALUES
  ('001-postgres-triggers.sql'),
  ('002-push-subscriptions.sql'),
  ('003-cascade-delete-protection.sql'),
  ('003-stat-views.sql'),
  ('004-error-annotations.sql'),
  ('004-supabase-security-fixes.sql'),
  ('005-add-announcements.mjs'),
  ('005-security-constraints.sql'),
  ('006-bugfix-jobs.sql'),
  ('007-messaging-schema.sql'),
  ('008-messaging-triggers.sql'),
  ('009-messaging-dm-autoaccept.sql'),
  ('009-messaging-permissions.mjs'),
  ('010-messaging-last-export.sql'),
  ('011-event-signups-schema.sql'),
  ('011-revoke-supabase-anon-all.sql'),
  ('012-migrate-mixed-tournament-to-event-signups.sql'),
  ('013-broadcasts-schema.sql'),
  ('014-drop-mixed-tournament-signups.sql'),
  ('015-conversations-activity-chat.sql'),
  ('016-participations-activity-chat-sync.sql'),
  ('017-activity-chat-cleanup-triggers.sql'),
  ('018-conversations-group-dm.sql'),
  ('019-events-junctions-permissions.sql'),
  ('020-coach-policy-parity.sql'),
  ('021-junction-cascade.sql'),
  ('022-message-original-body.sql'),
  ('023-messaging-rbac-row-filters.sql'),
  ('024-members-pii-scoping.sql'),
  ('025-feedback-status-lock.sql'),
  ('026-coach-team-scoping.sql'),
  ('027-sport-admin-delete-restrictions.sql'),
  ('028-auto-action-markers.sql'),
  ('029-member-messaging-self-read.sql'),
  ('030-member-read-field-gaps.sql'),
  ('031-spielplaner-assignments.sql'),
  ('032-trainings-team-scoping.sql'),
  ('033-member-read-team-scoping.sql'),
  ('034-spielplaner-assignments-read-perm.sql'),
  ('035-permissions-audit-pass-2.sql'),
  ('036-permissions-audit-pass-3.sql'),
  ('037-junction-cascade-pass-2.sql'),
  ('038-absence-override-existing-participations.sql'),
  ('039-absence-override-backfill-pass-2.sql'),
  ('040-trainings-excluded-guest-levels.sql'),
  ('041-team-dashboard-prefs.sql'),
  ('042-blocks-and-spielplaner-perms.sql')
) AS v(fname)
ON CONFLICT (filename) DO NOTHING;
