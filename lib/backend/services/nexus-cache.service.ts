import { getPool } from "../db/client.ts";
import { NexusProfileCacheRepository } from "../repositories/nexus-profile-cache.repository.ts";

export type CacheHit<T> = { value: T; expiresAt: number };

/** Null on a miss or an expired row - expiry is checked here in JS, not via SQL, so it isn't sensitive to the DB server's timezone (see lib/backend/repositories/rate-limits.repository.ts for why that matters). */
export async function getCachedProfile<T>(tokenHash: string): Promise<CacheHit<T> | null> {
  const row = await new NexusProfileCacheRepository(getPool()).get(tokenHash);
  if (!row) return null;

  const expiresAt = new Date(row.expiresAt).getTime();
  if (expiresAt <= Date.now()) return null;

  // mysql2 parses a JSON-typed column into an object/array on its own for
  // some driver/server version combos, and hands back the raw text for
  // others - normalize instead of assuming either way.
  const value = typeof row.profileJson === "string" ? JSON.parse(row.profileJson) : row.profileJson;
  return { value: value as T, expiresAt };
}

export async function setCachedProfile(tokenHash: string, value: unknown, ttlMs: number): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  await new NexusProfileCacheRepository(getPool()).set(tokenHash, JSON.stringify(value), expiresAt);
}

export async function invalidateCachedProfile(tokenHash: string): Promise<void> {
  await new NexusProfileCacheRepository(getPool()).invalidate(tokenHash);
}

/** Test seam. */
export async function clearProfileCache(): Promise<void> {
  await new NexusProfileCacheRepository(getPool()).clear();
}
