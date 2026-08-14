import { getPool } from "../db/client.ts";
import { AdminsRepository } from "../repositories/admins.repository.ts";
import {
  ADMIN_ACTIONS,
  AuditLogRepository,
  type AdminAction,
  type AuditLogEntry,
  type AuditLogFilters,
} from "../repositories/audit-log.repository.ts";

export { ADMIN_ACTIONS };
export type { AdminAction, AuditLogEntry };

const PAGE_SIZE = 25;

export type AuditLogQuery = { actor?: string; action?: string; target?: string; page?: string };
export type AuditLogResults = { items: AuditLogEntry[]; page: number; pages: number; total: number };
export type AuditActor = { id: string; username: string; displayName: string };

function repos() {
  const pool = getPool();
  return { audit: new AuditLogRepository(pool), admins: new AdminsRepository(pool) };
}

export async function recordAction(entry: Omit<AuditLogEntry, "id" | "at">): Promise<void> {
  const { audit, admins } = repos();
  const adminId = await admins.findIdByDiscordUserId(entry.actorId);
  await audit.insert({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    adminId,
    actorId: entry.actorId,
    actorUsername: entry.actorUsername,
    actorDisplayName: entry.actorDisplayName,
    action: entry.action,
    target: entry.target,
    detail: entry.detail,
  });
}

export async function listAuditLog(query: AuditLogQuery = {}): Promise<AuditLogResults> {
  const { audit } = repos();
  const filters: AuditLogFilters = {
    actor: query.actor || undefined,
    action: query.action || undefined,
    target: query.target || undefined,
  };

  const total = await audit.count(filters);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const asked = Number.parseInt(query.page ?? "1", 10);
  const page = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), pages) : 1;
  const items = await audit.list(filters, PAGE_SIZE, (page - 1) * PAGE_SIZE);

  return { items, page, pages, total };
}

/** Distinct actors already in the log, for the admin/logs filter dropdown. */
export async function listAuditActors(): Promise<AuditActor[]> {
  return repos().audit.listActors();
}

/** Test seam. */
export async function resetAuditLog(): Promise<void> {
  const { audit, admins } = repos();
  await audit.clear();
  await admins.clear();
}
