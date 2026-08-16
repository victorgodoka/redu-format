-- Mirrors started_at (migration 011): records when the bracket was actually
-- completed (completeBracket() froze final placings), separate from both
-- starts_at (advertised) and started_at (when staff actually opened it).
-- "Started but not finished" (in-progress) is a real state the public site
-- needs to tell apart from "finished" (results ready) - see isPast() vs the
-- new isFinished() in lib/events.ts.
ALTER TABLE tournaments ADD COLUMN finished_at DATETIME(3) NULL AFTER started_at;
