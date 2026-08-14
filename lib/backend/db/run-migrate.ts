import { getPool } from "./client.ts";
import { migrate } from "./migrate.ts";

migrate(getPool())
  .then(() => getPool().end())
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
