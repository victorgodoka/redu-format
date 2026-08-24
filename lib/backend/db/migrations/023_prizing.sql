-- Redeemable prize codes for a tournament, handed out by the "Send prizing"
-- button once the event is over. Codes are entered one at a time while the
-- tournament is scheduled or running and freeze when it finishes.
ALTER TABLE tournaments
  ADD COLUMN has_prizing TINYINT(1) NOT NULL DEFAULT 0 AFTER signup_url,
  ADD COLUMN prizes_sent_at DATETIME(3) NULL AFTER has_prizing;

CREATE TABLE tournament_prizes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  tournament_id CHAR(36) NOT NULL,
  -- Which slice of the final standings the code is for. See lib/prizing.ts for
  -- the place range each tier covers (top_16 is 9th-16th, and so on).
  tier ENUM('winner', 'runner_up', 'top_4', 'top_8', 'top_16', 'top_32', 'participation') NOT NULL,
  code VARCHAR(255) NOT NULL,
  -- The registration the code went to, once it was sent. NULL while unsent, and
  -- also for a leftover code nobody was eligible for.
  registration_id CHAR(36) NULL,
  sent_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  KEY idx_tournament_prizes_tournament (tournament_id, tier),
  CONSTRAINT fk_tournament_prizes_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE,
  CONSTRAINT fk_tournament_prizes_registration FOREIGN KEY (registration_id) REFERENCES registrations (id) ON DELETE SET NULL
) ENGINE=InnoDB;
