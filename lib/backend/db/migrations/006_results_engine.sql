-- Fase 5: results engine, backed by the tournament-organizer library (pure in-memory
-- Swiss/elimination pairing + standings logic - see lib/backend/services/results.service.ts).
-- Deliberate deviation from the plan's original tournament_rounds/matches/match_players
-- design: the library owns that whole state graph internally and round-trips it as one
-- plain JSON blob (Tournament.getValues() / Manager.loadTournament()), which is exactly
-- how it wants to be persisted between serverless invocations. Building a parallel
-- normalized schema for the same state the library already manages would mean
-- re-deriving logic it already provides, not reusing it.
CREATE TABLE tournament_brackets (
  tournament_id CHAR(36) NOT NULL PRIMARY KEY,
  engine_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tournament_brackets_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Read model for the leaderboard: cross-tournament aggregation needs a SQL-queryable
-- table, not a JS loop parsing every tournament's engine_json blob. Written once per
-- player when a tournament completes (results.service.ts, completeBracket()).
CREATE TABLE tournament_placings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  tournament_id CHAR(36) NOT NULL,
  registration_id CHAR(36) NOT NULL,
  place INT NOT NULL,
  -- Match points (3/1/0, from tournament-organizer's own scoring) plus the fixed top
  -- cut bonus, already summed - nothing today needs the breakdown split out.
  points DECIMAL(6,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tournament_placings_tournament_registration (tournament_id, registration_id),
  KEY idx_tournament_placings_registration (registration_id),
  CONSTRAINT fk_tournament_placings_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE,
  CONSTRAINT fk_tournament_placings_registration FOREIGN KEY (registration_id) REFERENCES registrations (id) ON DELETE CASCADE
) ENGINE=InnoDB;
