import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  DEFAULT_BANLIST,
  isBanlist,
  type Banlist,
  type DurationMode,
  type EntryFee,
  type Engine,
  type Structure,
  type TournamentEvent,
  type TournamentStatus,
} from "../../events.ts";
import { fromMysqlDatetime, fromMysqlDatetimeMs, toMysqlDatetime, toMysqlDatetimeMs } from "../db/datetime.ts";

export type TournamentDraft = Omit<
  TournamentEvent,
  "slug" | "taken" | "status" | "startedAt" | "finishedAt" | "cancelledAt" | "hasBanner" | "prizesSentAt"
> & {
  /** New banner to store. undefined leaves an existing banner untouched (update only - insert() treats it the same as null); null clears it. */
  banner?: { data: Buffer; mime: string } | null;
};

type TournamentRow = RowDataPacket & {
  slug: string;
  name: string;
  description: string | null;
  has_banner: number;
  starts_at: string;
  started_at: string | null;
  finished_at: string | null;
  status: TournamentStatus;
  cancelled_at: string | null;
  structure: Structure;
  rounds: number;
  top_cut: number | null;
  match_format: "Bo1" | "Bo3";
  round_limit_days: number;
  duration_mode: DurationMode;
  round_minutes: number;
  cleanup_minutes: number;
  engine: Engine;
  banlist: string;
  seat_cap: number | null;
  taken: number;
  entry_type: "free" | "paid";
  entry_amount_minor: number | null;
  entry_currency: string | null;
  host: string;
  signup_url: string;
  has_prizing: number;
  prizes_sent_at: string | null;
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
    description: row.description,
    hasBanner: Boolean(row.has_banner),
    startsAt: fromMysqlDatetime(row.starts_at),
    startedAt: fromMysqlDatetimeMs(row.started_at),
    finishedAt: fromMysqlDatetimeMs(row.finished_at),
    status: row.status,
    cancelledAt: fromMysqlDatetimeMs(row.cancelled_at),
    structure: row.structure,
    rounds: row.rounds,
    topCut: row.top_cut,
    matchFormat: row.match_format,
    roundLimitDays: row.round_limit_days,
    durationMode: row.duration_mode,
    roundMinutes: row.round_minutes,
    cleanupMinutes: row.cleanup_minutes,
    engine: row.engine,
    banlist: isBanlist(row.banlist) ? row.banlist : DEFAULT_BANLIST,
    seats: row.seat_cap,
    taken: Number(row.taken),
    entry: toEntry(row),
    host: row.host,
    signupUrl: row.signup_url,
    hasPrizing: Boolean(row.has_prizing),
    prizesSentAt: fromMysqlDatetimeMs(row.prizes_sent_at),
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
      `SELECT t.slug, t.name, t.description, (t.banner_image IS NOT NULL) AS has_banner, t.starts_at, t.started_at, t.finished_at, t.status, t.cancelled_at,
              t.structure, t.rounds, t.top_cut, t.match_format,
              t.round_limit_days, t.duration_mode, t.round_minutes, t.cleanup_minutes, t.engine, t.banlist, t.seat_cap, t.entry_type, t.entry_amount_minor, t.entry_currency,
              t.host, t.signup_url, t.has_prizing, t.prizes_sent_at, ${TAKEN_SUBQUERY}
       FROM tournaments t
       WHERE t.deleted_at IS NULL
       ORDER BY t.starts_at ASC`,
    );
    return rows.map(rowToTournament);
  }

  async findBySlug(slug: string): Promise<TournamentEvent | null> {
    const [rows] = await this.pool.query<TournamentRow[]>(
      `SELECT t.slug, t.name, t.description, (t.banner_image IS NOT NULL) AS has_banner, t.starts_at, t.started_at, t.finished_at, t.status, t.cancelled_at,
              t.structure, t.rounds, t.top_cut, t.match_format,
              t.round_limit_days, t.duration_mode, t.round_minutes, t.cleanup_minutes, t.engine, t.banlist, t.seat_cap, t.entry_type, t.entry_amount_minor, t.entry_currency,
              t.host, t.signup_url, t.has_prizing, t.prizes_sent_at, ${TAKEN_SUBQUERY}
       FROM tournaments t
       WHERE t.slug = ? AND t.deleted_at IS NULL
       LIMIT 1`,
      [slug],
    );
    return rows[0] ? rowToTournament(rows[0]) : null;
  }

  /** The raw banner bytes for the image route - never pulled into findAll()/findBySlug(), which only need to know it exists. */
  async findBanner(slug: string): Promise<{ data: Buffer; mime: string } | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT banner_image, banner_mime FROM tournaments WHERE slug = ? AND deleted_at IS NULL LIMIT 1",
      [slug],
    );
    const row = rows[0];
    if (!row?.banner_image) return null;
    return { data: row.banner_image as Buffer, mime: row.banner_mime as string };
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT 1 FROM tournaments WHERE slug = ? AND deleted_at IS NULL LIMIT 1",
      [slug],
    );
    return rows.length > 0;
  }

  /** The internal id, for tables that FK to tournaments.id instead of using the slug directly (tournament_brackets, tournament_placings). */
  async findIdBySlug(slug: string): Promise<string | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT id FROM tournaments WHERE slug = ? AND deleted_at IS NULL LIMIT 1",
      [slug],
    );
    return rows[0]?.id ?? null;
  }

  /** Just the banlist for a tournament id - what the duel rooms have to be opened on. */
  async findBanlistById(id: string): Promise<Banlist> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT banlist FROM tournaments WHERE id = ? AND deleted_at IS NULL LIMIT 1",
      [id],
    );
    const value = rows[0]?.banlist;
    return typeof value === "string" && isBanlist(value) ? value : DEFAULT_BANLIST;
  }

  /** The slug for an internal id - the reverse of findIdBySlug, for jobs that start from a tournament_id. */
  async findSlugById(id: string): Promise<string | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT slug FROM tournaments WHERE id = ? AND deleted_at IS NULL LIMIT 1",
      [id],
    );
    return rows[0]?.slug ?? null;
  }

  /** Moves status to `running` and records when. Only valid from `scheduled` - a no-op otherwise (already started, or cancelled). */
  async markStarted(id: string, at: string): Promise<void> {
    await this.pool.query(
      "UPDATE tournaments SET started_at = ?, status = 'running' WHERE id = ? AND status = 'scheduled'",
      [toMysqlDatetimeMs(at), id],
    );
  }

  /** Moves status to `finished` and records when. Only valid from `running` - a no-op otherwise. */
  async markFinished(id: string, at: string): Promise<void> {
    await this.pool.query(
      "UPDATE tournaments SET finished_at = ?, status = 'finished' WHERE id = ? AND status = 'running'",
      [toMysqlDatetimeMs(at), id],
    );
  }

  /**
   * Moves status to `cancelled` and records when. Valid from `scheduled` or
   * `running` - never from `finished` (a frozen official result can't
   * retroactively un-happen) or an already-`cancelled` tournament.
   * Returns whether the cancellation actually happened, so the caller can
   * tell "cancelled" apart from "couldn't be cancelled" (e.g. already finished).
   */
  async cancel(id: string, at: string): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      "UPDATE tournaments SET cancelled_at = ?, status = 'cancelled' WHERE id = ? AND status IN ('scheduled', 'running')",
      [toMysqlDatetimeMs(at), id],
    );
    return result.affectedRows > 0;
  }

  async insert(id: string, slug: string, draft: TournamentDraft): Promise<void> {
    const [entryType, entryAmountMinor, entryCurrency] = entryColumns(draft.entry);
    await this.pool.query(
      `INSERT INTO tournaments
        (id, slug, name, description, banner_image, banner_mime, starts_at, structure, rounds, top_cut, match_format, round_limit_days, duration_mode, round_minutes, cleanup_minutes, engine, banlist, seat_cap, entry_type, entry_amount_minor, entry_currency, host, signup_url, has_prizing)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        slug,
        draft.name,
        draft.description ?? null,
        draft.banner?.data ?? null,
        draft.banner?.mime ?? null,
        toMysqlDatetime(draft.startsAt),
        draft.structure,
        draft.rounds,
        draft.topCut,
        draft.matchFormat,
        draft.roundLimitDays,
        draft.durationMode,
        draft.roundMinutes,
        draft.cleanupMinutes,
        draft.engine,
        draft.banlist ?? DEFAULT_BANLIST,
        draft.seats,
        entryType,
        entryAmountMinor,
        entryCurrency,
        draft.host,
        draft.signupUrl,
        draft.hasPrizing ?? false,
      ],
    );
  }

  async update(slug: string, draft: TournamentDraft): Promise<boolean> {
    const [entryType, entryAmountMinor, entryCurrency] = entryColumns(draft.entry);
    const [result] = await this.pool.query<ResultSetHeader>(
      `UPDATE tournaments SET
        name = ?, description = ?, starts_at = ?, structure = ?, rounds = ?, top_cut = ?, match_format = ?,
        round_limit_days = ?, duration_mode = ?, round_minutes = ?, cleanup_minutes = ?,
        engine = ?, banlist = ?, seat_cap = ?, entry_type = ?, entry_amount_minor = ?,
        entry_currency = ?, host = ?, signup_url = ?, has_prizing = ?
       WHERE slug = ? AND deleted_at IS NULL`,
      [
        draft.name,
        draft.description ?? null,
        toMysqlDatetime(draft.startsAt),
        draft.structure,
        draft.rounds,
        draft.topCut,
        draft.matchFormat,
        draft.roundLimitDays,
        draft.durationMode,
        draft.roundMinutes,
        draft.cleanupMinutes,
        draft.engine,
        draft.banlist ?? DEFAULT_BANLIST,
        draft.seats,
        entryType,
        entryAmountMinor,
        entryCurrency,
        draft.host,
        draft.signupUrl,
        draft.hasPrizing ?? false,
        slug,
      ],
    );
    // banner is tri-state: undefined means the form didn't touch it (no re-upload on every save), so only write it when the caller actually said something.
    if (result.affectedRows > 0 && draft.banner !== undefined) {
      await this.pool.query("UPDATE tournaments SET banner_image = ?, banner_mime = ? WHERE slug = ?", [
        draft.banner?.data ?? null,
        draft.banner?.mime ?? null,
        slug,
      ]);
    }
    return result.affectedRows > 0;
  }

  /**
   * Claims the one-shot prize mailing: returns true only for the caller that
   * actually flipped it, so a double-clicked "Send prizing" can't mail the
   * codes twice.
   */
  async claimPrizeSend(id: string, at: string): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      "UPDATE tournaments SET prizes_sent_at = ? WHERE id = ? AND prizes_sent_at IS NULL AND status = 'finished'",
      [toMysqlDatetimeMs(at), id],
    );
    return result.affectedRows > 0;
  }

  /** Undoes claimPrizeSend when the mailing turned out to have nothing to send. */
  async releasePrizeSend(id: string): Promise<void> {
    await this.pool.query("UPDATE tournaments SET prizes_sent_at = NULL WHERE id = ?", [id]);
  }

  async delete(slug: string): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>("DELETE FROM tournaments WHERE slug = ?", [
      slug,
    ]);
    return result.affectedRows > 0;
  }
}
