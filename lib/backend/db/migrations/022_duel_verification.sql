-- Automatic duel-result verification against Dueling Nexus replays, plus the
-- disconnect/redo flow. See lib/backend/services/duel-verification.service.ts
-- and lib/backend/services/redo.service.ts for the pipeline this backs.

-- The Nexus internal player id (TokenResponse.user_id) - the canonical id for
-- matching replay players, unlike nexus_identity_key (sha256 of the token,
-- which survives a token regen but says nothing about Nexus's own id space).
-- Nullable: only populated once a player logs in/refreshes after this ships.
ALTER TABLE players
  ADD COLUMN nexus_user_id VARCHAR(64) NULL AFTER nexus_identity_key,
  ADD KEY idx_players_nexus_user_id (nexus_user_id);

-- The shared cross-page/cross-client cache-and-lock for get-info.php calls:
-- one row per polled scope (one tournament), holding when it was last
-- fetched. Claiming a fetch is one atomic statement (see
-- nexus-fetch-log.repository.ts) - INSERT..ON DUPLICATE KEY UPDATE's affected-
-- rows count (0 = row existed and was left alone, 1/2 = we just claimed it)
-- is what makes two concurrent callers never both call Nexus.
CREATE TABLE nexus_fetch_log (
  scope_key VARCHAR(191) NOT NULL PRIMARY KEY,
  fetched_at DATETIME(3) NOT NULL
) ENGINE=InnoDB;

-- Every Nexus replay this app has looked at, keyed by its own id so a replay
-- is only ever fetched (get-replay-info.php) once. Populated in two steps:
-- get-info.php gives the summary columns first (id/game_name/players), then
-- get-replay-info.php fills in the result columns once a replay actually
-- matters (its game_name matches an active duel) - a replay nobody cares
-- about is never detail-fetched at all.
CREATE TABLE nexus_replay_cache (
  replay_id VARCHAR(64) NOT NULL PRIMARY KEY,
  game_name VARCHAR(191) NOT NULL,
  player_1_id VARCHAR(64) NULL,
  player_2_id VARCHAR(64) NULL,
  player_1_name VARCHAR(255) NULL,
  player_2_name VARCHAR(255) NULL,
  is_tag TINYINT(1) NOT NULL DEFAULT 0,
  -- NULL until get-replay-info.php has actually been called for this row.
  winning_team TINYINT NULL,
  win_reason INT NULL,
  main_decks JSON NULL,
  extra_decks JSON NULL,
  end_date DATETIME(3) NULL,
  fetched_at DATETIME(3) NOT NULL,
  details_fetched_at DATETIME(3) NULL,
  KEY idx_nexus_replay_cache_game_name (game_name)
) ENGINE=InnoDB;

-- One row per game within a tournament match (position 1..3 in a Bo3, always
-- 1 in a Bo1) - the "Duel Slot" from the spec. current_room_hash is which
-- Nexus room this slot's next attempt is searched for in: normally the
-- match's own room_hash (match_deadlines), but a redo can move it to a fresh
-- one - see redo.service.ts.
CREATE TABLE duel_slots (
  id CHAR(36) NOT NULL PRIMARY KEY,
  tournament_id CHAR(36) NOT NULL,
  match_id VARCHAR(64) NOT NULL,
  position TINYINT NOT NULL,
  current_room_hash VARCHAR(16) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY uq_duel_slots_match_position (match_id, position),
  KEY idx_duel_slots_tournament (tournament_id)
) ENGINE=InnoDB;

-- One row per attempt at a duel slot - the original, plus one more per
-- mutually-agreed redo. `counts` decides whether it contributes to the
-- Bo1/Bo3 score; a superseded or not-yet-decided (pending redo window)
-- attempt is 0. dq_registration_ids is set when the wrong player(s) showed up
-- in the lobby or a deck mismatch was found on this attempt - the match-level
-- DQ itself is applied through the existing disqualifyRegistration(), never
-- invented here.
CREATE TABLE duel_attempts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  duel_slot_id CHAR(36) NOT NULL,
  attempt_number TINYINT NOT NULL,
  room_hash VARCHAR(16) NOT NULL,
  status ENUM('active', 'completed', 'superseded') NOT NULL DEFAULT 'active',
  replay_id VARCHAR(64) NULL,
  -- registration_id of the side the replay's winningTeam maps to, once known.
  winner_registration_id CHAR(36) NULL,
  win_reason INT NULL,
  counts TINYINT(1) NOT NULL DEFAULT 0,
  dq_registration_ids JSON NULL,
  created_at DATETIME(3) NOT NULL,
  resolved_at DATETIME(3) NULL,
  UNIQUE KEY uq_duel_attempts_slot_number (duel_slot_id, attempt_number),
  UNIQUE KEY uq_duel_attempts_replay (replay_id),
  KEY idx_duel_attempts_room_hash (room_hash),
  CONSTRAINT fk_duel_attempts_slot FOREIGN KEY (duel_slot_id) REFERENCES duel_slots (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- A disconnect's redo request/consent flow. UNIQUE on duel_attempt_id: an
-- attempt gets at most one redo request ever (it's already terminal - a fresh
-- disconnect from a replacement attempt gets its own new attempt row, and
-- therefore its own request row), which is what makes "only one pending
-- request per slot" and "can't request again after reject/expire" automatic
-- rather than something every caller has to check by hand.
CREATE TABLE redo_requests (
  id CHAR(36) NOT NULL PRIMARY KEY,
  duel_attempt_id CHAR(36) NOT NULL,
  requester_registration_id CHAR(36) NOT NULL,
  player_a_registration_id CHAR(36) NOT NULL,
  player_b_registration_id CHAR(36) NOT NULL,
  player_a_consent TINYINT(1) NOT NULL DEFAULT 0,
  player_b_consent TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('pending', 'accepted', 'rejected', 'expired') NOT NULL DEFAULT 'pending',
  created_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  resolved_at DATETIME(3) NULL,
  -- The fresh lobby the accept produced (see redo.service.ts) - audit trail
  -- only, since the live pointer duel-verification.service.ts actually reads
  -- is duel_slots.current_room_hash.
  replacement_room_hash VARCHAR(16) NULL,
  UNIQUE KEY uq_redo_requests_attempt (duel_attempt_id),
  CONSTRAINT fk_redo_requests_attempt FOREIGN KEY (duel_attempt_id) REFERENCES duel_attempts (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- History of every deck snapshot taken for a registration: one at signup
-- (already captured in registrations.deck_snapshot, mirrored here too for a
-- single audit trail) and one at the start of every round from then on.
-- registrations.deck_locked_snapshot keeps being the *current* one that
-- validation actually reads (cheap, no join) - this table exists purely so
-- the history the spec asks for ("both snapshots remain available") is never
-- overwritten the way deck_locked_snapshot itself deliberately is.
CREATE TABLE deck_snapshots (
  id CHAR(36) NOT NULL PRIMARY KEY,
  registration_id CHAR(36) NOT NULL,
  kind ENUM('signup', 'round_start') NOT NULL,
  round_number INT NULL,
  snapshot JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  KEY idx_deck_snapshots_registration (registration_id, created_at),
  CONSTRAINT fk_deck_snapshots_registration FOREIGN KEY (registration_id) REFERENCES registrations (id) ON DELETE CASCADE
) ENGINE=InnoDB;
