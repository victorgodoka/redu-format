import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { fromMysqlDatetimeMs, toMysqlDatetimeMs } from "../db/datetime.ts";

export type RedoRequestStatus = "pending" | "accepted" | "rejected" | "expired";

export type RedoRequest = {
  id: string;
  duelAttemptId: string;
  requesterRegistrationId: string;
  playerARegistrationId: string;
  playerBRegistrationId: string;
  playerAConsent: boolean;
  playerBConsent: boolean;
  status: RedoRequestStatus;
  expiresAt: string;
  replacementRoomHash: string | null;
};

function toRequest(row: RowDataPacket): RedoRequest {
  return {
    id: row.id,
    duelAttemptId: row.duel_attempt_id,
    requesterRegistrationId: row.requester_registration_id,
    playerARegistrationId: row.player_a_registration_id,
    playerBRegistrationId: row.player_b_registration_id,
    playerAConsent: Boolean(row.player_a_consent),
    playerBConsent: Boolean(row.player_b_consent),
    status: row.status,
    expiresAt: fromMysqlDatetimeMs(row.expires_at),
    replacementRoomHash: row.replacement_room_hash,
  };
}

export class RedoRequestsRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async findByAttempt(duelAttemptId: string): Promise<RedoRequest | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM redo_requests WHERE duel_attempt_id = ? LIMIT 1",
      [duelAttemptId],
    );
    return rows[0] ? toRequest(rows[0]) : null;
  }

  /** Every open request for a tournament's attempts, for the lazy-expiry sweep verification already does on every pass. */
  async listPending(tournamentId: string): Promise<(RedoRequest & { tournamentId: string })[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT r.* FROM redo_requests r
       JOIN duel_attempts a ON a.id = r.duel_attempt_id
       JOIN duel_slots s ON s.id = a.duel_slot_id
       WHERE s.tournament_id = ? AND r.status = 'pending'`,
      [tournamentId],
    );
    return rows.map((r) => ({ ...toRequest(r), tournamentId }));
  }

  /**
   * Opens the request with the requester's own consent already on file - a
   * request from only one player can never by itself satisfy "both accepted"
   * below. Idempotent via the unique duel_attempt_id key: a second attempt to
   * request a redo on the same disconnected attempt is a no-op (affectedRows
   * 0), which is also what makes "an attempt gets exactly one redo request
   * ever" hold without a separate check.
   */
  async create(input: {
    id: string;
    duelAttemptId: string;
    requesterRegistrationId: string;
    playerARegistrationId: string;
    playerBRegistrationId: string;
    expiresAt: Date;
    now: Date;
  }): Promise<boolean> {
    const requesterIsA = input.requesterRegistrationId === input.playerARegistrationId;
    const [result] = await this.pool.query<ResultSetHeader>(
      `INSERT IGNORE INTO redo_requests
        (id, duel_attempt_id, requester_registration_id, player_a_registration_id, player_b_registration_id,
         player_a_consent, player_b_consent, status, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        input.id,
        input.duelAttemptId,
        input.requesterRegistrationId,
        input.playerARegistrationId,
        input.playerBRegistrationId,
        requesterIsA,
        !requesterIsA,
        toMysqlDatetimeMs(input.now.toISOString()),
        toMysqlDatetimeMs(input.expiresAt.toISOString()),
      ],
    );
    return result.affectedRows > 0;
  }

  /** Records one player's consent - only while the request is still open and unexpired. Returns false for a stale/late click, which the caller treats as "nothing happened", never as an error. */
  async recordConsent(id: string, registrationId: string, isPlayerA: boolean, now: Date): Promise<boolean> {
    const column = isPlayerA ? "player_a_consent" : "player_b_consent";
    const [result] = await this.pool.query<ResultSetHeader>(
      `UPDATE redo_requests SET ${column} = 1
       WHERE id = ? AND status = 'pending' AND expires_at > ?
         AND ${isPlayerA ? "player_a_registration_id" : "player_b_registration_id"} = ?`,
      [id, toMysqlDatetimeMs(now.toISOString()), registrationId],
    );
    return result.affectedRows > 0;
  }

  /**
   * Claims "both sides have now consented" for exactly one caller: the UPDATE's
   * WHERE requires status still 'pending', so of two concurrent callers that
   * both observe both-consents-true, only the first one's statement actually
   * matches a row (affectedRows 1) - the second finds status already flipped
   * to 'accepted' and matches nothing (affectedRows 0). That is what makes
   * "two simultaneous accepts can't create two replacement lobbies" hold: the
   * caller that wins this claim is the only one allowed to generate one.
   */
  async claimAccepted(id: string, replacementRoomHash: string, now: Date): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `UPDATE redo_requests
       SET status = 'accepted', replacement_room_hash = ?, resolved_at = ?
       WHERE id = ? AND status = 'pending' AND player_a_consent = 1 AND player_b_consent = 1`,
      [replacementRoomHash, toMysqlDatetimeMs(now.toISOString()), id],
    );
    return result.affectedRows > 0;
  }

  /** Either player calling it off. Guarded the same way as claimAccepted - a stale reject after the request already resolved is a no-op. */
  async reject(id: string, now: Date): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      "UPDATE redo_requests SET status = 'rejected', resolved_at = ? WHERE id = ? AND status = 'pending'",
      [toMysqlDatetimeMs(now.toISOString()), id],
    );
    return result.affectedRows > 0;
  }

  /** The lazy-expiry sweep: anything still pending past its deadline. Guarded the same way, so a request that got accepted/rejected in the same instant it expired is never double-resolved. */
  async expireIfDue(id: string, now: Date): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      "UPDATE redo_requests SET status = 'expired', resolved_at = ? WHERE id = ? AND status = 'pending' AND expires_at <= ?",
      [toMysqlDatetimeMs(now.toISOString()), id, toMysqlDatetimeMs(now.toISOString())],
    );
    return result.affectedRows > 0;
  }

  /** Test seam. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM redo_requests");
  }
}
