import { getPool } from "../db/client.ts";
import { RateLimitsRepository } from "../repositories/rate-limits.repository.ts";

/** Fixed window per key, shared across every instance via the rate_limits table. Resolves false once the key is over its limit. */
export async function rateLimit(key: string, limit = 8, windowMs = 60_000): Promise<boolean> {
  const count = await new RateLimitsRepository(getPool()).hit(key, windowMs);
  return count <= limit;
}

/** Test seam: the window is time-based, so tests need a way back to zero. */
export async function resetRateLimits(): Promise<void> {
  await new RateLimitsRepository(getPool()).clear();
}
