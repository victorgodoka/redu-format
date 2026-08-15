import type { Pool, RowDataPacket } from "mysql2/promise";
import type { ExportedTournamentValues } from "tournament-organizer/interfaces";

export class TournamentBracketsRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async get(tournamentId: string): Promise<ExportedTournamentValues | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT engine_json FROM tournament_brackets WHERE tournament_id = ? LIMIT 1",
      [tournamentId],
    );
    const row = rows[0];
    if (!row) return null;
    // Same normalization as nexus_profile_cache: mysql2 has parsed JSON columns for us
    // on some driver/server combos and handed back raw text on others.
    const value = row.engine_json;
    return (typeof value === "string" ? JSON.parse(value) : value) as ExportedTournamentValues;
  }

  async save(tournamentId: string, values: ExportedTournamentValues): Promise<void> {
    await this.pool.query(
      `INSERT INTO tournament_brackets (tournament_id, engine_json)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE engine_json = VALUES(engine_json)`,
      [tournamentId, JSON.stringify(values)],
    );
  }

  async exists(tournamentId: string): Promise<boolean> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT 1 FROM tournament_brackets WHERE tournament_id = ? LIMIT 1",
      [tournamentId],
    );
    return rows.length > 0;
  }

  /** Every tournament that has ever started a bracket, for the round-deadline cron to sweep. Whether it's still open is for the caller to check via the loaded engine's status. */
  async listSlugsWithBracket(): Promise<string[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT t.slug FROM tournament_brackets b
       JOIN tournaments t ON t.id = b.tournament_id`,
    );
    return rows.map((r) => r.slug);
  }

  /** Test seam. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM tournament_brackets");
  }
}
