import { getPool } from "./lib/backend/db/client.ts";

const ID = "48b1c8ff-4344-44a5-8359-cc2e1acc3b73";
const SLUG = "redu-test-tournament";
const pool = getPool();

async function show(label: string, sql: string, params: unknown[] = []) {
  try {
    const [rows] = await pool.query(sql, params);
    console.log(`\n### ${label}`);
    console.log(JSON.stringify(rows, null, 2).slice(0, 2000));
  } catch (err) {
    console.log(`\n### ${label} -> ERROR: ${(err as Error).message}`);
  }
}

await show("tournament row (any state)", "SELECT id, slug, name, status, deleted_at FROM tournaments WHERE id = ? OR slug = ?", [ID, SLUG]);
await show("all tournaments", "SELECT id, slug, name, status, deleted_at FROM tournaments ORDER BY created_at DESC LIMIT 20");
await show("registrations for it", "SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?", [ID]);
await show("bracket for it", "SELECT tournament_id, LENGTH(engine_json) AS bytes FROM tournament_brackets WHERE tournament_id = ?", [ID]);
await show("match deadlines", "SELECT COUNT(*) AS n FROM match_deadlines WHERE tournament_id = ?", [ID]);
await show("match reports", "SELECT COUNT(*) AS n FROM match_reports WHERE tournament_id = ?", [ID]);
await show("placings", "SELECT COUNT(*) AS n FROM tournament_placings WHERE tournament_id = ?", [ID]);
await show("audit trail for this tournament", "SELECT at, action, target, detail, actor_display_name FROM audit_logs WHERE target = ? ORDER BY at DESC LIMIT 15", [SLUG]);

await pool.end();
