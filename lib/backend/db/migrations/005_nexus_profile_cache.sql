-- Fase 4: Nexus profile cache moves from the in-process Map in lib/auth.ts into
-- MariaDB, since Vercel runs this as multiple serverless instances with no
-- shared memory between them - the Map only ever cached within one instance.
CREATE TABLE nexus_profile_cache (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  profile_json JSON NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
