-- Async alerts for admins and players, plus the deck snapshot they are built from.

-- The card lists Dueling Nexus returned when the deck was registered and passed
-- validation. deck_id alone can't detect tampering: Nexus keeps the same UUID
-- when a deck is edited in place, which is exactly the case this feature exists
-- to catch. NULL for admin-manual entries and for rows registered before this
-- column existed - both are skipped by the drift check rather than guessed at.
ALTER TABLE registrations ADD COLUMN deck_snapshot JSON NULL AFTER deck_id;

CREATE TABLE notifications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  audience ENUM('admin', 'player') NOT NULL,
  -- NULL means global for that audience: every admin, or every player. An
  -- individual alert names its recipient here. Admin alerts are always global
  -- today (there is no per-admin routing), players always individual.
  player_id CHAR(36) NULL,
  kind VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  metadata JSON NULL,
  -- Dedupe key. The drift check re-runs on every round and every login, so the
  -- same unchanged mismatch would otherwise be re-announced each time. Derived
  -- from audience + recipient + deck + the offending deck state, so a *further*
  -- edit is a new alert while a repeat scan of the same edit is a no-op.
  fingerprint CHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY uq_notifications_fingerprint (fingerprint),
  KEY idx_notifications_audience (audience, created_at),
  KEY idx_notifications_player (player_id, created_at),
  CONSTRAINT fk_notifications_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Read state is per reader, not a flag on the notification: a global alert read
-- by one admin has to stay unread for every other admin.
CREATE TABLE notification_reads (
  notification_id CHAR(36) NOT NULL,
  -- admins.discord_user_id (what the admin session carries) or players.id.
  -- Deliberately not FK'd: one column serves both audiences.
  reader_id VARCHAR(64) NOT NULL,
  read_at DATETIME(3) NOT NULL,
  PRIMARY KEY (notification_id, reader_id),
  CONSTRAINT fk_notification_reads_notification FOREIGN KEY (notification_id) REFERENCES notifications (id) ON DELETE CASCADE
) ENGINE=InnoDB;
