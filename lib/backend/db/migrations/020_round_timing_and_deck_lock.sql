-- Two duration modes, plus the deck lock the DQ check is measured against.

-- Standard/same-day is the default, so every existing tournament keeps the
-- behaviour it was created under without a backfill. round_minutes is the
-- same-day round timer (50 by default); cleanup_minutes is the moderator
-- grace period between a round locking and the next one starting on its own.
-- Long-duration tournaments ignore both and use round_limit_days, and never
-- auto-generate a round at all.
ALTER TABLE tournaments
  ADD COLUMN duration_mode ENUM('same_day', 'long') NOT NULL DEFAULT 'same_day' AFTER round_limit_days,
  ADD COLUMN round_minutes INT NOT NULL DEFAULT 50 AFTER duration_mode,
  ADD COLUMN cleanup_minutes INT NOT NULL DEFAULT 10 AFTER round_minutes;

-- The deck as it stood when the bracket started - the only list that is valid
-- for this tournament from that moment on. Deliberately separate from
-- deck_snapshot (taken at signup, which players are free to change right up
-- until the start): a deck edited before the start is not a violation.
ALTER TABLE registrations
  ADD COLUMN deck_locked_snapshot JSON NULL AFTER deck_snapshot,
  -- Throttle for the on-visit check; the check itself always re-reads this
  -- table and Dueling Nexus, never anything the browser sent.
  ADD COLUMN deck_checked_at DATETIME(3) NULL AFTER deck_locked_snapshot,
  ADD COLUMN disqualified_at DATETIME(3) NULL AFTER dropped_at,
  ADD COLUMN dq_reason VARCHAR(255) NULL AFTER disqualified_at;
