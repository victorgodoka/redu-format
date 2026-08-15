import type { RowDataPacket } from "mysql2/promise";
import { events } from "../../events.ts";
import { getPool } from "./client.ts";
import { toMysqlDatetime } from "./datetime.ts";
import { migrate } from "./migrate.ts";

async function seed(): Promise<void> {
  const pool = getPool();
  await migrate(pool);

  const [[{ count }]] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM tournaments",
  );
  if (count > 0) {
    console.log(`tournaments already has ${count} row(s), skipping seed`);
    return;
  }

  for (const event of events) {
    await pool.query(
      `INSERT INTO tournaments
        (id, slug, name, starts_at, structure, rounds, top_cut, match_format, round_limit_days, engine, seat_cap, taken, entry_type, entry_amount_minor, entry_currency, host, signup_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        event.slug,
        event.name,
        toMysqlDatetime(event.startsAt),
        event.structure,
        event.rounds,
        event.topCut,
        event.matchFormat,
        event.roundLimitDays,
        event.engine,
        event.seats,
        event.taken,
        event.entry.type,
        event.entry.type === "paid" ? Math.round(event.entry.amount * 100) : null,
        event.entry.type === "paid" ? event.entry.currency : null,
        event.host,
        event.signupUrl,
      ],
    );
  }

  console.log(`seeded ${events.length} tournaments`);
}

seed()
  .then(() => getPool().end())
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
