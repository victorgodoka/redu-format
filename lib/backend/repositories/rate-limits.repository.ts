import type { Pool, RowDataPacket } from "mysql2/promise";
import { toMysqlDatetimeMs } from "../db/datetime.ts";

export class RateLimitsRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Atomically bumps the fixed-window counter for `key` and returns the count
   * after this hit. A stale row (past reset_at) resets to 1 with a fresh
   * window instead of being deleted, so there is nothing to clean up on a
   * schedule - an expired key just looks unused until it's hit again.
   *
   * Compares against a "now" passed in from the app rather than SQL's NOW(),
   * because NOW() reads the DB server's configured timezone while reset_at is
   * written in UTC - on a server not itself set to UTC, NOW() < reset_at
   * would never be true and windows would never expire.
   */
  async hit(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const nowSql = toMysqlDatetimeMs(new Date(now).toISOString());
    const resetAtSql = toMysqlDatetimeMs(new Date(now + windowMs).toISOString());
    await this.pool.query(
      `INSERT INTO rate_limits (rl_key, count, reset_at) VALUES (?, 1, ?)
       ON DUPLICATE KEY UPDATE
         count = IF(reset_at < ?, 1, count + 1),
         reset_at = IF(reset_at < ?, VALUES(reset_at), reset_at)`,
      [key, resetAtSql, nowSql, nowSql],
    );
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT count FROM rate_limits WHERE rl_key = ?",
      [key],
    );
    return rows[0]?.count ?? 1;
  }

  /** Test seam: wipes every tracked key. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM rate_limits");
  }
}
