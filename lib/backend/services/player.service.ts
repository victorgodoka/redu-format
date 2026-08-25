import { createHash } from "node:crypto";
import { getPool } from "../db/client.ts";
import {
  DiscordAccountsRepository,
  type DiscordAccount,
} from "../repositories/discord-accounts.repository.ts";
import { PlayersRepository, type PlayerProfile } from "../repositories/players.repository.ts";

export type { DiscordAccount, PlayerProfile };

/**
 * sha256 of the Nexus token - the stable-ish id a registration snapshots at
 * signup time (see registration.service.ts's registerSignup), so a
 * tournament's historical record of "who played" stays tied to the actual
 * identity used that event even if players.nexus_identity_key later moves
 * (reconciled onto a different key by resolvePlayerId, a renamed account,
 * etc.) Exported for that snapshot; resolvePlayerId/findPlayerIdByToken use
 * it internally for the live players table lookup.
 */
export function identityKey(token: string): string {
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
 * Saves what Discord says about whoever just signed in. Kept for the record -
 * support, moderation, and knowing an account exists at all before it has a
 * Nexus token behind it. Nothing player-facing renders it: duelists are always
 * shown by their Dueling Nexus name and avatar.
 */
export async function rememberDiscordAccount(account: DiscordAccount): Promise<void> {
  await new DiscordAccountsRepository(getPool()).upsert(account);
}

/** The player behind a Discord account, or null if that account has never linked a Nexus token. */
export async function findPlayerByDiscordId(discordUserId: string) {
  return new PlayersRepository(getPool()).findByDiscordUserId(discordUserId);
}

/** Remembers which Discord account a Nexus token belongs to, so the next sign-in skips the token step. */
export async function linkDiscordAccount(
  playerId: string,
  discordUserId: string,
  token: string,
): Promise<void> {
  await new PlayersRepository(getPool()).linkDiscord(playerId, discordUserId, token);
}

/** Called when Nexus rejects a stored token - the link stays, the dead credential does not. */
export async function forgetNexusToken(playerId: string): Promise<void> {
  await new PlayersRepository(getPool()).clearNexusToken(playerId);
}

/** Nexus names for the admin broadcast form's autocomplete. */
export async function listPlayerNames(limit = 500): Promise<string[]> {
  return new PlayersRepository(getPool()).listNames(limit);
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
