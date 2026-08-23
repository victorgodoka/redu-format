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

/** The durably-linked Dueling Nexus token for this admin, or null if none is linked. */
export async function getAdminNexusToken(discordUserId: string): Promise<string | null> {
  return new AdminsRepository(getPool()).findNexusToken(discordUserId);
}

/** Persists (or, with `null`, clears) the admin's linked Dueling Nexus token. */
export async function setAdminNexusToken(discordUserId: string, token: string | null): Promise<void> {
  await new AdminsRepository(getPool()).setNexusToken(discordUserId, token);
}

/** See AdminsRepository.findAnyLinkedToken - the shared credential duel-verification.service.ts polls Nexus with. */
export async function findAnyLinkedNexusToken(): Promise<string | null> {
  return new AdminsRepository(getPool()).findAnyLinkedToken();
}
