-- Tracks when a tournament actually started (the bracket was created), separate
-- from starts_at (the originally advertised time) - staff can start a bracket
-- early, and the public site needs to stop calling it "upcoming" the moment
-- that happens rather than waiting for the advertised clock time to pass.
ALTER TABLE tournaments ADD COLUMN started_at DATETIME(3) NULL AFTER starts_at;
