import type { Pool } from "mysql2/promise";
import { toMysqlDatetimeMs } from "../db/datetime.ts";

export type DiscordAccount = {
  discordUserId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export class DiscordAccountsRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /** Records the account as of this sign-in. first_seen_at is kept from the original row. */
  async upsert(account: DiscordAccount): Promise<void> {
    const now = toMysqlDatetimeMs(new Date().toISOString());
    await this.pool.query(
      `INSERT INTO discord_accounts
        (discord_user_id, username, display_name, avatar_url, first_seen_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        username = VALUES(username),
        display_name = VALUES(display_name),
        avatar_url = VALUES(avatar_url),
        last_login_at = VALUES(last_login_at)`,
      [
        account.discordUserId,
        account.username,
        account.displayName,
        account.avatarUrl,
        now,
        now,
      ],
    );
  }
}
