import type { Pool, RowDataPacket } from "mysql2/promise";
import { fromMysqlDatetimeMs, toMysqlDatetimeMs } from "../db/datetime.ts";

export type MatchTracking = { activeSince: Date; roomHash: string | null; deadlineOverride: Date | null };

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

  /** matchId -> when it went active, its room hash, and any Staff deadline extension, for every match this tournament has ever opened. */
  async getTrackingMap(tournamentId: string): Promise<Map<string, MatchTracking>> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT match_id, active_since, room_hash, deadline_override FROM match_deadlines WHERE tournament_id = ?",
      [tournamentId],
    );
    return new Map(
      rows.map((r) => [
        r.match_id,
        {
          activeSince: new Date(fromMysqlDatetimeMs(r.active_since)),
          roomHash: r.room_hash,
          deadlineOverride: r.deadline_override ? new Date(fromMysqlDatetimeMs(r.deadline_override)) : null,
        },
      ]),
    );
  }

  /**
   * Pushes out the deadline for each given match, overriding the normal
   * active_since + roundLimitDays computation - what Staff extending the
   * current round uses (e.g. the duel engine was down). Silently no-ops for a
   * match with no tracking row (nothing active to extend).
   */
  async extendDeadlines(tournamentId: string, updates: { matchId: string; until: Date }[]): Promise<void> {
    for (const { matchId, until } of updates) {
      await this.pool.query(
        "UPDATE match_deadlines SET deadline_override = ? WHERE tournament_id = ? AND match_id = ?",
        [toMysqlDatetimeMs(until.toISOString()), tournamentId, matchId],
      );
    }
  }

  /** Test seam. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM match_deadlines");
  }
}
