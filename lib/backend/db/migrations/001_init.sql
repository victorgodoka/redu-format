CREATE TABLE tournaments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(255) NOT NULL,
  -- Slug is unique only among live rows, NULL out on soft delete once that lands.
  -- MariaDB treats each NULL as distinct in a UNIQUE index, so deleted rows never block reuse.
  slug_active VARCHAR(255) AS (IF(deleted_at IS NULL, slug, NULL)) STORED,
  name VARCHAR(255) NOT NULL,
  starts_at DATETIME NOT NULL,
  structure ENUM('swiss', 'single-elim', 'double-elim') NOT NULL,
  rounds INT NOT NULL,
  top_cut INT NULL,
  match_format ENUM('Bo1', 'Bo3') NOT NULL,
  time_limit_minutes INT NOT NULL,
  seat_cap INT NULL,
  taken INT NOT NULL DEFAULT 0,
  entry_type ENUM('free', 'paid') NOT NULL,
  entry_amount_minor INT NULL,
  entry_currency CHAR(3) NULL,
  host VARCHAR(255) NOT NULL,
  signup_url VARCHAR(2048) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_tournaments_slug_active (slug_active)
) ENGINE=InnoDB;

CREATE TABLE registrations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  tournament_id CHAR(36) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  deck_name VARCHAR(255) NOT NULL,
  payment_status ENUM('pending', 'confirmed', 'contested') NOT NULL DEFAULT 'pending',
  proof_url VARCHAR(2048) NULL,
  payment_by VARCHAR(255) NULL,
  payment_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_registrations_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Created now per the backend plan's Fase 1 checklist; no code reads/writes these yet.
-- admins gets wired up when admin login upserts into it, audit_logs when Fase 2 migrates lib/audit-log.ts.
CREATE TABLE admins (
  id CHAR(36) NOT NULL PRIMARY KEY,
  discord_user_id VARCHAR(32) NOT NULL,
  username VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  last_role_check_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admins_discord_user_id (discord_user_id)
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  at DATETIME NOT NULL,
  actor_admin_id CHAR(36) NULL,
  actor_discord_user_id VARCHAR(32) NOT NULL,
  actor_username VARCHAR(255) NOT NULL,
  actor_display_name VARCHAR(255) NOT NULL,
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(32) NULL,
  target_id VARCHAR(255) NULL,
  target_slug VARCHAR(255) NULL,
  detail TEXT NOT NULL,
  metadata JSON NULL,
  request_id VARCHAR(64) NULL,
  CONSTRAINT fk_audit_logs_admin FOREIGN KEY (actor_admin_id) REFERENCES admins (id) ON DELETE SET NULL,
  INDEX idx_audit_logs_at (at),
  INDEX idx_audit_logs_actor (actor_discord_user_id, at),
  INDEX idx_audit_logs_action (action, at),
  INDEX idx_audit_logs_target (target_type, target_id, at)
) ENGINE=InnoDB;
