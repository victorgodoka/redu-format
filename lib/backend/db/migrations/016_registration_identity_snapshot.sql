-- Freezes which Nexus identity (sha256 of their token, same key players.nexus_identity_key
-- uses) actually registered for this event, independent of registrations.player_id -
-- which points at a `players` row that can later get reconciled onto a different
-- identity key (see player.service.ts's resolvePlayerId: a regenerated token,
-- matched back onto an existing player by name). NULL for admin-manual entries,
-- which never had a Nexus token to begin with.
ALTER TABLE registrations ADD COLUMN nexus_identity_key_snapshot CHAR(64) NULL AFTER player_id;
