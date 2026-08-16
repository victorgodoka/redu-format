-- Separate from `points` (that column stays as match points earned within the
-- tournament - 3/1/0 plus top cut bonus, still shown on the per-event results
-- page). ranking_points is what the placement-based leaderboard formula
-- awards (1st = 100, 2nd = 75, ...) - what the global leaderboard sums,
-- instead of summing raw match points like it did before this column existed.
ALTER TABLE tournament_placings ADD COLUMN ranking_points INT NOT NULL DEFAULT 0;
