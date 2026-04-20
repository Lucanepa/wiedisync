-- Migration 025 — drop `status` from the Public (unauthenticated) feedback
-- create whitelist, and scope the Member create to a non-sensitive field list
-- so callers can't pre-set status / resolved_at / ignored fields.
--
-- Bug: the Public policy on `feedback.create` whitelisted `status`, letting
-- an anonymous caller POST with {status: 'resolved'} to suppress complaints
-- the moment they're filed. The Member policy had `fields='*'` — slightly
-- lower risk (authenticated), but the same class of issue.
--
-- Fix: tighten the whitelist in both rows to the intake fields only.
-- (Public policy id: abf8a154-5b1c-4a46-ac9c-7300570f4f17)
-- (Member policy id: cf8ee341-dcd2-4dfe-8da8-7960e9943caa)

UPDATE directus_permissions
SET fields = 'type,title,description,source,source_url,name,email,screenshot'
WHERE policy = 'abf8a154-5b1c-4a46-ac9c-7300570f4f17'
  AND collection = 'feedback'
  AND action = 'create';

UPDATE directus_permissions
SET fields = 'type,title,description,source,source_url,name,email,screenshot'
WHERE policy = 'cf8ee341-dcd2-4dfe-8da8-7960e9943caa'
  AND collection = 'feedback'
  AND action = 'create';
