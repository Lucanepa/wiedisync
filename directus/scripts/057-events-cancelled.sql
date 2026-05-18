-- 057: Manual cancel support for events (mirrors trainings.cancelled / cancel_reason)
ALTER TABLE events ADD COLUMN IF NOT EXISTS cancelled boolean NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cancel_reason text;
