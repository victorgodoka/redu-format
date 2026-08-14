import type { Pool, RowDataPacket } from "mysql2/promise";
import { fromMysqlDatetime, toMysqlDatetime } from "../db/datetime.ts";

// Empirically, mysql2 has parsed a JSON-typed column into an object for us on
// some driver/server combos and handed back raw text on others - the caller
// normalizes either way (see nexus-cache.service.ts).
export type CachedProfileRow = { profileJson: unknown; expiresAt: string };

export class NexusProfileCacheRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async get(tokenHash: string): Promise<CachedProfileRow | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT profile_json, expires_at FROM nexus_profile_cache WHERE token_hash = ? LIMIT 1",
      [tokenHash],
    );
    const row = rows[0];
    return row ? { profileJson: row.profile_json, expiresAt: fromMysqlDatetime(row.expires_at) } : null;
  }

  async set(tokenHash: string, profileJson: string, expiresAt: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO nexus_profile_cache (token_hash, profile_json, expires_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE profile_json = VALUES(profile_json), expires_at = VALUES(expires_at)`,
      [tokenHash, profileJson, toMysqlDatetime(expiresAt)],
    );
  }

  async invalidate(tokenHash: string): Promise<void> {
    await this.pool.query("DELETE FROM nexus_profile_cache WHERE token_hash = ?", [tokenHash]);
  }

  /** Test seam. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM nexus_profile_cache");
  }
}
