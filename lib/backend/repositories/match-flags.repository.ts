import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { fromMysqlDatetimeMs, toMysqlDatetimeMs } from "../db/datetime.ts";

export type MatchFlagKind = "no_show" | "contest";

export type MatchFlag = {
  matchId: string;
  kind: MatchFlagKind;
  reporterRegistrationId: string;
  /** The accused player, for a no-show. Null for a contested result. */
  targetRegistrationId: string | null;
  createdAt: Date;
  /** When an unanswered no-show turns into a loss on its own. Null in a long-duration tournament, which always waits for a moderator. */
  autoResolvesAt: Date | null;
  dismissedAt: Date | null;
  dismissedBy: string | null;
  resolvedAt: Date | null;
};

function toFlag(row: RowDataPacket): MatchFlag {
  return {
    matchId: row.match_id,
    kind: row.kind,
    reporterRegistrationId: row.reporter_registration_id,
    targetRegistrationId: row.target_registration_id,
    createdAt: new Date(fromMysqlDatetimeMs(row.created_at)),
    autoResolvesAt: row.auto_resolves_at ? new Date(fromMysqlDatetimeMs(row.auto_resolves_at)) : null,
    dismissedAt: row.dismissed_at ? new Date(fromMysqlDatetimeMs(row.dismissed_at)) : null,
    dismissedBy: row.dismissed_by,
    resolvedAt: row.resolved_at ? new Date(fromMysqlDatetimeMs(row.resolved_at)) : null,
  };
}

const OPEN = "dismissed_at IS NULL AND resolved_at IS NULL";

/**
 * No-show calls and contested results. Both are "someone raised a hand about
 * this match" - the bracket shows them, moderators act on them, and a no-show
 * that actually sticks counts toward a disqualification.
 */
export class MatchFlagsRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Raises a flag, or replaces a previously dismissed one on the same match
   * (a player who no-shows twice in one duel can be called out twice).
   */
  async raise(input: {
    tournamentId: string;
    matchId: string;
    kind: MatchFlagKind;
    reporterRegistrationId: string;
    targetRegistrationId: string | null;
    autoResolvesAt: Date | null;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO match_flags
        (match_id, kind, tournament_id, reporter_registration_id, target_registration_id, created_at, auto_resolves_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        reporter_registration_id = VALUES(reporter_registration_id),
        target_registration_id = VALUES(target_registration_id),
        created_at = VALUES(created_at),
        auto_resolves_at = VALUES(auto_resolves_at),
        dismissed_at = NULL, dismissed_by = NULL, resolved_at = NULL`,
      [
        input.matchId,
        input.kind,
        input.tournamentId,
        input.reporterRegistrationId,
        input.targetRegistrationId,
        toMysqlDatetimeMs(new Date().toISOString()),
        input.autoResolvesAt ? toMysqlDatetimeMs(input.autoResolvesAt.toISOString()) : null,
      ],
    );
  }

  /** Every flag still standing in this tournament - what the bracket highlights and moderators work through. */
  async listOpen(tournamentId: string): Promise<MatchFlag[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM match_flags WHERE tournament_id = ? AND ${OPEN}`,
      [tournamentId],
    );
    return rows.map(toFlag);
  }

  async findOpen(matchId: string, kind: MatchFlagKind): Promise<MatchFlag | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM match_flags WHERE match_id = ? AND kind = ? AND ${OPEN} LIMIT 1`,
      [matchId, kind],
    );
    return rows[0] ? toFlag(rows[0]) : null;
  }

  /** No-shows whose grace period has run out - what the sweep turns into losses. Scoped to one tournament, or all of them for the cron. */
  async listDueNoShows(now: Date, tournamentId?: string): Promise<(MatchFlag & { tournamentId: string })[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM match_flags
       WHERE kind = 'no_show' AND ${OPEN} AND auto_resolves_at IS NOT NULL AND auto_resolves_at <= ?
         ${tournamentId ? "AND tournament_id = ?" : ""}`,
      tournamentId ? [toMysqlDatetimeMs(now.toISOString()), tournamentId] : [toMysqlDatetimeMs(now.toISOString())],
    );
    return rows.map((r) => ({ ...toFlag(r), tournamentId: r.tournament_id }));
  }

  /** Called off - by the accused, by the player who raised it, or by a moderator. Nothing counts against anyone. */
  async dismiss(matchId: string, kind: MatchFlagKind, by: string): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `UPDATE match_flags SET dismissed_at = ?, dismissed_by = ? WHERE match_id = ? AND kind = ? AND ${OPEN}`,
      [toMysqlDatetimeMs(new Date().toISOString()), by, matchId, kind],
    );
    return result.affectedRows > 0;
  }

  /** The flag decided something: the auto-loss fired, or a moderator ruled on it. */
  async resolve(matchId: string, kind: MatchFlagKind): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `UPDATE match_flags SET resolved_at = ? WHERE match_id = ? AND kind = ? AND ${OPEN}`,
      [toMysqlDatetimeMs(new Date().toISOString()), matchId, kind],
    );
    return result.affectedRows > 0;
  }

  /** Test seam. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM match_flags");
  }
}
