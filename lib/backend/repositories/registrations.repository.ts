import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Participant, PaymentStatus } from "../services/tournament.service.ts";
import { fromMysqlDatetime, toMysqlDatetime } from "../db/datetime.ts";

type RegistrationRow = RowDataPacket & {
  id: string;
  display_name: string;
  deck_name: string;
  payment_status: PaymentStatus;
  proof_url: string | null;
  payment_by: string | null;
  payment_at: string | null;
  source: "public_signup" | "admin_manual";
};

function rowToParticipant(row: RegistrationRow): Participant {
  return {
    id: row.id,
    name: row.display_name,
    deckName: row.deck_name,
    paymentStatus: row.payment_status,
    proofUrl: row.proof_url,
    paymentBy: row.payment_by,
    paymentAt: fromMysqlDatetime(row.payment_at),
    source: row.source,
  };
}

export type PublicSignup = { registrationId: string; deckId: string | null; deckName: string };

export class RegistrationsRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async findByTournamentSlug(slug: string): Promise<Participant[]> {
    const [rows] = await this.pool.query<RegistrationRow[]>(
      `SELECT r.* FROM registrations r
       JOIN tournaments t ON t.id = r.tournament_id
       WHERE t.slug = ?
       ORDER BY r.created_at ASC`,
      [slug],
    );
    return rows.map(rowToParticipant);
  }

  async findOne(slug: string, id: string): Promise<Participant | null> {
    const [rows] = await this.pool.query<RegistrationRow[]>(
      `SELECT r.* FROM registrations r
       JOIN tournaments t ON t.id = r.tournament_id
       WHERE t.slug = ? AND r.id = ?
       LIMIT 1`,
      [slug, id],
    );
    return rows[0] ? rowToParticipant(rows[0]) : null;
  }

  /** Resolves tournament_id from the slug in the same statement; 0 affected rows means the slug doesn't exist. */
  async insert(id: string, slug: string, input: { name: string; deckName: string }): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO registrations (id, tournament_id, display_name, deck_name)
       SELECT ?, id, ?, ? FROM tournaments WHERE slug = ?`,
      [id, input.name, input.deckName, slug],
    );
    return result.affectedRows > 0;
  }

  async remove(slug: string, id: string): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `DELETE r FROM registrations r
       JOIN tournaments t ON t.id = r.tournament_id
       WHERE t.slug = ? AND r.id = ?`,
      [slug, id],
    );
    return result.affectedRows > 0;
  }

  async updatePayment(
    slug: string,
    id: string,
    update: { status: PaymentStatus; proofUrl: string | null; by: string },
  ): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `UPDATE registrations r
       JOIN tournaments t ON t.id = r.tournament_id
       SET r.payment_status = ?, r.proof_url = ?, r.payment_by = ?, r.payment_at = ?
       WHERE t.slug = ? AND r.id = ?`,
      // Written from JS, not SQL's NOW() - see lib/backend/repositories/rate-limits.repository.ts
      // for why: NOW() reads the DB server's timezone, not UTC.
      [update.status, update.proofUrl, update.by, toMysqlDatetime(new Date().toISOString()), slug, id],
    );
    return result.affectedRows > 0;
  }

  // --- Public signup path (Fase 3) ---

  async findPublicSignup(slug: string, playerId: string): Promise<PublicSignup | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT r.id, r.deck_id, r.deck_name FROM registrations r
       JOIN tournaments t ON t.id = r.tournament_id
       WHERE t.slug = ? AND r.player_id = ? AND r.source = 'public_signup'
       LIMIT 1`,
      [slug, playerId],
    );
    const row = rows[0];
    return row ? { registrationId: row.id, deckId: row.deck_id, deckName: row.deck_name } : null;
  }

  /** tournament_slug -> deck_id, for every public signup this player has, across all tournaments. */
  async listPublicSignupsForPlayer(playerId: string): Promise<{ slug: string; deckId: string | null }[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT t.slug, r.deck_id FROM registrations r
       JOIN tournaments t ON t.id = r.tournament_id
       WHERE r.player_id = ? AND r.source = 'public_signup'`,
      [playerId],
    );
    return rows.map((r) => ({ slug: r.slug, deckId: r.deck_id }));
  }

  /**
   * Registers, or - if this player already has a public signup for this
   * tournament - replaces the chosen deck on the existing row, same as the
   * old cookie-backed "filter then push" did. Never touches payment_status on
   * the update path: switching decks after confirming payment shouldn't
   * un-confirm it.
   *
   * No return value: MySQL's affectedRows for INSERT ... ON DUPLICATE KEY
   * UPDATE is 0 when the row already had these exact values (a legitimate
   * no-op, e.g. re-submitting the same deck) as well as when the tournament
   * doesn't exist, so it can't tell success from failure here. The caller
   * (register() in registration.service.ts) already confirmed the tournament
   * exists via getTournament() before calling this.
   */
  async upsertPublicSignup(
    id: string,
    slug: string,
    input: { playerId: string; displayName: string; deckId: string; deckName: string; initialPaymentStatus: PaymentStatus },
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO registrations (id, tournament_id, player_id, source, display_name, deck_name, deck_id, payment_status)
       SELECT ?, id, ?, 'public_signup', ?, ?, ?, ? FROM tournaments WHERE slug = ?
       ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), deck_name = VALUES(deck_name), deck_id = VALUES(deck_id)`,
      [id, input.playerId, input.displayName, input.deckName, input.deckId, input.initialPaymentStatus, slug],
    );
  }

  async deletePublicSignup(slug: string, playerId: string): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `DELETE r FROM registrations r
       JOIN tournaments t ON t.id = r.tournament_id
       WHERE t.slug = ? AND r.player_id = ? AND r.source = 'public_signup'`,
      [slug, playerId],
    );
    return result.affectedRows > 0;
  }
}
