import type { Pool, RowDataPacket } from "mysql2/promise";

export class SavedTournamentsRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async listSlugsForPlayer(playerId: string): Promise<string[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT tournament_slug FROM saved_tournaments WHERE player_id = ?",
      [playerId],
    );
    return rows.map((r) => r.tournament_slug as string);
  }

  /** Idempotent: saving an already-saved tournament is a no-op, not an error. */
  async add(playerId: string, slug: string): Promise<void> {
    await this.pool.query(
      "INSERT IGNORE INTO saved_tournaments (id, player_id, tournament_slug) VALUES (?, ?, ?)",
      [crypto.randomUUID(), playerId, slug],
    );
  }

  async remove(playerId: string, slug: string): Promise<void> {
    await this.pool.query("DELETE FROM saved_tournaments WHERE player_id = ? AND tournament_slug = ?", [
      playerId,
      slug,
    ]);
  }

  /** Test seam. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM saved_tournaments");
  }
}
