import { createHash } from "node:crypto";
import { getPool } from "../db/client.ts";
import { PlayersRepository, type PlayerProfile } from "../repositories/players.repository.ts";

export type { PlayerProfile };

function identityKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Upserts by identity key (sha256 of the Nexus token) first. If the token is
 * new but the Nexus name matches an existing player, reconciles onto that
 * player instead of forking a duplicate - covers the common case of a
 * regenerated token. Not bulletproof (a renamed account still forks), but the
 * real Nexus API has no stable id to do better with - see
 * docs/backend-structure.md seção 14.
 *
 * Called from login()/refresh() (the doc-mandated spot) and from register()/
 * saveTournamentAction(), which already have a fresh profile in hand and
 * would otherwise depend on login/refresh having run since this feature
 * shipped, for every session created before it.
 */
export async function resolvePlayerId(token: string, profile: PlayerProfile): Promise<string> {
  const repo = new PlayersRepository(getPool());
  const key = identityKey(token);

  const byKey = await repo.findByIdentityKey(key);
  if (byKey) {
    await repo.touch(byKey.id, key, profile);
    return byKey.id;
  }

  const byName = await repo.findByName(profile.name);
  if (byName) {
    await repo.touch(byName.id, key, profile);
    return byName.id;
  }

  const id = crypto.randomUUID();
  await repo.insert(id, key, profile);
  return id;
}

/**
 * Read-only: for pages/actions (cancel, unsave, "am I registered" checks)
 * that only need an existing player's id without touching the Nexus API or
 * creating a new row. Null means no player has ever been resolved for this
 * token - callers should treat that the same as "nothing registered/saved".
 */
export async function findPlayerIdByToken(token: string): Promise<string | null> {
  const player = await new PlayersRepository(getPool()).findByIdentityKey(identityKey(token));
  return player?.id ?? null;
}
