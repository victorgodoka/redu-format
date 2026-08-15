import type { Pool, RowDataPacket } from "mysql2/promise";
import { toMysqlDatetimeMs } from "../db/datetime.ts";

export type MatchResult = "win" | "loss" | "draw";
export type MatchReport = { matchId: string; registrationId: string; result: MatchResult };

export class MatchReportsRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /** A player can change their mind about their own report as long as it hasn't resolved yet. */
  async submit(tournamentId: string, matchId: string, registrationId: string, result: MatchResult): Promise<void> {
    await this.pool.query(
      `INSERT INTO match_reports (tournament_id, match_id, registration_id, result, reported_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE result = VALUES(result), reported_at = VALUES(reported_at)`,
      [tournamentId, matchId, registrationId, result, toMysqlDatetimeMs(new Date().toISOString())],
    );
  }

  async listForMatch(matchId: string): Promise<MatchReport[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT match_id, registration_id, result FROM match_reports WHERE match_id = ?",
      [matchId],
    );
    return rows.map((r) => ({ matchId: r.match_id, registrationId: r.registration_id, result: r.result }));
  }

  /** Every open report across the whole tournament, for the deadline job and the admin dispute view. */
  async listForTournament(tournamentId: string): Promise<MatchReport[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT match_id, registration_id, result FROM match_reports WHERE tournament_id = ?",
      [tournamentId],
    );
    return rows.map((r) => ({ matchId: r.match_id, registrationId: r.registration_id, result: r.result }));
  }

  async clearForMatch(matchId: string): Promise<void> {
    await this.pool.query("DELETE FROM match_reports WHERE match_id = ?", [matchId]);
  }

  /** Test seam. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM match_reports");
  }
}
