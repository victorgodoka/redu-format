-- Reporting rework: one report settles a match, no draws, and a no-show flow.

-- A report now carries the series score and settles the match on its own, so
-- the row is a record of who called it (and with what), not a pending vote
-- waiting for the other side. Kept after the match resolves - the opponent
-- needs to see who reported what in order to contest it.
ALTER TABLE match_reports
  ADD COLUMN winner_games TINYINT NOT NULL DEFAULT 1 AFTER result,
  ADD COLUMN loser_games TINYINT NOT NULL DEFAULT 0 AFTER winner_games;

-- No-show calls and contested results, one open flag of each kind per match.
-- `auto_resolves_at` is only set for a same-day tournament, where an unanswered
-- no-show becomes a loss on its own; a long-duration one waits for a moderator
-- however long that takes.
CREATE TABLE match_flags (
  match_id CHAR(36) NOT NULL,
  kind ENUM('no_show', 'contest') NOT NULL,
  tournament_id CHAR(36) NOT NULL,
  reporter_registration_id CHAR(36) NOT NULL,
  -- The accused, for a no-show. NULL for a contest, which is about the result
  -- on file rather than about a person.
  target_registration_id CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL,
  auto_resolves_at DATETIME(3) NULL,
  -- Either player in the duel, or a moderator, can call it off.
  dismissed_at DATETIME(3) NULL,
  dismissed_by VARCHAR(255) NULL,
  -- Set when the flag actually decided something (the auto-loss fired, or a
  -- moderator ruled on it) - that is what counts toward the two-strike DQ.
  resolved_at DATETIME(3) NULL,
  PRIMARY KEY (match_id, kind),
  KEY idx_match_flags_tournament (tournament_id, kind),
  CONSTRAINT fk_match_flags_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- No-shows that stuck. Two of them is a disqualification, and this is separate
-- from consecutive_absences (which is about missing a round deadline entirely).
ALTER TABLE registrations ADD COLUMN no_show_count INT NOT NULL DEFAULT 0 AFTER consecutive_absences;
