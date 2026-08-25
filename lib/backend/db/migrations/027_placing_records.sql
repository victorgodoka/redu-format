-- The match record behind each placing, frozen alongside it at completion so
-- the leaderboard can sum wins and losses without rebuilding every bracket
-- engine on every page view. NULL means "from before this was recorded" -
-- getLeaderboard() recomputes those once from the stored bracket and writes
-- them back, so the column is only ever null until the next leaderboard read.
ALTER TABLE tournament_placings
  ADD COLUMN wins INT NULL AFTER points,
  ADD COLUMN losses INT NULL AFTER wins,
  ADD COLUMN draws INT NULL AFTER losses;
