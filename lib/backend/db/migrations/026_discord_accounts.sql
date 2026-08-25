-- Who signed in with Discord, kept whether or not they ever link a Nexus
-- account (players rows only exist once a token resolves, so this cannot hang
-- off that table). Nothing player-facing reads it: the site still shows the
-- Dueling Nexus name and avatar everywhere a duelist is displayed.
CREATE TABLE discord_accounts (
  discord_user_id VARCHAR(32) NOT NULL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(2048) NULL,
  first_seen_at DATETIME(3) NOT NULL,
  last_login_at DATETIME(3) NOT NULL
) ENGINE=InnoDB;
