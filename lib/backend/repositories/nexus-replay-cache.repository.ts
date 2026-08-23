import type { Pool, RowDataPacket } from "mysql2/promise";
import type { NexusReplay } from "../../nexus-parse.ts";
import { fromMysqlDatetimeMs, toMysqlDatetimeMs } from "../db/datetime.ts";

/**
 * Nexus's start_date/end_date strings are untrusted input - toMysqlDatetimeMs
 * throws on anything Date can't parse, and a single malformed replay must
 * never take down the whole batch it arrived in (see verifyTournament, which
 * loops over every replay from one get-info.php call). Null in, null out.
 */
function safeDatetimeMs(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : toMysqlDatetimeMs(new Date(ms).toISOString());
}

export type CachedReplay = {
  replayId: string;
  gameName: string;
  player1Id: string | null;
  player2Id: string | null;
  player1Name: string | null;
  player2Name: string | null;
  isTag: boolean;
  endDate: string | null;
  /** Result columns - null until fetchDetails() has run for this replay. */
  winningTeam: number | null;
  winReason: number | null;
  mainDecks: number[][] | null;
  extraDecks: number[][] | null;
};

function toCached(row: RowDataPacket): CachedReplay {
  const json = (v: unknown): number[][] | null => (typeof v === "string" ? JSON.parse(v) : (v as number[][] | null));
  return {
    replayId: row.replay_id,
    gameName: row.game_name,
    player1Id: row.player_1_id,
    player2Id: row.player_2_id,
    player1Name: row.player_1_name,
    player2Name: row.player_2_name,
    isTag: Boolean(row.is_tag),
    endDate: fromMysqlDatetimeMs(row.end_date),
    winningTeam: row.winning_team,
    winReason: row.win_reason,
    mainDecks: json(row.main_decks),
    extraDecks: json(row.extra_decks),
  };
}

export class NexusReplayCacheRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /** Records a replay summary from get-info.php - a no-op if it's already known (never overwrites result columns a later detail fetch may have filled in). */
  async upsertSummary(replay: NexusReplay, now: Date): Promise<void> {
    await this.pool.query(
      `INSERT INTO nexus_replay_cache
        (replay_id, game_name, player_1_id, player_2_id, player_1_name, player_2_name, is_tag, end_date, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE replay_id = replay_id`,
      [
        replay.id,
        replay.gameName,
        replay.player1Id || null,
        replay.player2Id || null,
        replay.player1 || null,
        replay.player2 || null,
        replay.player3Id !== null || replay.player4Id !== null,
        safeDatetimeMs(replay.endDate),
        toMysqlDatetimeMs(now.toISOString()),
      ],
    );
  }

  async fetchDetails(
    replayId: string,
    details: { winningTeam: number; winReason: number; mainDecks: number[][]; extraDecks: number[][] },
    now: Date,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE nexus_replay_cache
       SET winning_team = ?, win_reason = ?, main_decks = ?, extra_decks = ?, details_fetched_at = ?
       WHERE replay_id = ?`,
      [
        details.winningTeam,
        details.winReason,
        JSON.stringify(details.mainDecks),
        JSON.stringify(details.extraDecks),
        toMysqlDatetimeMs(now.toISOString()),
        replayId,
      ],
    );
  }

  /** Every cached replay for a lobby, oldest first - how duel-verification.service.ts assigns replays to duel slots in play order. */
  async listByGameName(gameName: string): Promise<CachedReplay[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM nexus_replay_cache WHERE game_name = ? ORDER BY end_date ASC, fetched_at ASC",
      [gameName],
    );
    return rows.map(toCached);
  }

  /** Same as listByGameName, for the several spellings a room hash's game_name might come back as (see candidateGameNames in duel-verification.service.ts). */
  async listByGameNames(gameNames: string[]): Promise<CachedReplay[]> {
    if (gameNames.length === 0) return [];
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM nexus_replay_cache WHERE game_name IN (?) ORDER BY end_date ASC, fetched_at ASC",
      [gameNames],
    );
    return rows.map(toCached);
  }

  async findById(replayId: string): Promise<CachedReplay | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>("SELECT * FROM nexus_replay_cache WHERE replay_id = ? LIMIT 1", [
      replayId,
    ]);
    return rows[0] ? toCached(rows[0]) : null;
  }

  /** Test seam. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM nexus_replay_cache");
  }
}
