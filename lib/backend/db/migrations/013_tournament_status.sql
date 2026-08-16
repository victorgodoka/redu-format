-- Explicit lifecycle state, replacing the ad-hoc "infer from started_at/finished_at"
-- checks scattered across the app. This is now the source of truth for what a
-- tournament is doing; started_at/finished_at/cancelled_at stay as "when" metadata.
ALTER TABLE tournaments
  ADD COLUMN status ENUM('scheduled', 'running', 'finished', 'cancelled') NOT NULL DEFAULT 'scheduled' AFTER finished_at,
  ADD COLUMN cancelled_at DATETIME(3) NULL AFTER status;

-- Backfill any tournament that already has started_at/finished_at set (from before
-- this column existed) so status agrees with the timestamps that already happened.
UPDATE tournaments SET status = 'running' WHERE started_at IS NOT NULL AND finished_at IS NULL;
UPDATE tournaments SET status = 'finished' WHERE finished_at IS NOT NULL;
