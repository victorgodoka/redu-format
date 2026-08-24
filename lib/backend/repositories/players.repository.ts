import type { Pool, RowDataPacket } from "mysql2/promise";
import { fromMysqlDatetime, toMysqlDatetime } from "../db/datetime.ts";

export type Player = {
  id: string;
  nexusIdentityKey: string;
  nexusUserId: string | null;
  /** Discord account this player signs in with, once they have linked one. */
  discordUserId: string | null;
  /** The Dueling Nexus token linked to that Discord account - what re-opens the logged-in area on the next sign-in. */
  nexusToken: string | null;
  nexusName: string;
  avatarUrl: string;
  contributor: boolean;
  contributorTime: number;
  lastSeenAt: string;
};

export type PlayerProfile = {
  name: string;
  /** Nexus's own internal player id, when the profile fetch returned one - see docs/on lib/nexus-parse.ts's parseUserId. */
  userId?: string;
  avatar: string;
  contributor: boolean;
  contributorTime: number;
};

type PlayerRow = RowDataPacket & {
  id: string;
  nexus_identity_key: string;
  nexus_user_id: string | null;
  discord_user_id: string | null;
  nexus_token: string | null;
  nexus_name: string;
  avatar_url: string | null;
  contributor: number;
  contributor_time: number | null;
  last_seen_at: string;
};

function rowToPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    nexusIdentityKey: row.nexus_identity_key,
    nexusUserId: row.nexus_user_id,
    discordUserId: row.discord_user_id,
    nexusToken: row.nexus_token,
    nexusName: row.nexus_name,
    avatarUrl: row.avatar_url ?? "",
    contributor: Boolean(row.contributor),
    contributorTime: row.contributor_time ?? 0,
    lastSeenAt: fromMysqlDatetime(row.last_seen_at),
  };
}

export class PlayersRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async findByIdentityKey(key: string): Promise<Player | null> {
    const [rows] = await this.pool.query<PlayerRow[]>(
      "SELECT * FROM players WHERE nexus_identity_key = ? LIMIT 1",
      [key],
    );
    return rows[0] ? rowToPlayer(rows[0]) : null;
  }

  /** Reconciliation lookup - see player.service.ts for why this exists. */
  async findByName(name: string): Promise<Player | null> {
    const [rows] = await this.pool.query<PlayerRow[]>(
      "SELECT * FROM players WHERE nexus_name = ? LIMIT 1",
      [name],
    );
    return rows[0] ? rowToPlayer(rows[0]) : null;
  }

  async findByNexusUserId(nexusUserId: string): Promise<Player | null> {
    const [rows] = await this.pool.query<PlayerRow[]>(
      "SELECT * FROM players WHERE nexus_user_id = ? LIMIT 1",
      [nexusUserId],
    );
    return rows[0] ? rowToPlayer(rows[0]) : null;
  }

  /** Players picked out by Nexus name for an admin broadcast - what the message form autocompletes against. */
  async findByNames(names: string[]): Promise<Player[]> {
    if (names.length === 0) return [];
    const [rows] = await this.pool.query<PlayerRow[]>("SELECT * FROM players WHERE nexus_name IN (?)", [
      names,
    ]);
    return rows.map(rowToPlayer);
  }

  /**
   * Names for the broadcast form's autocomplete, most recently seen first.
   * ponytail: capped list rendered into a datalist - swap for a search
   * endpoint if the player table ever outgrows one page of options.
   */
  async listNames(limit: number): Promise<string[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT nexus_name FROM players ORDER BY last_seen_at DESC LIMIT ?",
      [limit],
    );
    return rows.map((row) => row.nexus_name as string);
  }

  async findByDiscordUserId(discordUserId: string): Promise<Player | null> {
    const [rows] = await this.pool.query<PlayerRow[]>(
      "SELECT * FROM players WHERE discord_user_id = ? LIMIT 1",
      [discordUserId],
    );
    return rows[0] ? rowToPlayer(rows[0]) : null;
  }

  /**
   * Ties a Discord account to this player and stores the token behind it.
   * Clears the same Discord id off any other player row first - a player who
   * regenerates their Nexus account (and so resolves to a new row) is still
   * the same person, and the unique index would otherwise reject the move.
   */
  async linkDiscord(playerId: string, discordUserId: string, nexusToken: string): Promise<void> {
    await this.pool.query(
      "UPDATE players SET discord_user_id = NULL, nexus_token = NULL WHERE discord_user_id = ? AND id <> ?",
      [discordUserId, playerId],
    );
    await this.pool.query("UPDATE players SET discord_user_id = ?, nexus_token = ? WHERE id = ?", [
      discordUserId,
      nexusToken,
      playerId,
    ]);
  }

  /** Drops a stored token Nexus has since rejected, so the next sign-in asks for a fresh one. */
  async clearNexusToken(playerId: string): Promise<void> {
    await this.pool.query("UPDATE players SET nexus_token = NULL WHERE id = ?", [playerId]);
  }

  async insert(id: string, identityKey: string, profile: PlayerProfile): Promise<void> {
    await this.pool.query(
      `INSERT INTO players (id, nexus_identity_key, nexus_user_id, nexus_name, avatar_url, contributor, contributor_time, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        identityKey,
        profile.userId || null,
        profile.name,
        profile.avatar || null,
        profile.contributor,
        profile.contributorTime,
        toMysqlDatetime(new Date().toISOString()),
      ],
    );
  }

  async touch(id: string, identityKey: string, profile: PlayerProfile): Promise<void> {
    await this.pool.query(
      `UPDATE players
       SET nexus_identity_key = ?, nexus_user_id = COALESCE(?, nexus_user_id), nexus_name = ?, avatar_url = ?, contributor = ?, contributor_time = ?, last_seen_at = ?
       WHERE id = ?`,
      [
        identityKey,
        profile.userId || null,
        profile.name,
        profile.avatar || null,
        profile.contributor,
        profile.contributorTime,
        toMysqlDatetime(new Date().toISOString()),
        id,
      ],
    );
  }

  /** Test seam. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM players");
  }
}
