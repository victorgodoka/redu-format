import type { Pool, RowDataPacket } from "mysql2/promise";
import { toMysqlDatetimeMs } from "../db/datetime.ts";

export type DuelSlot = {
  id: string;
  tournamentId: string;
  matchId: string;
  position: number;
  currentRoomHash: string;
};

function toSlot(row: RowDataPacket): DuelSlot {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    matchId: row.match_id,
    position: row.position,
    currentRoomHash: row.current_room_hash,
  };
}

export class DuelSlotsRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async listForMatch(matchId: string): Promise<DuelSlot[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM duel_slots WHERE match_id = ? ORDER BY position ASC",
      [matchId],
    );
    return rows.map(toSlot);
  }

  /** Every slot for a whole tournament in one query, grouped by match - what a full-tournament verification pass reads instead of one query per match. */
  async listForTournament(tournamentId: string): Promise<Map<string, DuelSlot[]>> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM duel_slots WHERE tournament_id = ? ORDER BY match_id ASC, position ASC",
      [tournamentId],
    );
    const byMatch = new Map<string, DuelSlot[]>();
    for (const row of rows) {
      const slot = toSlot(row);
      if (!byMatch.has(slot.matchId)) byMatch.set(slot.matchId, []);
      byMatch.get(slot.matchId)!.push(slot);
    }
    return byMatch;
  }

  /** Creates the next slot for a match (position = however many it already has, + 1), defaulting its room to the match's own lobby. Idempotent via the unique (match_id, position) key - a race just means one caller's INSERT IGNORE is a no-op. */
  async ensureNext(id: string, tournamentId: string, matchId: string, position: number, roomHash: string, now: Date): Promise<void> {
    await this.pool.query(
      `INSERT IGNORE INTO duel_slots (id, tournament_id, match_id, position, current_room_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, tournamentId, matchId, position, roomHash, toMysqlDatetimeMs(now.toISOString())],
    );
  }

  /** Points a slot at a fresh lobby - what accepting a redo does. */
  async updateCurrentRoomHash(id: string, roomHash: string): Promise<void> {
    await this.pool.query("UPDATE duel_slots SET current_room_hash = ? WHERE id = ?", [roomHash, id]);
  }

  /** Drops the duel slots of matches that no longer exist - attempts cascade with them. See repairRound(). */
  async deleteForMatches(tournamentId: string, matchIds: string[]): Promise<void> {
    if (matchIds.length === 0) return;
    await this.pool.query("DELETE FROM duel_slots WHERE tournament_id = ? AND match_id IN (?)", [
      tournamentId,
      matchIds,
    ]);
  }

  /** Test seam. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM duel_slots");
  }
}
