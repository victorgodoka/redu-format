import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { EntryFee, Structure, TournamentEvent } from "../../events.ts";
import { fromMysqlDatetime, toMysqlDatetime } from "../db/datetime.ts";

export type TournamentDraft = Omit<TournamentEvent, "slug" | "taken">;

type TournamentRow = RowDataPacket & {
  slug: string;
  name: string;
  starts_at: string;
  structure: Structure;
  rounds: number;
  top_cut: number | null;
  match_format: "Bo1" | "Bo3";
  time_limit_minutes: number;
  seat_cap: number | null;
  taken: number;
  entry_type: "free" | "paid";
  entry_amount_minor: number | null;
  entry_currency: string | null;
  host: string;
  signup_url: string;
};

/** Every registration - public signup or admin-manual - occupies a seat, regardless of payment status. */
const TAKEN_SUBQUERY = "(SELECT COUNT(*) FROM registrations r WHERE r.tournament_id = t.id) AS taken";

function toEntry(row: TournamentRow): EntryFee {
  if (row.entry_type === "paid") {
    return { type: "paid", amount: row.entry_amount_minor! / 100, currency: row.entry_currency! };
  }
  return { type: "free" };
}

function rowToTournament(row: TournamentRow): TournamentEvent {
  return {
    slug: row.slug,
    name: row.name,
    startsAt: fromMysqlDatetime(row.starts_at),
    structure: row.structure,
    rounds: row.rounds,
    topCut: row.top_cut,
    matchFormat: row.match_format,
    timeLimit: row.time_limit_minutes,
    seats: row.seat_cap,
    taken: Number(row.taken),
    entry: toEntry(row),
    host: row.host,
    signupUrl: row.signup_url,
  };
}

function entryColumns(entry: EntryFee): [string, number | null, string | null] {
  return entry.type === "paid"
    ? [entry.type, Math.round(entry.amount * 100), entry.currency]
    : [entry.type, null, null];
}

export class TournamentsRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async findAll(): Promise<TournamentEvent[]> {
    const [rows] = await this.pool.query<TournamentRow[]>(
      `SELECT t.slug, t.name, t.starts_at, t.structure, t.rounds, t.top_cut, t.match_format,
              t.time_limit_minutes, t.seat_cap, t.entry_type, t.entry_amount_minor, t.entry_currency,
              t.host, t.signup_url, ${TAKEN_SUBQUERY}
       FROM tournaments t
       WHERE t.deleted_at IS NULL
       ORDER BY t.starts_at ASC`,
    );
    return rows.map(rowToTournament);
  }

  async findBySlug(slug: string): Promise<TournamentEvent | null> {
    const [rows] = await this.pool.query<TournamentRow[]>(
      `SELECT t.slug, t.name, t.starts_at, t.structure, t.rounds, t.top_cut, t.match_format,
              t.time_limit_minutes, t.seat_cap, t.entry_type, t.entry_amount_minor, t.entry_currency,
              t.host, t.signup_url, ${TAKEN_SUBQUERY}
       FROM tournaments t
       WHERE t.slug = ? AND t.deleted_at IS NULL
       LIMIT 1`,
      [slug],
    );
    return rows[0] ? rowToTournament(rows[0]) : null;
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT 1 FROM tournaments WHERE slug = ? AND deleted_at IS NULL LIMIT 1",
      [slug],
    );
    return rows.length > 0;
  }

  async insert(id: string, slug: string, draft: TournamentDraft): Promise<void> {
    const [entryType, entryAmountMinor, entryCurrency] = entryColumns(draft.entry);
    await this.pool.query(
      `INSERT INTO tournaments
        (id, slug, name, starts_at, structure, rounds, top_cut, match_format, time_limit_minutes, seat_cap, entry_type, entry_amount_minor, entry_currency, host, signup_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        slug,
        draft.name,
        toMysqlDatetime(draft.startsAt),
        draft.structure,
        draft.rounds,
        draft.topCut,
        draft.matchFormat,
        draft.timeLimit,
        draft.seats,
        entryType,
        entryAmountMinor,
        entryCurrency,
        draft.host,
        draft.signupUrl,
      ],
    );
  }

  async update(slug: string, draft: TournamentDraft): Promise<boolean> {
    const [entryType, entryAmountMinor, entryCurrency] = entryColumns(draft.entry);
    const [result] = await this.pool.query<ResultSetHeader>(
      `UPDATE tournaments SET
        name = ?, starts_at = ?, structure = ?, rounds = ?, top_cut = ?, match_format = ?,
        time_limit_minutes = ?, seat_cap = ?, entry_type = ?, entry_amount_minor = ?,
        entry_currency = ?, host = ?, signup_url = ?
       WHERE slug = ? AND deleted_at IS NULL`,
      [
        draft.name,
        toMysqlDatetime(draft.startsAt),
        draft.structure,
        draft.rounds,
        draft.topCut,
        draft.matchFormat,
        draft.timeLimit,
        draft.seats,
        entryType,
        entryAmountMinor,
        entryCurrency,
        draft.host,
        draft.signupUrl,
        slug,
      ],
    );
    return result.affectedRows > 0;
  }

  async delete(slug: string): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>("DELETE FROM tournaments WHERE slug = ?", [
      slug,
    ]);
    return result.affectedRows > 0;
  }
}
