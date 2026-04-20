-- Migration 023 — KSCW Member policy row filters on messaging collections.
--
-- Bug: the KSCW Member policy had empty row filters ({}) on `messages`,
-- `conversations`, `message_reactions`, and `reports`. That meant any
-- authenticated member could bypass the `/kscw/messaging/*` server layer
-- by calling the raw Directus REST `/items/<collection>` and reading every
-- row in the system (DMs, team chats, report contents).
--
-- This migration replaces the `{}` filters with relational filters scoped
-- to the caller's $CURRENT_USER. Admin policies (admin_access=true) are
-- unaffected — they bypass row filters entirely.
--
-- Policy id for KSCW Member: cf8ee341-dcd2-4dfe-8da8-7960e9943caa
-- (verified via `SELECT id FROM directus_policies WHERE name='KSCW Member'`
-- on prod 2026-04-20).
--
-- Idempotent: uses UPDATE on directus_permissions keyed by (policy, collection, action).

-- conversations: caller must be a conversation_member.
UPDATE directus_permissions
SET permissions = '{"members":{"member":{"user":{"_eq":"$CURRENT_USER"}}}}'::jsonb
WHERE policy = 'cf8ee341-dcd2-4dfe-8da8-7960e9943caa'
  AND collection = 'conversations'
  AND action = 'read';

-- messages: the parent conversation must have the caller as a member.
UPDATE directus_permissions
SET permissions = '{"conversation":{"members":{"member":{"user":{"_eq":"$CURRENT_USER"}}}}}'::jsonb
WHERE policy = 'cf8ee341-dcd2-4dfe-8da8-7960e9943caa'
  AND collection = 'messages'
  AND action = 'read';

-- message_reactions: follow the chain message → conversation → members.
UPDATE directus_permissions
SET permissions = '{"message":{"conversation":{"members":{"member":{"user":{"_eq":"$CURRENT_USER"}}}}}}'::jsonb
WHERE policy = 'cf8ee341-dcd2-4dfe-8da8-7960e9943caa'
  AND collection = 'message_reactions'
  AND action = 'read';

-- reports: caller is either the reporter or the reported member.
-- Admins have their own policy (admin_access=true) and bypass this filter,
-- so they still see all reports in /admin/reports.
UPDATE directus_permissions
SET permissions = '{"_or":[{"reporter":{"user":{"_eq":"$CURRENT_USER"}}},{"reported_member":{"user":{"_eq":"$CURRENT_USER"}}}]}'::jsonb
WHERE policy = 'cf8ee341-dcd2-4dfe-8da8-7960e9943caa'
  AND collection = 'reports'
  AND action = 'read';
