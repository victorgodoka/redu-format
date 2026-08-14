/**
 * mysql2 pools are opened with `dateStrings: true` (see client.ts), so DATETIME
 * columns round-trip as plain "YYYY-MM-DD HH:MM:SS" strings instead of Date
 * objects in the process's local timezone. Combined with always writing UTC
 * here, this keeps startsAt exact regardless of what timezone the app or the
 * database server runs in.
 */

export function toMysqlDatetime(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19).replace("T", " ");
}

export function fromMysqlDatetime(value: string): string;
export function fromMysqlDatetime(value: string | null): string | null;
export function fromMysqlDatetime(value: string | null): string | null {
  return value ? `${value.replace(" ", "T")}Z` : null;
}

/**
 * Millisecond-precision variant, for columns declared DATETIME(3) - used
 * wherever two rows can plausibly be written in the same second and still
 * need a correct relative order (rate_limits.reset_at, audit_logs.at). A
 * plain-second DATETIME would tie, leaving order to fall back on whatever
 * else is in the ORDER BY (a random id, for audit_logs) instead of time.
 */
export function toMysqlDatetimeMs(iso: string): string {
  return new Date(iso).toISOString().slice(0, 23).replace("T", " ");
}

export function fromMysqlDatetimeMs(value: string): string;
export function fromMysqlDatetimeMs(value: string | null): string | null;
export function fromMysqlDatetimeMs(value: string | null): string | null {
  return value ? `${value.replace(" ", "T")}Z` : null;
}
