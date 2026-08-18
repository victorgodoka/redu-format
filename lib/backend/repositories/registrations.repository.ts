import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { DeckSnapshot } from "../../deck-diff.ts";
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

export type PublicSignup = {
  registrationId: string;
  deckId: string | null;
  deckName: string;
  paymentStatus: PaymentStatus;
  proofUrl: string | null;
};

/** A signup with a deck baseline the drift check can re-read from Dueling Nexus. */
export type WatchedDeck = {
  registrationId: string;
  playerId: string;
  deckId: string;
  deckName: string;
  /** Raw deck_snapshot column - parse with parseSnapshot() from lib/deck-diff.ts. */
  deckSnapshot: unknown;
  /** Never carries a token: alerts built from this go out to every admin. */
  player: { id: string; name: string; avatar: string | null; contributor: boolean };
  tournament: {
    slug: string;
    name: string;
    startsAt: string;
    structure: string;
    matchFormat: string;
    status: string;
  };
};

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

  async updateDeck(slug: string, id: string, deckName: string): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `UPDATE registrations r
       JOIN tournaments t ON t.id = r.tournament_id
       SET r.deck_name = ?
       WHERE t.slug = ? AND r.id = ?`,
      [deckName, slug, id],
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

  /** A dropped registration doesn't count as "still signed up" - the row stays (history, tiebreakers) but the player shouldn't see themselves as registered anymore. */
  async findPublicSignup(slug: string, playerId: string): Promise<PublicSignup | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT r.id, r.deck_id, r.deck_name, r.payment_status, r.proof_url FROM registrations r
       JOIN tournaments t ON t.id = r.tournament_id
       WHERE t.slug = ? AND r.player_id = ? AND r.source = 'public_signup' AND r.dropped_at IS NULL
       LIMIT 1`,
      [slug, playerId],
    );
    const row = rows[0];
    return row
      ? {
          registrationId: row.id,
          deckId: row.deck_id,
          deckName: row.deck_name,
          paymentStatus: row.payment_status,
          proofUrl: row.proof_url,
        }
      : null;
  }

  /** tournament_slug -> deck_id, for every public signup this player has, across all tournaments. */
  async listPublicSignupsForPlayer(playerId: string): Promise<{ slug: string; deckId: string | null }[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT t.slug, r.deck_id FROM registrations r
       JOIN tournaments t ON t.id = r.tournament_id
       WHERE r.player_id = ? AND r.source = 'public_signup' AND r.dropped_at IS NULL`,
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
    input: {
      playerId: string;
      nexusIdentityKey: string;
      displayName: string;
      deckId: string;
      deckName: string;
      /** Card lists as Nexus served them at signup, the baseline later checks diff against. */
      deckSnapshot: DeckSnapshot;
      initialPaymentStatus: PaymentStatus;
    },
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO registrations
        (id, tournament_id, player_id, nexus_identity_key_snapshot, source, display_name, deck_name, deck_id, deck_snapshot, payment_status)
       SELECT ?, id, ?, ?, 'public_signup', ?, ?, ?, ?, ? FROM tournaments WHERE slug = ?
       ON DUPLICATE KEY UPDATE
        nexus_identity_key_snapshot = VALUES(nexus_identity_key_snapshot),
        display_name = VALUES(display_name), deck_name = VALUES(deck_name), deck_id = VALUES(deck_id),
        deck_snapshot = VALUES(deck_snapshot)`,
      [
        id,
        input.playerId,
        input.nexusIdentityKey,
        input.displayName,
        input.deckName,
        input.deckId,
        // Explicitly null rather than an undefined bind when there is no list to
        // freeze - the drift check skips a registration with no baseline.
        input.deckSnapshot ? JSON.stringify(input.deckSnapshot) : null,
        input.initialPaymentStatus,
        slug,
      ],
    );
  }

  // --- Drops (Fase 5.2) ---

  async markDropped(registrationId: string): Promise<void> {
    await this.pool.query(
      "UPDATE registrations SET dropped_at = ? WHERE id = ?",
      [toMysqlDatetime(new Date().toISOString()), registrationId],
    );
  }

  /** They showed up this round - clears any streak of missed rounds. */
  async resetAbsences(registrationIds: string[]): Promise<void> {
    if (registrationIds.length === 0) return;
    await this.pool.query("UPDATE registrations SET consecutive_absences = 0 WHERE id IN (?)", [registrationIds]);
  }

  /** They missed this round - bumps the streak and returns the new count, for the caller to decide whether that's the second miss in a row. */
  async incrementAbsences(registrationId: string): Promise<number> {
    await this.pool.query(
      "UPDATE registrations SET consecutive_absences = consecutive_absences + 1 WHERE id = ?",
      [registrationId],
    );
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT consecutive_absences FROM registrations WHERE id = ?",
      [registrationId],
    );
    return rows[0]?.consecutive_absences ?? 0;
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

  // --- Deck drift watch (Fase 6) ---

  /**
   * Every public signup that can still be checked against Dueling Nexus: it
   * has a deck id and a snapshot of what that deck held when it was accepted,
   * and the player hasn't dropped. Admin-manual rows and signups made before
   * snapshots existed carry no baseline, so there is nothing to compare them
   * against and they're filtered out here rather than guessed at downstream.
   */
  async listWatchedDecks(filter: { slug?: string; playerId?: string }): Promise<WatchedDeck[]> {
    const conditions = ["r.source = 'public_signup'", "r.dropped_at IS NULL", "r.deck_id IS NOT NULL", "r.deck_snapshot IS NOT NULL"];
    const params: string[] = [];

    if (filter.slug) {
      conditions.push("t.slug = ?");
      params.push(filter.slug);
    }
    if (filter.playerId) {
      conditions.push("r.player_id = ?");
      params.push(filter.playerId);
    }

    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT r.id, r.player_id, r.display_name, r.deck_id, r.deck_name, r.deck_snapshot,
              t.slug, t.name AS tournament_name, t.starts_at, t.structure, t.match_format, t.status,
              p.nexus_name, p.avatar_url, p.contributor
       FROM registrations r
       JOIN tournaments t ON t.id = r.tournament_id
       LEFT JOIN players p ON p.id = r.player_id
       WHERE ${conditions.join(" AND ")}`,
      params,
    );

    return rows.map((row) => ({
      registrationId: row.id,
      playerId: row.player_id,
      deckId: row.deck_id,
      deckName: row.deck_name,
      deckSnapshot: row.deck_snapshot,
      player: {
        id: row.player_id,
        name: row.nexus_name ?? row.display_name,
        avatar: row.avatar_url,
        contributor: Boolean(row.contributor),
      },
      tournament: {
        slug: row.slug,
        name: row.tournament_name,
        startsAt: fromMysqlDatetime(row.starts_at),
        structure: row.structure,
        matchFormat: row.match_format,
        status: row.status,
      },
    }));
  }
}
