-- Fase 3: public registrations move off the session cookie and into the same
-- `registrations` table admin-manual participants already use.

CREATE TABLE players (
  id CHAR(36) NOT NULL PRIMARY KEY,
  -- sha256(token) hex digest. Fallback identity per docs/backend-structure.md
  -- seção 14: the real Nexus API has no stable id field, confirmed by testing
  -- it directly (only success/name/contributor/avatar/ranking/deck). Login and
  -- register/save reconcile onto an existing player by nexus_name when the key
  -- doesn't match, to survive a token regeneration without silently forking
  -- the player's history - see lib/backend/services/player.service.ts.
  nexus_identity_key CHAR(64) NOT NULL,
  nexus_name VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(2048) NULL,
  contributor TINYINT(1) NOT NULL DEFAULT 0,
  contributor_time BIGINT NULL,
  last_seen_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_players_identity_key (nexus_identity_key),
  KEY idx_players_name (nexus_name)
) ENGINE=InnoDB;

-- Not FK'd to tournaments: a save can target the static FEATURED_EVENT or an
-- entry from lib/events.ts's pastEvents, neither of which is a database row
-- (see app/events/saved-actions.ts's isKnownTournament). Slug is the only
-- identifier that exists across static and persisted tournaments alike.
CREATE TABLE saved_tournaments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  player_id CHAR(36) NOT NULL,
  tournament_slug VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_saved_tournaments_player_slug (player_id, tournament_slug),
  CONSTRAINT fk_saved_tournaments_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE registrations
  ADD COLUMN player_id CHAR(36) NULL AFTER tournament_id,
  ADD COLUMN source ENUM('public_signup', 'admin_manual') NOT NULL DEFAULT 'admin_manual' AFTER player_id,
  ADD COLUMN deck_id VARCHAR(64) NULL AFTER deck_name,
  MODIFY COLUMN payment_status ENUM('pending', 'confirmed', 'contested', 'not_required') NOT NULL DEFAULT 'pending',
  ADD CONSTRAINT fk_registrations_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE SET NULL,
  ADD UNIQUE KEY uq_registrations_tournament_player (tournament_id, player_id);

-- `taken` was an admin-editable count, decoupled from real registrations (Fase 1
-- deliberately kept it that way - see docs/backend-structure.md seção 5). Now that
-- real registrations exist, it becomes a derived COUNT(*) instead - see
-- lib/backend/repositories/tournaments.repository.ts. A stored, no-longer-read
-- column is a worse trap for a future reader than a migration to drop it.
ALTER TABLE tournaments DROP COLUMN taken;
