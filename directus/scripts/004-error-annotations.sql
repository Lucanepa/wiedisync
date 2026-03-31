-- Error log annotation storage
-- Stores solved/important status and resolution notes for error log entries.
-- Keyed by MD5 hash of ts|event|error from JSONL log entries.

CREATE TABLE IF NOT EXISTS error_annotations (
  id SERIAL PRIMARY KEY,
  error_hash VARCHAR(32) NOT NULL,
  error_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'solved', 'important')),
  note TEXT,
  resolved_commit VARCHAR(100),
  date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_created UUID REFERENCES directus_users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_error_annotations_hash ON error_annotations(error_hash);
CREATE INDEX IF NOT EXISTS idx_error_annotations_date ON error_annotations(error_date);
CREATE INDEX IF NOT EXISTS idx_error_annotations_status ON error_annotations(status);
