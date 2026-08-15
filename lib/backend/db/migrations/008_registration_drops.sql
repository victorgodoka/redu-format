-- Fase 5.2: player drops. dropped_at is set only for a drop after the bracket has
-- started (before that, dropping just deletes the registration outright - see
-- registration.service.ts dropRegistration - so there's nothing to flag). Kept on
-- the registration row rather than removed from the tournament-organizer engine's
-- player list, since results.service.ts already tracks "still in it" via the
-- engine's own Player.active flag - this column is for admin/UI visibility and the
-- absence counter below.
ALTER TABLE registrations
  ADD COLUMN dropped_at DATETIME(3) NULL,
  ADD COLUMN consecutive_absences INT NOT NULL DEFAULT 0;
