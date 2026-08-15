import type { Pool, RowDataPacket } from "mysql2/promise";
import { fromMysqlDatetimeMs, toMysqlDatetimeMs } from "../db/datetime.ts";

export type AdminAction =
  | "admin.login"
  | "admin.logout"
  | "tournament.create"
  | "tournament.update"
  | "tournament.delete"
  | "participant.add"
  | "participant.remove"
  | "payment.confirm"
  | "payment.contest"
  | "nexus.link"
  | "nexus.unlink"
  | "bracket.start"
  | "bracket.round"
  | "bracket.result"
  | "bracket.complete";

export const ADMIN_ACTIONS: readonly AdminAction[] = [
  "admin.login",
  "admin.logout",
  "tournament.create",
  "tournament.update",
  "tournament.delete",
  "participant.add",
  "participant.remove",
  "payment.confirm",
  "payment.contest",
  "nexus.link",
  "nexus.unlink",
  "bracket.start",
  "bracket.round",
  "bracket.result",
  "bracket.complete",
];

export type AuditLogEntry = {
  id: string;
  /** ISO instant. */
  at: string;
  /** Discord snowflake, stable even if the account is later renamed. */
  actorId: string;
  /** Discord @handle. */
  actorUsername: string;
  /** Discord display name; falls back to actorUsername when unset. */
  actorDisplayName: string;
  action: AdminAction;
  /** What the action touched: a tournament slug, participant id, etc. */
  target?: string;
  /** One-line human-readable summary, shown as-is on the log page. */
  detail: string;
};

export type AuditLogFilters = { actor?: string; action?: string; target?: string };

type AuditLogRow = RowDataPacket & {
  id: string;
  at: string;
  actor_discord_user_id: string;
  actor_username: string;
  actor_display_name: string;
  action: AdminAction;
  target_id: string | null;
  detail: string;
};

function rowToEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    at: fromMysqlDatetimeMs(row.at),
    actorId: row.actor_discord_user_id,
    actorUsername: row.actor_username,
    actorDisplayName: row.actor_display_name,
    action: row.action,
    target: row.target_id ?? undefined,
    detail: row.detail,
  };
}

function whereClause(filters: AuditLogFilters): { where: string; params: string[] } {
  const conditions: string[] = [];
  const params: string[] = [];
  if (filters.actor) {
    conditions.push("actor_discord_user_id = ?");
    params.push(filters.actor);
  }
  if (filters.action) {
    conditions.push("action = ?");
    params.push(filters.action);
  }
  if (filters.target) {
    conditions.push("target_id = ?");
    params.push(filters.target);
  }
  return { where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", params };
}

export class AuditLogRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async insert(input: {
    id: string;
    at: string;
    adminId: string | null;
    actorId: string;
    actorUsername: string;
    actorDisplayName: string;
    action: AdminAction;
    target?: string;
    detail: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_logs
        (id, at, actor_admin_id, actor_discord_user_id, actor_username, actor_display_name, action, target_id, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        toMysqlDatetimeMs(input.at),
        input.adminId,
        input.actorId,
        input.actorUsername,
        input.actorDisplayName,
        input.action,
        input.target ?? null,
        input.detail,
      ],
    );
  }

  async list(filters: AuditLogFilters, limit: number, offset: number): Promise<AuditLogEntry[]> {
    const { where, params } = whereClause(filters);
    const [rows] = await this.pool.query<AuditLogRow[]>(
      `SELECT * FROM audit_logs ${where} ORDER BY at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return rows.map(rowToEntry);
  }

  async count(filters: AuditLogFilters): Promise<number> {
    const { where, params } = whereClause(filters);
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM audit_logs ${where}`,
      params,
    );
    return Number(rows[0]?.total ?? 0);
  }

  /** Distinct actors seen in the log so far, for the filter dropdown - no dependency on `admins` being populated. */
  async listActors(): Promise<{ id: string; username: string; displayName: string }[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT DISTINCT actor_discord_user_id AS id, actor_username AS username, actor_display_name AS displayName
       FROM audit_logs
       ORDER BY actor_display_name ASC`,
    );
    return rows.map((r) => ({ id: r.id, username: r.username, displayName: r.displayName }));
  }

  /** Test seam. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM audit_logs");
  }
}
