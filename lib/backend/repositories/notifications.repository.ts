import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { fromMysqlDatetimeMs, toMysqlDatetimeMs } from "../db/datetime.ts";

export type NotificationAudience = "admin" | "player";

export type NotificationRow = {
  id: string;
  audience: NotificationAudience;
  /** null for a global alert - one addressed to every reader of this audience. */
  playerId: string | null;
  kind: string;
  title: string;
  body: string;
  metadata: unknown;
  createdAt: string;
  read: boolean;
};

export type NewNotification = {
  id: string;
  audience: NotificationAudience;
  playerId: string | null;
  kind: string;
  title: string;
  body: string;
  metadata: unknown;
  fingerprint: string;
};

type Row = RowDataPacket & {
  id: string;
  audience: NotificationAudience;
  player_id: string | null;
  kind: string;
  title: string;
  body: string;
  metadata: unknown;
  created_at: string;
  read_at: string | null;
};

function toNotification(row: Row): NotificationRow {
  return {
    id: row.id,
    audience: row.audience,
    playerId: row.player_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    // mysql2 hands JSON columns back parsed on MySQL and as a string on MariaDB
    // (where JSON is a LONGTEXT alias), so both shapes have to be accepted.
    metadata: typeof row.metadata === "string" ? safeJson(row.metadata) : row.metadata,
    createdAt: fromMysqlDatetimeMs(row.created_at),
    read: row.read_at !== null,
  };
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Who is reading. `readerId` is the per-person key that read state hangs off -
 * a Discord user id for an admin, a players.id for a player - and `playerId`
 * additionally scopes which individual alerts a player is allowed to see.
 * Admins have no playerId: they read the global admin feed.
 */
export type NotificationReader = {
  audience: NotificationAudience;
  readerId: string;
  playerId?: string | null;
};

/** `audience = ? AND (global OR addressed to me)`, with the values it needs. */
function scope(reader: NotificationReader): { sql: string; params: (string | null)[] } {
  if (reader.audience === "player" && reader.playerId) {
    return {
      sql: "n.audience = ? AND (n.player_id IS NULL OR n.player_id = ?)",
      params: [reader.audience, reader.playerId],
    };
  }
  return { sql: "n.audience = ? AND n.player_id IS NULL", params: [reader.audience] };
}

export class NotificationsRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Returns false when an identical alert already exists - the drift check runs
   * on every round and every login, and the fingerprint's whole job is to keep
   * that from re-announcing a mismatch that was already reported.
   */
  async insertIfNew(input: NewNotification): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `INSERT IGNORE INTO notifications
        (id, audience, player_id, kind, title, body, metadata, fingerprint, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.audience,
        input.playerId,
        input.kind,
        input.title,
        input.body,
        input.metadata === undefined ? null : JSON.stringify(input.metadata),
        input.fingerprint,
        toMysqlDatetimeMs(new Date().toISOString()),
      ],
    );
    return result.affectedRows > 0;
  }

  async list(reader: NotificationReader, limit = 100): Promise<NotificationRow[]> {
    const where = scope(reader);
    const [rows] = await this.pool.query<Row[]>(
      `SELECT n.*, r.read_at FROM notifications n
       LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.reader_id = ?
       WHERE ${where.sql}
       ORDER BY n.created_at DESC
       LIMIT ?`,
      [reader.readerId, ...where.params, limit],
    );
    return rows.map(toNotification);
  }

  async find(reader: NotificationReader, id: string): Promise<NotificationRow | null> {
    const where = scope(reader);
    const [rows] = await this.pool.query<Row[]>(
      `SELECT n.*, r.read_at FROM notifications n
       LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.reader_id = ?
       WHERE ${where.sql} AND n.id = ?
       LIMIT 1`,
      [reader.readerId, ...where.params, id],
    );
    return rows[0] ? toNotification(rows[0]) : null;
  }

  async countUnread(reader: NotificationReader): Promise<number> {
    const where = scope(reader);
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS unread FROM notifications n
       LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.reader_id = ?
       WHERE ${where.sql} AND r.read_at IS NULL`,
      [reader.readerId, ...where.params],
    );
    return Number(rows[0]?.unread ?? 0);
  }

  /**
   * Scoped through the same visibility clause as reads, so a reader can never
   * mark an alert that was never theirs. Idempotent: re-opening a message keeps
   * the original read time rather than bumping it.
   */
  async markRead(reader: NotificationReader, id: string): Promise<void> {
    const where = scope(reader);
    await this.pool.query(
      `INSERT IGNORE INTO notification_reads (notification_id, reader_id, read_at)
       SELECT n.id, ?, ? FROM notifications n WHERE ${where.sql} AND n.id = ?`,
      [reader.readerId, toMysqlDatetimeMs(new Date().toISOString()), ...where.params, id],
    );
  }
}
