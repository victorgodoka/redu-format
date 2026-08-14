/**
 * Side-effect import for *.test.ts files that touch the database. Must be the
 * first import in the test file so it points DATABASE_URL at a throwaway
 * database before any other module calls getPool().
 *
 * Node's test runner runs each test file as its own process, in parallel.
 * A single shared `_test` database let one file's setup (which truncates
 * every table) wipe rows another file's test was mid-way through writing -
 * so each process gets its own database instead, keyed by pid, dropped in
 * teardown().
 */
import { createConnection } from "mysql2/promise";
import { getPool, resetPool } from "./client.ts";
import { migrate } from "./migrate.ts";

const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) throw new Error("DATABASE_URL is not set");

const testUrl = new URL(baseUrl);
const testDbName = `${testUrl.pathname.replace(/^\//, "")}_test_${process.pid}`;
testUrl.pathname = `/${testDbName}`;

const rootUrl = new URL(baseUrl);
rootUrl.pathname = "/";
const bootstrap = await createConnection(rootUrl.toString());
await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${testDbName}\``);
await bootstrap.end();

process.env.DATABASE_URL = testUrl.toString();
resetPool();

await migrate(getPool());

/** Call from test.after(): drops this process's throwaway database and closes the pool. */
export async function teardownTestDb(): Promise<void> {
  const pool = getPool();
  await pool.query(`DROP DATABASE IF EXISTS \`${testDbName}\``);
  await pool.end();
}
