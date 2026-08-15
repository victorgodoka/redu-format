import type { Pool, RowDataPacket } from "mysql2/promise";
import { fromMysqlDatetimeMs, toMysqlDatetimeMs } from "../db/datetime.ts";

export type MatchTracking = { activeSince: Date; roomHash: string | null };

export class MatchDeadlinesRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Records `now` as active_since (and generates a room hash, via `hashFor`)
   * for any of these matches that don't already have a row - both are set
   * once, the first time a match is seen active, and never touched again.
   */
  async ensureActiveSince(
    tournamentId: string,
    matchIds: string[],
    now: Date,
    hashFor: (matchId: string) => string,
  ): Promise<void> {
    if (matchIds.length === 0) return;
    const nowMs = toMysqlDatetimeMs(now.toISOString());
    const values = matchIds.map((matchId) => [tournamentId, matchId, nowMs, hashFor(matchId)]);
    await this.pool.query(
      "INSERT IGNORE INTO match_deadlines (tournament_id, match_id, active_since, room_hash) VALUES ?",
      [values],
    );
  }

  /** matchId -> when it went active and its room hash, for every match this tournament has ever opened. */
  async getTrackingMap(tournamentId: string): Promise<Map<string, MatchTracking>> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT match_id, active_since, room_hash FROM match_deadlines WHERE tournament_id = ?",
      [tournamentId],
    );
    return new Map(
      rows.map((r) => [
        r.match_id,
        { activeSince: new Date(fromMysqlDatetimeMs(r.active_since)), roomHash: r.room_hash },
      ]),
    );
  }

  /** Test seam. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM match_deadlines");
  }
}
