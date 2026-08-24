-- Site login moved to Discord: any valid Discord account gets in (no role
-- check, unlike /admin), but the logged-in area stays closed until a working
-- Dueling Nexus token is linked. The token is persisted here, the same way
-- admins.nexus_token already survives an admin session, so a returning player
-- is not asked to paste it again every time the cookie expires.
ALTER TABLE players
  ADD COLUMN discord_user_id VARCHAR(32) NULL AFTER nexus_user_id,
  ADD COLUMN nexus_token VARCHAR(512) NULL AFTER discord_user_id,
  ADD UNIQUE KEY uq_players_discord (discord_user_id);
