/**
 * In-memory audit trail for every admin action. Same shape as lib/tournaments.ts:
 * async functions over a module-level array, so a real store (Postgres, etc.)
 * is a drop-in swap for the bodies later, with no change to call sites.
 * ponytail: per-process memory, resets on restart/deploy.
 */

export type AdminAction =
  | "admin.login"
  | "admin.logout"
  | "tournament.create"
  | "tournament.update"
  | "tournament.delete"
  | "participant.add"
  | "participant.remove"
  | "nexus.link"
  | "nexus.unlink";

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

const MAX_ENTRIES = 1000;

let entries: AuditLogEntry[] = [];

export async function recordAction(
  entry: Omit<AuditLogEntry, "id" | "at">,
): Promise<void> {
  const full: AuditLogEntry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    ...entry,
  };
  entries = [full, ...entries].slice(0, MAX_ENTRIES);
}

export async function listAuditLog(): Promise<readonly AuditLogEntry[]> {
  return entries;
}

export const ACTION_LABELS: Record<AdminAction, string> = {
  "admin.login": "Signed in",
  "admin.logout": "Signed out",
  "tournament.create": "Created tournament",
  "tournament.update": "Updated tournament",
  "tournament.delete": "Deleted tournament",
  "participant.add": "Added participant",
  "participant.remove": "Removed participant",
  "nexus.link": "Linked Dueling Nexus account",
  "nexus.unlink": "Unlinked Dueling Nexus account",
};
