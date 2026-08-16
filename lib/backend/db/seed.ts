import { getPool } from "./client.ts";
import { migrate } from "./migrate.ts";

/** Just runs migrations - tournaments now come from the admin UI or seed-one-off.ts, not a hardcoded mock list. */
async function seed(): Promise<void> {
  const pool = getPool();
  await migrate(pool);
}

seed()
  .then(() => getPool().end())
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
