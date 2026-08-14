import type { Pool, RowDataPacket } from "mysql2/promise";
import { toMysqlDatetime } from "../db/datetime.ts";

export class AdminsRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /** Insert on first login, refresh username/display name/role-check time on every later one. Returns the internal id either way. */
  async upsert(input: { discordUserId: string; username: string; displayName: string }): Promise<string> {
    const id = crypto.randomUUID();
    const now = toMysqlDatetime(new Date().toISOString());
    await this.pool.query(
      `INSERT INTO admins (id, discord_user_id, username, display_name, last_role_check_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         username = VALUES(username),
         display_name = VALUES(display_name),
         last_role_check_at = VALUES(last_role_check_at)`,
      [id, input.discordUserId, input.username, input.displayName, now],
    );
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT id FROM admins WHERE discord_user_id = ?",
      [input.discordUserId],
    );
    return rows[0].id;
  }

  async findIdByDiscordUserId(discordUserId: string): Promise<string | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT id FROM admins WHERE discord_user_id = ?",
      [discordUserId],
    );
    return rows[0]?.id ?? null;
  }

  /** Test seam. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM admins");
  }
}
