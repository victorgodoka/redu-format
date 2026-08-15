-- Fase 5.3: Dueling Nexus room hashes.
--
-- "Engine" only ever has one value today (Dueling Nexus is the only place
-- REDU runs duels), but it's a real column/enum rather than an assumption
-- baked into the code, so a second engine can be added later without a
-- schema change - see lib/backend/services/results.service.ts's
-- syncMatchDeadlines() for the (currently single-armed) branch point.
ALTER TABLE tournaments ADD COLUMN engine ENUM('dueling-nexus') NOT NULL DEFAULT 'dueling-nexus';

-- Generated once, the moment a match's two players are both seated (same
-- trigger as match_deadlines.active_since, hence living on the same row
-- instead of a separate table) - stable for the life of that duel.
ALTER TABLE match_deadlines ADD COLUMN room_hash VARCHAR(16) NULL;
