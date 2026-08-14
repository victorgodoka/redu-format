import { createPool, type Pool } from "mysql2/promise";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const uri = process.env.DATABASE_URL;
    if (!uri) throw new Error("DATABASE_URL is not set");
    // Small on purpose: on Vercel this module is re-instantiated per serverless
    // function instance, each with its own pool. mysql2's default limit of 10
    // multiplied across many concurrent instances can blow past the DB's
    // max_connections; a request here is typically I/O-bound and short-lived,
    // so a handful of connections per instance is plenty.
    pool = createPool({ uri, dateStrings: true, connectionLimit: 3 });
  }
  return pool;
}

/** Test setup only: forces the next getPool() to open a fresh connection after DATABASE_URL is swapped. */
export function resetPool(): void {
  pool = null;
}
