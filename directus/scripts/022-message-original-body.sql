-- Messaging: keep the ORIGINAL body of an edited message so readers can inspect
-- it via a popover on the "edited" tag. Snapshot is captured by the PATCH
-- /messaging/messages/:id endpoint on first edit; subsequent edits leave it
-- alone so this column always reflects the original (not the last) version.
-- Idempotent.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS original_body text NULL;
