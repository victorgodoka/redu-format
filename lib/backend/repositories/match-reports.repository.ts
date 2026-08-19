import type { Pool, RowDataPacket } from "mysql2/promise";
import { toMysqlDatetimeMs } from "../db/datetime.ts";

/**
 * There are no draws in this system - a duel series is won or lost. The
 * column still allows 'draw' for rows written before that rule, which is why
 * the type keeps it readable, but nothing writes one anymore.
 */
export type MatchResult = "win" | "loss" | "draw";

export type MatchReport = {
  matchId: string;
  registrationId: string;
  result: MatchResult;
  /** Games won by the winner of the series (2 in a Bo3, 1 in a Bo1). */
  winnerGames: number;
  /** Games won by the loser (0 or 1 in a Bo3). */
  loserGames: number;
};

export class MatchReportsRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Records who called the match and with what score. One report settles the
   * match, so this is the record of the call rather than a pending vote -
   * re-reporting overwrites it (a moderator's override is what actually
   * changes a settled result).
   */
  async submit(
    tournamentId: string,
    matchId: string,
    registrationId: string,
    result: MatchResult,
    winnerGames: number,
    loserGames: number,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO match_reports (tournament_id, match_id, registration_id, result, winner_games, loser_games, reported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        result = VALUES(result), winner_games = VALUES(winner_games),
        loser_games = VALUES(loser_games), reported_at = VALUES(reported_at)`,
      [
        tournamentId,
        matchId,
        registrationId,
        result,
        winnerGames,
        loserGames,
        toMysqlDatetimeMs(new Date().toISOString()),
      ],
    );
  }

  async listForMatch(matchId: string): Promise<MatchReport[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT match_id, registration_id, result, winner_games, loser_games FROM match_reports WHERE match_id = ?",
      [matchId],
    );
    return rows.map(toReport);
  }

  /** Every report in the tournament - the bracket shows who called each match, and the deadline sweep reads them. */
  async listForTournament(tournamentId: string): Promise<MatchReport[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT match_id, registration_id, result, winner_games, loser_games FROM match_reports WHERE tournament_id = ?",
      [tournamentId],
    );
    return rows.map(toReport);
  }

  async clearForMatch(matchId: string): Promise<void> {
    await this.pool.query("DELETE FROM match_reports WHERE match_id = ?", [matchId]);
  }

  /** Test seam. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM match_reports");
  }
}

function toReport(row: RowDataPacket): MatchReport {
  return {
    matchId: row.match_id,
    registrationId: row.registration_id,
    result: row.result,
    winnerGames: Number(row.winner_games ?? 1),
    loserGames: Number(row.loser_games ?? 0),
  };
}
