-- Migration 029 — expose messaging/consent columns on KSCW Member self-read.
--
-- Bug (v4.0.0 rollout, 2026-04-20): members tap "Accept" on the consent modal,
-- POST /kscw/messaging/settings/consent returns 200 (DB write succeeds), the
-- frontend calls window.location.reload(), but the modal re-appears. Refresh
-- keeps it up forever.
--
-- Cause: `fetchMember()` in src/hooks/useAuth.tsx fetches `/items/members?
-- filter[user][_eq]=<me>` without an explicit `fields=...`. Directus filters
-- the response to the columns listed in the KSCW Member policy's `members.read`
-- permission. The self-scoped row (permissions = $CURRENT_USER filter) has a
-- large field list (birthdate, adresse, ahv_nummer, …) — but it was never
-- updated when the messaging columns were added in Plan 01. Result:
-- `user.consent_decision` is `undefined` on the client, `resolveConsentState()`
-- treats that as `'pending'` with no `consent_prompted_at`, and the modal
-- keeps showing. Same root cause breaks the in-UI messaging settings
-- (DM toggle, team-chat toggle, push preview toggle) — all of which read
-- `user.communications_*` / `user.push_preview_content`.
--
-- Fix: append the 6 messaging/consent columns to the self-scoped
-- `members.read` permission only (no change to the public self-scoped row —
-- other members shouldn't see each other's consent state or push prefs).
--
-- Idempotent (guard on fields NOT LIKE '%consent_decision%'). Apply to prod + dev.
-- After applying, restart the target Directus container so the permissions
-- cache picks it up.

UPDATE directus_permissions
SET fields = fields
  || ',consent_decision'
  || ',consent_prompted_at'
  || ',communications_dm_enabled'
  || ',communications_team_chat_enabled'
  || ',communications_banned'
  || ',push_preview_content'
WHERE collection = 'members'
  AND action = 'read'
  AND permissions IS NOT NULL            -- the self-scoped row ($CURRENT_USER filter)
  AND policy IN (SELECT id FROM directus_policies WHERE name ILIKE '%member%')
  AND fields NOT LIKE '%consent_decision%';
