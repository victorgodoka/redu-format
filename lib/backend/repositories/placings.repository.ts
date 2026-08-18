import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

export type Placing = { registrationId: string; place: number; points: number; rankingPoints: number };

export type LeaderboardRow = {
  playerId: string;
  playerName: string;
  totalPoints: number;
  eventsPlayed: number;
};

export class PlacingsRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /** Replaces any prior placings for this tournament (re-completing overwrites, doesn't duplicate). */
  async replaceForTournament(tournamentId: string, placings: Placing[]): Promise<void> {
    await this.pool.query<ResultSetHeader>("DELETE FROM tournament_placings WHERE tournament_id = ?", [
      tournamentId,
    ]);
    for (const placing of placings) {
      await this.pool.query(
        `INSERT INTO tournament_placings (id, tournament_id, registration_id, place, points, ranking_points)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          tournamentId,
          placing.registrationId,
          placing.place,
          placing.points,
          placing.rankingPoints,
        ],
      );
    }
  }

  async listForTournament(
    tournamentId: string,
  ): Promise<(Placing & { displayName: string; deckId: string | null; deckName: string })[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT p.registration_id, p.place, p.points, p.ranking_points, r.display_name, r.deck_id, r.deck_name
       FROM tournament_placings p
       JOIN registrations r ON r.id = p.registration_id
       WHERE p.tournament_id = ?
       ORDER BY p.place ASC`,
      [tournamentId],
    );
    return rows.map((r) => ({
      registrationId: r.registration_id,
      place: r.place,
      points: Number(r.points),
      rankingPoints: Number(r.ranking_points),
      displayName: r.display_name,
      deckId: r.deck_id,
      deckName: r.deck_name,
    }));
  }

  /** Every placing this player has, across every tournament, keyed by slug - one query instead of one per past event on the dashboard. */
  async listForPlayer(playerId: string): Promise<{ slug: string; place: number; points: number }[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT t.slug, tp.place, tp.points
       FROM tournament_placings tp
       JOIN registrations r ON r.id = tp.registration_id
       JOIN tournaments t ON t.id = tp.tournament_id
       WHERE r.player_id = ?`,
      [playerId],
    );
    return rows.map((r) => ({ slug: r.slug, place: r.place, points: Number(r.points) }));
  }

  /**
   * Only registrations linked to a real player count - a leaderboard of
   * accounts, not of names typed into a form. Sums ranking_points (the
   * placement-based formula - 1st = 100, 2nd = 75, ...), not the raw match
   * points earned within each tournament - otherwise a player who just enters
   * a lot of events and wins a lot of matches would outrank someone who
   * actually places higher less often.
   */
  async leaderboard(limit: number): Promise<LeaderboardRow[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT pl.id AS player_id, pl.nexus_name AS player_name,
              SUM(tp.ranking_points) AS total_points, COUNT(*) AS events_played
       FROM tournament_placings tp
       JOIN registrations r ON r.id = tp.registration_id
       JOIN players pl ON pl.id = r.player_id
       GROUP BY pl.id, pl.nexus_name
       ORDER BY total_points DESC
       LIMIT ?`,
      [limit],
    );
    return rows.map((r) => ({
      playerId: r.player_id,
      playerName: r.player_name,
      totalPoints: Number(r.total_points),
      eventsPlayed: Number(r.events_played),
    }));
  }

  /** Test seam. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM tournament_placings");
  }
}
