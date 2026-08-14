import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool, RowDataPacket } from "mysql2/promise";

const MIGRATIONS_DIR = path.join(import.meta.dirname, "migrations");

function splitStatements(sql: string): string[] {
  // Strip line comments first so a semicolon in prose (e.g. "unique; NULL on delete")
  // doesn't get mistaken for a statement boundary.
  const withoutComments = sql.replace(/--[^\n]*/g, "");
  return withoutComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Runs every .sql file in migrations/ that isn't recorded in _migrations yet, in filename order. */
export async function migrate(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await pool.query<RowDataPacket[]>("SELECT name FROM _migrations");
  const applied = new Set(rows.map((r) => r.name as string));

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of splitStatements(sql)) {
      await pool.query(statement);
    }
    await pool.query("INSERT INTO _migrations (name) VALUES (?)", [file]);
  }
}
