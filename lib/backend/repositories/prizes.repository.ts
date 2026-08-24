import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { PrizeAssignment, PrizeTier } from "../../prizing.ts";
import { fromMysqlDatetimeMs, toMysqlDatetimeMs } from "../db/datetime.ts";

export type PrizeRow = {
  id: string;
  tier: PrizeTier;
  code: string;
  /** The registration the code went to, or null while it hasn't been sent. */
  registrationId: string | null;
  /** Display name of that registration, so the list can say who got what. */
  sentTo: string | null;
  sentAt: string | null;
};

type Row = RowDataPacket & {
  id: string;
  tier: PrizeTier;
  code: string;
  registration_id: string | null;
  display_name: string | null;
  sent_at: string | null;
};

export class PrizesRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async listForTournament(tournamentId: string): Promise<PrizeRow[]> {
    const [rows] = await this.pool.query<Row[]>(
      `SELECT p.id, p.tier, p.code, p.registration_id, p.sent_at, r.display_name
       FROM tournament_prizes p
       LEFT JOIN registrations r ON r.id = p.registration_id
       WHERE p.tournament_id = ?
       ORDER BY p.created_at ASC`,
      [tournamentId],
    );
    return rows.map((row) => ({
      id: row.id,
      tier: row.tier,
      code: row.code,
      registrationId: row.registration_id,
      sentTo: row.display_name,
      sentAt: fromMysqlDatetimeMs(row.sent_at),
    }));
  }

  async insert(id: string, tournamentId: string, tier: PrizeTier, code: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO tournament_prizes (id, tournament_id, tier, code, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, tournamentId, tier, code, toMysqlDatetimeMs(new Date().toISOString())],
    );
  }

  /** Scoped by tournament so an id from another event can't be deleted through this one's form. Never touches a code already sent. */
  async delete(tournamentId: string, id: string): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      "DELETE FROM tournament_prizes WHERE id = ? AND tournament_id = ? AND sent_at IS NULL",
      [id, tournamentId],
    );
    return result.affectedRows > 0;
  }

  /** Records who each code went to. `sent_at IS NULL` keeps a re-run from re-pointing a code that already went out. */
  async markSent(tournamentId: string, assignments: PrizeAssignment[]): Promise<void> {
    const at = toMysqlDatetimeMs(new Date().toISOString());
    for (const assignment of assignments) {
      await this.pool.query(
        `UPDATE tournament_prizes SET registration_id = ?, sent_at = ?
         WHERE id = ? AND tournament_id = ? AND sent_at IS NULL`,
        [assignment.registrationId, at, assignment.prizeId, tournamentId],
      );
    }
  }

  /** Test seam. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM tournament_prizes");
  }
}
