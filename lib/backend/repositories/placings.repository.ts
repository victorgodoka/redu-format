import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

/** The match record frozen with a placing: what the player did across that tournament. */
export type MatchRecord = { wins: number; losses: number; draws: number };

export type Placing = {
  registrationId: string;
  place: number;
  points: number;
  rankingPoints: number;
} & MatchRecord;

export type LeaderboardRow = {
  playerId: string;
  playerName: string;
  /** Dueling Nexus avatar - the identity duelists are shown by, Discord login or not. */
  avatarUrl: string;
  totalPoints: number;
  eventsPlayed: number;
  wins: number;
  losses: number;
  /** Lowest place they have ever finished in, i.e. their best result. */
  bestPlace: number;
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
        `INSERT INTO tournament_placings
          (id, tournament_id, registration_id, place, points, ranking_points, wins, losses, draws)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          tournamentId,
          placing.registrationId,
          placing.place,
          placing.points,
          placing.rankingPoints,
          placing.wins,
          placing.losses,
          placing.draws,
        ],
      );
    }
  }

  async listForTournament(
    tournamentId: string,
  ): Promise<(Placing & { displayName: string; deckId: string | null; deckName: string })[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT p.registration_id, p.place, p.points, p.ranking_points, p.wins, p.losses, p.draws,
              r.display_name, r.deck_id, r.deck_name
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
      wins: Number(r.wins ?? 0),
      losses: Number(r.losses ?? 0),
      draws: Number(r.draws ?? 0),
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
  async leaderboard(limit: number, offset = 0): Promise<LeaderboardRow[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT pl.id AS player_id, pl.nexus_name AS player_name, pl.avatar_url,
              SUM(tp.ranking_points) AS total_points, COUNT(*) AS events_played,
              SUM(COALESCE(tp.wins, 0)) AS wins, SUM(COALESCE(tp.losses, 0)) AS losses,
              MIN(tp.place) AS best_place
       FROM tournament_placings tp
       JOIN registrations r ON r.id = tp.registration_id
       JOIN players pl ON pl.id = r.player_id
       GROUP BY pl.id, pl.nexus_name, pl.avatar_url
       ORDER BY total_points DESC, best_place ASC, pl.nexus_name ASC
       LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    return rows.map((r) => ({
      playerId: r.player_id,
      playerName: r.player_name,
      avatarUrl: r.avatar_url ?? "",
      totalPoints: Number(r.total_points),
      eventsPlayed: Number(r.events_played),
      wins: Number(r.wins),
      losses: Number(r.losses),
      bestPlace: Number(r.best_place),
    }));
  }

  /** How many players the board has, for paging it. */
  async countRanked(): Promise<number> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT r.player_id) AS ranked
       FROM tournament_placings tp
       JOIN registrations r ON r.id = tp.registration_id
       JOIN players pl ON pl.id = r.player_id`,
    );
    return Number(rows[0]?.ranked ?? 0);
  }

  /** Tournaments whose placings were frozen before match records were stored. See backfillRecords(). */
  async tournamentsMissingRecords(): Promise<string[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT DISTINCT tournament_id FROM tournament_placings WHERE wins IS NULL",
    );
    return rows.map((r) => r.tournament_id as string);
  }

  async setRecord(
    tournamentId: string,
    registrationId: string,
    record: MatchRecord,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE tournament_placings SET wins = ?, losses = ?, draws = ?
       WHERE tournament_id = ? AND registration_id = ?`,
      [record.wins, record.losses, record.draws, tournamentId, registrationId],
    );
  }

  /**
   * Closes out whatever the backfill could not compute (a placing whose
   * registration is gone, a tournament whose bracket was cleared), so the
   * tournament stops coming back as "missing records" on every read.
   */
  async zeroMissingRecords(tournamentId: string): Promise<void> {
    await this.pool.query(
      `UPDATE tournament_placings
       SET wins = COALESCE(wins, 0), losses = COALESCE(losses, 0), draws = COALESCE(draws, 0)
       WHERE tournament_id = ?`,
      [tournamentId],
    );
  }

  /** Test seam. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM tournament_placings");
  }
}
