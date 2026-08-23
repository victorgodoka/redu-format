import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { fromMysqlDatetimeMs, toMysqlDatetimeMs } from "../db/datetime.ts";

export type DuelAttemptStatus = "active" | "completed" | "superseded";

export type DuelAttempt = {
  id: string;
  duelSlotId: string;
  attemptNumber: number;
  roomHash: string;
  status: DuelAttemptStatus;
  replayId: string | null;
  winnerRegistrationId: string | null;
  winReason: number | null;
  counts: boolean;
  dqRegistrationIds: string[] | null;
  /** When this app first saw this attempt - the redo-eligibility grace window counts from here, not from Nexus's own end_date, so a late-discovered disconnect (no admin token linked for a while, a verification gap) still gives players a fair window instead of arriving already-expired. See disconnectCounts(). */
  createdAt: string;
  resolvedAt: string | null;
};

function toAttempt(row: RowDataPacket): DuelAttempt {
  return {
    id: row.id,
    duelSlotId: row.duel_slot_id,
    attemptNumber: row.attempt_number,
    roomHash: row.room_hash,
    status: row.status,
    replayId: row.replay_id,
    winnerRegistrationId: row.winner_registration_id,
    winReason: row.win_reason,
    counts: Boolean(row.counts),
    dqRegistrationIds: typeof row.dq_registration_ids === "string" ? JSON.parse(row.dq_registration_ids) : row.dq_registration_ids,
    createdAt: fromMysqlDatetimeMs(row.created_at),
    resolvedAt: fromMysqlDatetimeMs(row.resolved_at),
  };
}

export class DuelAttemptsRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async listForSlot(duelSlotId: string): Promise<DuelAttempt[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM duel_attempts WHERE duel_slot_id = ? ORDER BY attempt_number ASC",
      [duelSlotId],
    );
    return rows.map(toAttempt);
  }

  /** Every attempt for every slot of a tournament, in one query - what a full-tournament verification pass reads instead of one query per slot. */
  async listForTournament(tournamentId: string): Promise<Map<string, DuelAttempt[]>> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT a.* FROM duel_attempts a
       JOIN duel_slots s ON s.id = a.duel_slot_id
       WHERE s.tournament_id = ?
       ORDER BY a.duel_slot_id ASC, a.attempt_number ASC`,
      [tournamentId],
    );
    const bySlot = new Map<string, DuelAttempt[]>();
    for (const row of rows) {
      const attempt = toAttempt(row);
      if (!bySlot.has(attempt.duelSlotId)) bySlot.set(attempt.duelSlotId, []);
      bySlot.get(attempt.duelSlotId)!.push(attempt);
    }
    return bySlot;
  }

  /**
   * Registers a replay as belonging to this slot's next attempt - idempotent
   * via the unique replay_id key, so if two verification passes race on the
   * same replay, only one attempt row is ever created for it (the loser's
   * INSERT IGNORE is a no-op, and it just re-reads what the winner wrote).
   */
  async create(input: {
    id: string;
    duelSlotId: string;
    attemptNumber: number;
    roomHash: string;
    replayId: string;
    now: Date;
  }): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `INSERT IGNORE INTO duel_attempts (id, duel_slot_id, attempt_number, room_hash, status, replay_id, created_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      [input.id, input.duelSlotId, input.attemptNumber, input.roomHash, input.replayId, toMysqlDatetimeMs(input.now.toISOString())],
    );
    return result.affectedRows > 0;
  }

  async resolve(
    id: string,
    input: { winnerRegistrationId: string | null; winReason: number | null; counts: boolean; dqRegistrationIds: string[] | null },
    now: Date,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE duel_attempts
       SET status = 'completed', winner_registration_id = ?, win_reason = ?, counts = ?, dq_registration_ids = ?, resolved_at = ?
       WHERE id = ?`,
      [
        input.winnerRegistrationId,
        input.winReason,
        input.counts,
        input.dqRegistrationIds ? JSON.stringify(input.dqRegistrationIds) : null,
        toMysqlDatetimeMs(now.toISOString()),
        id,
      ],
    );
  }

  /**
   * Flips whether an already-resolved disconnect attempt counts, without
   * touching anything else - the redo-window/redo-request lapsing into
   * "counts now" or a redo being accepted ("never counts"). See
   * duel-verification.service.ts's disconnectCounts().
   */
  async setCounts(id: string, counts: boolean): Promise<void> {
    await this.pool.query("UPDATE duel_attempts SET counts = ? WHERE id = ?", [counts, id]);
  }

  async supersede(id: string): Promise<void> {
    await this.pool.query("UPDATE duel_attempts SET status = 'superseded', counts = 0 WHERE id = ?", [id]);
  }

  /** Test seam. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM duel_attempts");
  }
}
