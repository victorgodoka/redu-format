-- Fase 5.1: round deadlines + player self-report.
--
-- "Time limit (minutes)" never meant a per-duel clock in practice - players
-- coordinate and duel at their own pace, so what actually needs a clock is
-- the round itself: how long it stays open before it's force-closed. Renamed
-- and repurposed as a day count (default 2) rather than adding a second field,
-- since nothing ever read the old minutes value as a real per-duel timer.
-- Existing rows are reset to the new default; their old minute values have no
-- meaning as days.
ALTER TABLE tournaments CHANGE COLUMN time_limit_minutes round_limit_days INT NOT NULL DEFAULT 2;
UPDATE tournaments SET round_limit_days = 2;

-- Players self-report their own match result; a match resolves once both
-- sides agree (see results.service.ts submitMatchReport). Rows for a match
-- are cleared the moment it resolves - through agreement, an admin override,
-- or the round-deadline job - so "2 rows still here" is exactly what
-- distinguishes a disputed match (both reported, but disagree) from a
-- normal one still waiting on either or both sides.
CREATE TABLE match_reports (
  tournament_id CHAR(36) NOT NULL,
  match_id CHAR(36) NOT NULL,
  registration_id CHAR(36) NOT NULL,
  result ENUM('win', 'loss', 'draw') NOT NULL,
  reported_at DATETIME(3) NOT NULL,
  PRIMARY KEY (match_id, registration_id),
  KEY idx_match_reports_tournament (tournament_id),
  CONSTRAINT fk_match_reports_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE,
  CONSTRAINT fk_match_reports_registration FOREIGN KEY (registration_id) REFERENCES registrations (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- When each currently-open match went active, so the round-deadline job knows
-- what's overdue. tournament-organizer's engine_json has no notion of "when",
-- and doesn't need one for pairing/scoring - this is purely our own clock
-- bolted on the side. One row per match ever activated; rows for long-resolved
-- matches are harmless leftovers, never queried again.
CREATE TABLE match_deadlines (
  tournament_id CHAR(36) NOT NULL,
  match_id CHAR(36) NOT NULL PRIMARY KEY,
  active_since DATETIME(3) NOT NULL,
  KEY idx_match_deadlines_tournament (tournament_id),
  CONSTRAINT fk_match_deadlines_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE
) ENGINE=InnoDB;
