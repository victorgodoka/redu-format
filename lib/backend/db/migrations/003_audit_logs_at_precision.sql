-- Second-precision `at` let two entries recorded in the same second tie, falling back to
-- ordering by a random UUID id instead of insertion order. Same fix already applied to
-- rate_limits.reset_at: millisecond precision, always written from JS (see lib/backend/db/datetime.ts).
ALTER TABLE audit_logs MODIFY COLUMN at DATETIME(3) NOT NULL;
