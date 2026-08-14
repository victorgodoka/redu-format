import { getPool } from "../db/client.ts";
import { AdminsRepository } from "../repositories/admins.repository.ts";

/** Called on Discord OAuth login so audit_logs.actor_admin_id has a real row to link to. */
export async function upsertAdmin(input: {
  discordUserId: string;
  username: string;
  displayName: string;
}): Promise<void> {
  await new AdminsRepository(getPool()).upsert(input);
}
