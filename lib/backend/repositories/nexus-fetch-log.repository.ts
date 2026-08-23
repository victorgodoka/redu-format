import type { Pool, ResultSetHeader } from "mysql2/promise";
import { toMysqlDatetimeMs } from "../db/datetime.ts";

export class NexusFetchLogRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Atomically claims the right to call get-info.php for this scope (one
   * tournament): true if nothing has fetched it within `staleBeforeMs`, false
   * if something already has (another tab, another user, the cron, or an
   * earlier call in the same request). ON DUPLICATE KEY UPDATE's affected-rows
   * count is the trick - MySQL reports 0 when the UPDATE clause left the row
   * untouched (our WHERE-equivalent IF() decided it wasn't stale) and 1 or 2
   * when a row was actually written (fresh insert, or a stale row updated) -
   * so a single statement is both the read and the claim, with no race
   * between them for two callers to land in.
   */
  async claim(scopeKey: string, now: Date, staleBeforeMs: number): Promise<boolean> {
    const nowMs = toMysqlDatetimeMs(now.toISOString());
    const staleBefore = toMysqlDatetimeMs(new Date(now.getTime() - staleBeforeMs).toISOString());
    const [result] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO nexus_fetch_log (scope_key, fetched_at) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE fetched_at = IF(fetched_at < ?, VALUES(fetched_at), fetched_at)`,
      [scopeKey, nowMs, staleBefore],
    );
    return result.affectedRows > 0;
  }

  /** Test seam. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM nexus_fetch_log");
  }
}
