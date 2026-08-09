// ponytail: per-instance memory, so it resets on deploy and does not span
// serverless workers. Swap for Redis/Upstash if login abuse becomes real.
const hits = new Map<string, { count: number; resetAt: number }>();

/** Fixed window per key. Returns false once the key is over its limit. */
export function rateLimit(key: string, limit = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  const hit = hits.get(key);

  if (!hit || now > hit.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (hit.count >= limit) return false;

  hit.count++;
  return true;
}

/** Test seam: the window is time-based, so tests need a way back to zero. */
export function resetRateLimits() {
  hits.clear();
}
