-- 006-bugfix-jobs.sql
-- Tracks AI-powered bugfix workflow state

CREATE TABLE IF NOT EXISTS bugfix_jobs (
  id SERIAL PRIMARY KEY,
  error_hash TEXT NOT NULL,
  repo TEXT NOT NULL DEFAULT 'wiedisync',
  error_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'fixing'
    CHECK (status IN ('fixing', 'pr_ready', 'deployed_dev', 'deployed_prod', 'failed', 'reverted', 'dismissed')),
  pr_number INTEGER,
  pr_url TEXT,
  pr_branch TEXT,
  merge_sha TEXT,
  fix_summary TEXT,
  public_summary TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  triggered_by UUID,
  date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bugfix_jobs_hash ON bugfix_jobs(error_hash);
CREATE INDEX IF NOT EXISTS idx_bugfix_jobs_status ON bugfix_jobs(status);
