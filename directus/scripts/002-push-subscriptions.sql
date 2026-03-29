-- Create push_subscriptions table for web push notifications
-- Run this on the Directus Postgres database if the table doesn't exist yet.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  member INTEGER REFERENCES members(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT DEFAULT '',
  date_created TIMESTAMPTZ DEFAULT NOW(),
  date_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_member ON push_subscriptions(member);
