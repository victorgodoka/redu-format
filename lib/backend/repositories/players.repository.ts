import type { Pool, RowDataPacket } from "mysql2/promise";
import { fromMysqlDatetime, toMysqlDatetime } from "../db/datetime.ts";

export type Player = {
  id: string;
  nexusIdentityKey: string;
  nexusName: string;
  avatarUrl: string;
  contributor: boolean;
  contributorTime: number;
  lastSeenAt: string;
};

export type PlayerProfile = {
  name: string;
  avatar: string;
  contributor: boolean;
  contributorTime: number;
};

type PlayerRow = RowDataPacket & {
  id: string;
  nexus_identity_key: string;
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

  async insert(id: string, identityKey: string, profile: PlayerProfile): Promise<void> {
    await this.pool.query(
      `INSERT INTO players (id, nexus_identity_key, nexus_name, avatar_url, contributor, contributor_time, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        identityKey,
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
       SET nexus_identity_key = ?, nexus_name = ?, avatar_url = ?, contributor = ?, contributor_time = ?, last_seen_at = ?
       WHERE id = ?`,
      [
        identityKey,
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
