import { getPool } from "../db/client.ts";
import { PlayersRepository } from "../repositories/players.repository.ts";
import { RegistrationsRepository } from "../repositories/registrations.repository.ts";
import { notify } from "./notifications.service.ts";

/**
 * Who an admin broadcast goes to. `all` is a single global alert every player
 * reads; the other two resolve to a list of individual ones.
 */
export type MessageAudience =
  | { kind: "all" }
  | { kind: "tournament"; slug: string }
  | { kind: "players"; names: string[] };

export type BroadcastResult = {
  /** How many players it reached, or null for the global "everyone" alert (one row, no list). */
  sent: number | null;
  /** Names that matched no account - reported back rather than silently dropped. */
  unknown: string[];
};

function repos() {
  const pool = getPool();
  return { players: new PlayersRepository(pool), registrations: new RegistrationsRepository(pool) };
}

export async function broadcast(input: {
  title: string;
  body: string;
  audience: MessageAudience;
  /** Display name of the admin sending it - signed onto the message so a player can see who wrote it. */
  sentBy: string;
}): Promise<BroadcastResult> {
  const messageId = crypto.randomUUID();
  const body = `${input.body}

---

Sent by **${input.sentBy}**`;

  if (input.audience.kind === "all") {
    await send(messageId, input.title, body, null);
    return { sent: null, unknown: [] };
  }

  const { playerIds, unknown } = await resolve(input.audience);
  for (const playerId of playerIds) {
    await send(messageId, input.title, body, playerId);
  }
  return { sent: playerIds.length, unknown };
}

async function resolve(
  audience: Exclude<MessageAudience, { kind: "all" }>,
): Promise<{ playerIds: string[]; unknown: string[] }> {
  if (audience.kind === "tournament") {
    const rows = await repos().registrations.listPlayerIdsBySlug(audience.slug);
    return { playerIds: [...new Set(rows.map((r) => r.playerId))], unknown: [] };
  }

  const found = await repos().players.findByNames(audience.names);
  const matched = new Set(found.map((p) => p.nexusName));
  return {
    playerIds: found.map((p) => p.id),
    unknown: audience.names.filter((name) => !matched.has(name)),
  };
}

async function send(
  messageId: string,
  title: string,
  body: string,
  playerId: string | null,
): Promise<void> {
  const { createHash } = await import("node:crypto");
  await notify({
    id: crypto.randomUUID(),
    audience: "player",
    playerId,
    kind: "admin.message",
    title,
    body,
    metadata: null,
    // One row per recipient per send: the same text can be sent again later
    // without the dedupe key swallowing it.
    fingerprint: createHash("sha256")
      .update(`admin-message:${messageId}:${playerId ?? "all"}`)
      .digest("hex"),
  });
}
