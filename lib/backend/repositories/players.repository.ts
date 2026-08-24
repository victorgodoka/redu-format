import type { Pool, RowDataPacket } from "mysql2/promise";
import { fromMysqlDatetime, toMysqlDatetime } from "../db/datetime.ts";

export type Player = {
  id: string;
  nexusIdentityKey: string;
  nexusUserId: string | null;
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

  /**
   * Players picked out by Nexus id for an admin broadcast. The name is matched
   * too: it is what an admin actually has on hand from a bracket or a signup
   * list, and it is never a token - a token is not accepted here at all.
   */
  async findByNexusIds(ids: string[]): Promise<Player[]> {
    if (ids.length === 0) return [];
    const [rows] = await this.pool.query<PlayerRow[]>(
      "SELECT * FROM players WHERE nexus_user_id IN (?) OR nexus_name IN (?)",
      [ids, ids],
    );
    return rows.map(rowToPlayer);
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
